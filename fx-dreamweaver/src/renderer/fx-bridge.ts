/**
 * FX Bridge - Connects renderer to FX Core
 */

export interface FXNode {
    __id: string;
    __parent_id: string | null;
    __nodes: Record<string, FXNode>;
    __value: any;
    __type: string | null;
    __proto: string[];
    __behaviors: Map<string, any>;
    __instances: Map<string, any>;
    __effects: Function[];
    __watchers: Set<(nv: unknown, ov: unknown) => void>;
    __meta?: Record<string, any>;
}

export interface FXNodeProxy<V = any> {
    (path: string, value?: any): FXNodeProxy<any>;
    val(): V;
    val(newValue: any): FXNodeProxy<any>;
    watch(callback: (newValue: any, oldValue: any) => void): () => void;
    node(): FXNode;
}

/**
 * FX Bridge - Manages FX Core integration in the IDE
 */
export class FXBridge {
    private root: FXNode;
    private proxy: FXNodeProxy;

    constructor() {
        this.root = this.createNode('');
        this.proxy = this.createProxy();
    }

    /**
     * Initialize the bridge
     */
    async init(): Promise<void> {
        // Initialize core state nodes
        this.set('ui.panels', {});
        this.set('workspace.files', {});
        this.set('workspace.projectPath', null);
        this.set('settings.viewMode', '2d');
        this.set('settings.theme', 'dark');
        this.set('ai.sessions', {});
        this.set('observability.events', []);
        this.set('metrics.fps', 60);
        this.set('metrics.sync.latency', 0);

        console.log('[FXBridge] Initialized');
    }

    /**
     * Get a value at path
     */
    get(path: string): any {
        const node = this.resolvePath(path);
        return node?.__value;
    }

    /**
     * Set a value at path
     */
    set(path: string, value: any): void {
        this.setPath(path, value);
    }

    /**
     * Watch a path for changes
     */
    watch(path: string, callback: (newValue: any, oldValue: any) => void): () => void {
        let node = this.resolvePath(path);
        if (!node) {
            node = this.setPath(path, undefined);
        }
        node.__watchers.add(callback);
        return () => node!.__watchers.delete(callback);
    }

    /**
     * Get the proxy accessor
     */
    $$(path?: string): FXNodeProxy {
        if (path) {
            return this.createProxy(path);
        }
        return this.proxy;
    }

    /**
     * Emit an observability event
     */
    emit(action: string, payload: any): void {
        const event = {
            timestamp: Date.now(),
            actor: 'user',
            action,
            payload,
            traceId: `fx-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            severity: 'info'
        };

        const events = this.get('observability.events') || [];
        events.push(event);

        // Keep last 1000 events
        if (events.length > 1000) {
            events.shift();
        }

        this.set('observability.events', events);
    }

    /**
     * Get all panel nodes
     */
    getPanels(): Record<string, any> {
        return this.get('ui.panels') || {};
    }

    /**
     * Update panel node
     */
    updatePanel(panelId: string, data: any): void {
        const panels = this.getPanels();
        panels[panelId] = { ...panels[panelId], ...data };
        this.set('ui.panels', panels);
        this.emit('panel.update', { panelId, data });
    }

    /**
     * Remove panel node
     */
    removePanel(panelId: string): void {
        const panels = this.getPanels();
        delete panels[panelId];
        this.set('ui.panels', panels);
        this.emit('panel.remove', { panelId });
    }

    /**
     * Get the root node
     */
    getRoot(): FXNode {
        return this.root;
    }

    /**
     * Serialize state for snapshot
     */
    serialize(): string {
        const serializeNode = (node: FXNode): any => {
            const result: any = {
                __id: node.__id,
                __value: node.__value,
                __type: node.__type,
                __nodes: {}
            };

            for (const [key, child] of Object.entries(node.__nodes)) {
                result.__nodes[key] = serializeNode(child);
            }

            return result;
        };

        return JSON.stringify(serializeNode(this.root));
    }

    /**
     * Restore state from snapshot
     */
    deserialize(data: string): void {
        const parsed = JSON.parse(data);

        const restoreNode = (data: any, parent: FXNode | null = null): FXNode => {
            const node = this.createNode(data.__id, parent?.__id || null);
            node.__value = data.__value;
            node.__type = data.__type;

            for (const [key, childData] of Object.entries(data.__nodes || {})) {
                node.__nodes[key] = restoreNode(childData as any, node);
            }

            return node;
        };

        this.root = restoreNode(parsed);
    }

    // Internal methods

    private createNode(id: string, parentId: string | null = null): FXNode {
        return {
            __id: id,
            __parent_id: parentId,
            __nodes: {},
            __value: undefined,
            __type: null,
            __proto: [],
            __behaviors: new Map(),
            __instances: new Map(),
            __effects: [],
            __watchers: new Set()
        };
    }

    private resolvePath(path: string, root: FXNode = this.root): FXNode | undefined {
        if (!path) return root;

        const parts = path.split('.');
        let current = root;

        for (const part of parts) {
            if (!current.__nodes[part]) {
                return undefined;
            }
            current = current.__nodes[part];
        }

        return current;
    }

    private setPath(path: string, value: any, root: FXNode = this.root): FXNode {
        if (!path) {
            root.__value = value;
            return root;
        }

        const parts = path.split('.');
        let current = root;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!current.__nodes[part]) {
                const nodeId = parts.slice(0, i + 1).join('.');
                current.__nodes[part] = this.createNode(nodeId, current.__id);
            }
            current = current.__nodes[part];
        }

        const oldValue = current.__value;
        current.__value = value;

        // Notify watchers
        for (const watcher of current.__watchers) {
            try {
                watcher(value, oldValue);
            } catch (e) {
                console.error('[FXBridge] Watcher error:', e);
            }
        }

        return current;
    }

    private createProxy(basePath: string = ''): FXNodeProxy {
        const self = this;

        const handler = function(path: string, value?: any): FXNodeProxy {
            const fullPath = basePath ? `${basePath}.${path}` : path;

            if (value !== undefined) {
                self.setPath(fullPath, value);
            }

            return self.createProxy(fullPath);
        } as FXNodeProxy;

        handler.val = function(newValue?: any) {
            if (newValue !== undefined) {
                self.setPath(basePath, newValue);
                return handler;
            }
            const node = self.resolvePath(basePath);
            return node?.__value;
        };

        handler.watch = function(callback: (nv: any, ov: any) => void) {
            return self.watch(basePath, callback);
        };

        handler.node = function() {
            return self.resolvePath(basePath) || self.setPath(basePath, undefined);
        };

        return handler;
    }
}
