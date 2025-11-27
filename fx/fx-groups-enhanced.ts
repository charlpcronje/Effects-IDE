/**
 * Enhanced Groups Functionality for FX Framework
 * Provides complete group operations including:
 * - Group creation and management
 * - Batch operations on groups
 * - Query and aggregation functions
 * - Reactive group updates
 * - Advanced filtering and mapping
 */

import type { FXCore, FXNode, FXNodeProxy } from './fx';

/**
 * Enhanced Group class with full functionality
 */
export class EnhancedGroup {
    private fx: FXCore;
    private members: Set<FXNode> = new Set();
    private manualNodes: Set<FXNode> = new Set();
    private selectorNodes: Set<FXNode> = new Set();
    private reactive: boolean = true;
    private watchers: Map<string, () => void> = new Map();
    private changeCallbacks: Set<(group: EnhancedGroup) => void> = new Set();
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;
    private debounceMs: number = 50;

    // CSS selectors for automatic membership
    private includeSelectors: string[] = [];
    private excludeSelectors: string[] = [];

    // Query cache
    private queryCache: Map<string, any> = new Map();
    private cacheInvalidated: boolean = true;

    constructor(fx: FXCore, initial: Array<FXNode | FXNodeProxy | string> = []) {
        this.fx = fx;

        // Add initial members
        for (const item of initial) {
            this.add(item);
        }
    }

    /**
     * Add a node to the group
     */
    add(item: FXNode | FXNodeProxy | string): this {
        const node = this.resolveNode(item);
        if (!node) return this;

        this.manualNodes.add(node);
        this.members.add(node);

        if (this.reactive) {
            this.watchNode(node);
        }

        this.invalidateCache();
        this.notifyChange();
        return this;
    }

    /**
     * Add multiple nodes
     */
    addMany(...items: Array<FXNode | FXNodeProxy | string>): this {
        for (const item of items) {
            const node = this.resolveNode(item);
            if (node) {
                this.manualNodes.add(node);
                this.members.add(node);
                if (this.reactive) {
                    this.watchNode(node);
                }
            }
        }
        this.invalidateCache();
        this.notifyChange();
        return this;
    }

    /**
     * Remove a node from the group
     */
    remove(item: FXNode | FXNodeProxy | string | ((node: FXNodeProxy) => boolean)): this {
        if (this.isRemovalPredicate(item)) {
            // Remove by predicate
            const toRemove: FXNode[] = [];
            for (const node of this.manualNodes) {
                const proxy = this.createProxy(node);
                if (item(proxy)) {
                    toRemove.push(node);
                }
            }
            for (const node of toRemove) {
                this.manualNodes.delete(node);
                this.members.delete(node);
                this.unwatchNode(node);
            }
        } else {
            const node = this.resolveNode(item);
            if (node) {
                this.manualNodes.delete(node);
                this.members.delete(node);
                this.unwatchNode(node);
            }
        }

        this.invalidateCache();
        this.notifyChange();
        return this;
    }

    /**
     * Clear all nodes from the group
     */
    clear(): this {
        for (const node of this.members) {
            this.unwatchNode(node);
        }
        this.members.clear();
        this.manualNodes.clear();
        this.selectorNodes.clear();
        this.invalidateCache();
        this.notifyChange();
        return this;
    }

    /**
     * Add nodes matching a CSS selector
     */
    include(selector: string): this {
        this.includeSelectors.push(selector);
        this.updateSelectorNodes();
        return this;
    }

    /**
     * Exclude nodes matching a CSS selector
     */
    exclude(selector: string): this {
        this.excludeSelectors.push(selector);
        this.updateSelectorNodes();
        return this;
    }

    /**
     * Query nodes based on a condition
     */
    where(condition: ((node: FXNodeProxy) => boolean) | Record<string, any>): EnhancedGroup {
        const filtered = new EnhancedGroup(this.fx);

        if (typeof condition === 'function') {
            for (const node of this.members) {
                const proxy = this.createProxy(node);
                if (condition(proxy)) {
                    filtered.add(node);
                }
            }
        } else {
            // Object-based query
            for (const node of this.members) {
                if (this.matchesObject(node, condition)) {
                    filtered.add(node);
                }
            }
        }

        return filtered;
    }

    /**
     * Map nodes to values
     */
    map<T>(fn: (node: FXNodeProxy, index: number) => T): T[] {
        const result: T[] = [];
        let index = 0;
        for (const node of this.members) {
            const proxy = this.createProxy(node);
            result.push(fn(proxy, index++));
        }
        return result;
    }

    /**
     * Filter nodes
     */
    filter(fn: (node: FXNodeProxy, index: number) => boolean): EnhancedGroup {
        const filtered = new EnhancedGroup(this.fx);
        let index = 0;
        for (const node of this.members) {
            const proxy = this.createProxy(node);
            if (fn(proxy, index++)) {
                filtered.add(node);
            }
        }
        return filtered;
    }

    /**
     * Reduce nodes to a single value
     */
    reduce<T>(fn: (acc: T, node: FXNodeProxy, index: number) => T, initial: T): T {
        let acc = initial;
        let index = 0;
        for (const node of this.members) {
            const proxy = this.createProxy(node);
            acc = fn(acc, proxy, index++);
        }
        return acc;
    }

    /**
     * Iterate over nodes
     */
    forEach(fn: (node: FXNodeProxy, index: number) => void): this {
        let index = 0;
        for (const node of this.members) {
            const proxy = this.createProxy(node);
            fn(proxy, index++);
        }
        return this;
    }

    /**
     * Check if any node matches a condition
     */
    some(fn: (node: FXNodeProxy, index: number) => boolean): boolean {
        let index = 0;
        for (const node of this.members) {
            const proxy = this.createProxy(node);
            if (fn(proxy, index++)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if all nodes match a condition
     */
    every(fn: (node: FXNodeProxy, index: number) => boolean): boolean {
        let index = 0;
        for (const node of this.members) {
            const proxy = this.createProxy(node);
            if (!fn(proxy, index++)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Find first node matching a condition
     */
    find(fn: (node: FXNodeProxy, index: number) => boolean): FXNodeProxy | undefined {
        let index = 0;
        for (const node of this.members) {
            const proxy = this.createProxy(node);
            if (fn(proxy, index++)) {
                return proxy;
            }
        }
        return undefined;
    }

    /**
     * Get first node
     */
    first(): FXNodeProxy | undefined {
        const first = this.members.values().next().value;
        return first ? this.createProxy(first) : undefined;
    }

    /**
     * Get last node
     */
    last(): FXNodeProxy | undefined {
        let last: FXNode | undefined;
        for (const node of this.members) {
            last = node;
        }
        return last ? this.createProxy(last) : undefined;
    }

    /**
     * Get node at index
     */
    at(index: number): FXNodeProxy | undefined {
        if (index < 0) {
            index = this.size() + index;
        }
        let current = 0;
        for (const node of this.members) {
            if (current === index) {
                return this.createProxy(node);
            }
            current++;
        }
        return undefined;
    }

    /**
     * Set value on all nodes
     */
    set(key: string | Record<string, any>, value?: any): this {
        if (typeof key === 'object') {
            // Set multiple properties
            for (const node of this.members) {
                const proxy = this.createProxy(node);
                for (const [k, v] of Object.entries(key)) {
                    proxy.set(v, k);
                }
            }
        } else {
            // Set single property
            for (const node of this.members) {
                const proxy = this.createProxy(node);
                proxy.set(value, key);
            }
        }
        this.invalidateCache();
        return this;
    }

    /**
     * Get values from all nodes
     */
    get(key?: string): any[] {
        const result: any[] = [];
        for (const node of this.members) {
            const proxy = this.createProxy(node);
            if (key) {
                result.push(proxy.get(key));
            } else {
                result.push(proxy.val());
            }
        }
        return result;
    }

    /**
     * Watch for changes in the group
     */
    watch(fn: (group: EnhancedGroup) => void): () => void {
        this.changeCallbacks.add(fn);
        return () => {
            this.changeCallbacks.delete(fn);
        };
    }

    /**
     * Aggregation functions
     */

    sum(key?: string): number {
        const cacheKey = `sum:${key || ''}`;
        if (!this.cacheInvalidated && this.queryCache.has(cacheKey)) {
            return this.queryCache.get(cacheKey);
        }

        let sum = 0;
        for (const node of this.members) {
            const proxy = this.createProxy(node);
            const value = key ? proxy.get(key) : proxy.val();
            const num = Number(value);
            if (!isNaN(num)) {
                sum += num;
            }
        }

        this.queryCache.set(cacheKey, sum);
        return sum;
    }

    avg(key?: string): number {
        const size = this.size();
        if (size === 0) return 0;
        return this.sum(key) / size;
    }

    min(key?: string): number {
        const cacheKey = `min:${key || ''}`;
        if (!this.cacheInvalidated && this.queryCache.has(cacheKey)) {
            return this.queryCache.get(cacheKey);
        }

        let min = Infinity;
        for (const node of this.members) {
            const proxy = this.createProxy(node);
            const value = key ? proxy.get(key) : proxy.val();
            const num = Number(value);
            if (!isNaN(num) && num < min) {
                min = num;
            }
        }

        const result = min === Infinity ? 0 : min;
        this.queryCache.set(cacheKey, result);
        return result;
    }

    max(key?: string): number {
        const cacheKey = `max:${key || ''}`;
        if (!this.cacheInvalidated && this.queryCache.has(cacheKey)) {
            return this.queryCache.get(cacheKey);
        }

        let max = -Infinity;
        for (const node of this.members) {
            const proxy = this.createProxy(node);
            const value = key ? proxy.get(key) : proxy.val();
            const num = Number(value);
            if (!isNaN(num) && num > max) {
                max = num;
            }
        }

        const result = max === -Infinity ? 0 : max;
        this.queryCache.set(cacheKey, result);
        return result;
    }

    count(condition?: (node: FXNodeProxy) => boolean): number {
        if (!condition) {
            return this.size();
        }

        let count = 0;
        for (const node of this.members) {
            const proxy = this.createProxy(node);
            if (condition(proxy)) {
                count++;
            }
        }
        return count;
    }

    /**
     * Group nodes by a key or function
     */
    groupBy<K>(fn: ((node: FXNodeProxy) => K) | string): Map<K, EnhancedGroup> {
        const groups = new Map<K, EnhancedGroup>();

        for (const node of this.members) {
            const proxy = this.createProxy(node);
            const key = typeof fn === 'string' ? proxy.get(fn) : fn(proxy);

            if (!groups.has(key)) {
                groups.set(key, new EnhancedGroup(this.fx));
            }
            groups.get(key)!.add(node);
        }

        return groups;
    }

    /**
     * Sort nodes
     */
    sort(compareFn?: (a: FXNodeProxy, b: FXNodeProxy) => number): FXNodeProxy[] {
        const nodes = Array.from(this.members);

        if (compareFn) {
            nodes.sort((a, b) => {
                const proxyA = this.createProxy(a);
                const proxyB = this.createProxy(b);
                return compareFn(proxyA, proxyB);
            });
        } else {
            // Default sort by value
            nodes.sort((a, b) => {
                const valA = (a as any).__value;
                const valB = (b as any).__value;
                if (valA < valB) return -1;
                if (valA > valB) return 1;
                return 0;
            });
        }

        return nodes.map(n => this.createProxy(n));
    }

    /**
     * Get unique values
     */
    unique(key?: string): any[] {
        const seen = new Set();
        const result: any[] = [];

        for (const node of this.members) {
            const proxy = this.createProxy(node);
            const value = key ? proxy.get(key) : proxy.val();
            const strValue = JSON.stringify(value);

            if (!seen.has(strValue)) {
                seen.add(strValue);
                result.push(value);
            }
        }

        return result;
    }

    /**
     * Batch operations
     */

    batchSet(updates: Array<{ node: FXNode | FXNodeProxy | string; key: string; value: any }>): this {
        for (const update of updates) {
            const node = this.resolveNode(update.node);
            if (node && this.members.has(node)) {
                const proxy = this.createProxy(node);
                proxy.set(update.value, update.key);
            }
        }
        this.invalidateCache();
        return this;
    }

    batchUpdate(fn: (node: FXNodeProxy, index: number) => void): this {
        let index = 0;
        for (const node of this.members) {
            const proxy = this.createProxy(node);
            fn(proxy, index++);
        }
        this.invalidateCache();
        return this;
    }

    /**
     * Utility methods
     */

    size(): number {
        return this.members.size;
    }

    isEmpty(): boolean {
        return this.members.size === 0;
    }

    contains(item: FXNode | FXNodeProxy | string): boolean {
        const node = this.resolveNode(item);
        return node ? this.members.has(node) : false;
    }

    toArray(): FXNodeProxy[] {
        return Array.from(this.members).map(n => this.createProxy(n));
    }

    clone(): EnhancedGroup {
        const cloned = new EnhancedGroup(this.fx);
        for (const node of this.members) {
            cloned.add(node);
        }
        cloned.includeSelectors = [...this.includeSelectors];
        cloned.excludeSelectors = [...this.excludeSelectors];
        cloned.reactive = this.reactive;
        cloned.debounceMs = this.debounceMs;
        return cloned;
    }

    /**
     * Set reactive mode
     */
    setReactive(enabled: boolean): this {
        if (enabled !== this.reactive) {
            this.reactive = enabled;
            if (enabled) {
                for (const node of this.members) {
                    this.watchNode(node);
                }
            } else {
                for (const [id, unwatch] of this.watchers) {
                    unwatch();
                }
                this.watchers.clear();
            }
        }
        return this;
    }

    /**
     * Set debounce delay
     */
    setDebounce(ms: number): this {
        this.debounceMs = ms;
        return this;
    }

    // Private helper methods

    private resolveNode(item: FXNode | FXNodeProxy | string): FXNode | null {
        if (typeof item === 'string') {
            // Resolve path
            return (this.fx as any).resolvePath(item, this.fx.root);
        } else if (this.isNodeProxyValue(item)) {
            // It's a proxy
            return (item as any).node();
        } else if ((item as any).__id) {
            // It's a node
            return item as FXNode;
        }
        return null;
    }

    private isNodeProxyValue(value: unknown): value is FXNodeProxy {
        return typeof value === 'function' && typeof (value as FXNodeProxy).node === 'function';
    }

    private isRemovalPredicate(value: unknown): value is (node: FXNodeProxy) => boolean {
        return typeof value === 'function' && !this.isNodeProxyValue(value);
    }

    private createProxy(node: FXNode): FXNodeProxy {
        return (this.fx as any).createNodeProxy(node);
    }

    private watchNode(node: FXNode): void {
        if (this.watchers.has(node.__id)) return;

        const proxy = this.createProxy(node);
        const unwatch = proxy.watch(() => {
            this.invalidateCache();
            this.notifyChange();
        });

        this.watchers.set(node.__id, unwatch);
    }

    private unwatchNode(node: FXNode): void {
        const unwatch = this.watchers.get(node.__id);
        if (unwatch) {
            unwatch();
            this.watchers.delete(node.__id);
        }
    }

    private updateSelectorNodes(): void {
        if (!this.fx) return;

        // Clear existing selector nodes
        for (const node of this.selectorNodes) {
            if (!this.manualNodes.has(node)) {
                this.members.delete(node);
                this.unwatchNode(node);
            }
        }
        this.selectorNodes.clear();

        // Add nodes matching include selectors
        if (this.includeSelectors.length > 0 && (this.fx as any).cssQueryAll) {
            for (const selector of this.includeSelectors) {
                const nodes = (this.fx as any).cssQueryAll(selector);
                for (const node of nodes) {
                    this.selectorNodes.add(node);
                    this.members.add(node);
                    if (this.reactive) {
                        this.watchNode(node);
                    }
                }
            }
        }

        // Remove nodes matching exclude selectors
        if (this.excludeSelectors.length > 0 && (this.fx as any).cssQueryAll) {
            for (const selector of this.excludeSelectors) {
                const nodes = (this.fx as any).cssQueryAll(selector);
                for (const node of nodes) {
                    this.selectorNodes.delete(node);
                    this.members.delete(node);
                    this.unwatchNode(node);
                }
            }
        }

        this.invalidateCache();
        this.notifyChange();
    }

    private isOperatorObject(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }

    private matchesObject(node: FXNode, condition: Record<string, unknown>): boolean {
        for (const [key, expectedValue] of Object.entries(condition)) {
            const actualValue = (node as any)[key] ?? node.__value?.[key];

            if (this.isOperatorObject(expectedValue)) {
                for (const [op, val] of Object.entries(expectedValue)) {
                    switch (op) {
                        case '$eq':
                            if (actualValue !== val) return false;
                            break;
                        case '$ne':
                            if (actualValue === val) return false;
                            break;
                        case '$gt':
                            if (typeof actualValue !== 'number' || typeof val !== 'number' || actualValue <= val) return false;
                            break;
                        case '$gte':
                            if (typeof actualValue !== 'number' || typeof val !== 'number' || actualValue < val) return false;
                            break;
                        case '$lt':
                            if (typeof actualValue !== 'number' || typeof val !== 'number' || actualValue >= val) return false;
                            break;
                        case '$lte':
                            if (typeof actualValue !== 'number' || typeof val !== 'number' || actualValue > val) return false;
                            break;
                        case '$in':
                            if (!Array.isArray(val) || !val.includes(actualValue)) return false;
                            break;
                        case '$nin':
                            if (!Array.isArray(val) || val.includes(actualValue)) return false;
                            break;
                        case '$regex':
                            if (!(val instanceof RegExp || typeof val === 'string')) return false;
                            if (!new RegExp(val).test(String(actualValue ?? ''))) return false;
                            break;
                        case '$exists':
                            if (typeof val !== 'boolean') return false;
                            if (val === true && actualValue === undefined) return false;
                            if (val === false && actualValue !== undefined) return false;
                            break;
                        default:
                            // Unknown operator, fall back to exact match
                            if (actualValue !== expectedValue) return false;
                    }
                }
            } else {
                if (actualValue !== expectedValue) return false;
            }
        }

        return true;
    }

    private invalidateCache(): void {
        this.cacheInvalidated = true;
        this.queryCache.clear();
    }

    private notifyChange(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            this.cacheInvalidated = false;
            for (const callback of this.changeCallbacks) {
                try {
                    callback(this);
                } catch (error) {
                    console.error('Error in group change callback:', error);
                }
            }
        }, this.debounceMs);
    }
}

/**
 * Export function to enhance FX with groups functionality
 */
export function enhanceFXGroups(fx: FXCore): void {
    // Add group factory to FX
    (fx as any).createGroup = (initial?: Array<FXNode | FXNodeProxy | string>) => {
        return new EnhancedGroup(fx, initial);
    };

    // Extend node proxy with group method
    const originalCreateProxy = (fx as any).createNodeProxy;
    (fx as any).createNodeProxy = function(node: FXNode) {
        const proxy = originalCreateProxy.call(this, node);

        // Add enhanced group method
        if (!proxy.group) {
            proxy.group = (initial?: Array<FXNode | FXNodeProxy | string>) => {
                const group = new EnhancedGroup(fx, initial || [node]);
                return group;
            };
        }

        return proxy;
    };
}