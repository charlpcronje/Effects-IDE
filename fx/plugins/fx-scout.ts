// /plugins/fx-scout.ts
/**
 * @file fx-scout.ts
 * @version 3.0.0 "The Navigator"
 * @description FX Scout - Zero-async module loader with deep dependency analysis
 * 
 * Pure synchronous API powered by FX's suspend/replay magic.
 * Worker runs in separate thread (async there is fine!).
 * Main thread stays pure - no async contamination.
 * 
 * Architecture by: Creative Genius Who Found FX
 */

import type { FXCore, FXNodeProxy } from '../fx.v4';

// ===== TYPES =====
interface ScoutOptions {
    cacheEnabled?: boolean;
    workerEnabled?: boolean;
    preloadEnabled?: boolean;
    maxCacheSize?: number;
    bundleOptimization?: boolean;
    maxDepth?: number;
    timeout?: number;
}

interface ModuleResult {
    exports: any;
    moduleTree: ModuleTree;
    loadOrder: LoadOrder[];
    moduleRegistry: Map<string, any>;
}

interface ModuleTree {
    url: string;
    content: string;
    dependencies: ModuleTree[];
    localDependencies: any[];
    fromCache?: boolean;
    size?: number;
    depth?: number;
    exports?: string[];
    error?: string;
    circular?: boolean;
}

interface LoadOrder {
    url: string;
    content: string;
    size: number;
    fromCache: boolean;
    exports?: string[];
    depth?: number;
}

interface FXComponent {
    url: string;
    type: 'fxc';
    sections: Record<string, any>;
    dependencies: any[];
}

// ===== WORKER BRIDGE =====
/**
 * Elegant bridge to worker using FX suspend/replay pattern
 * No async/await here - just throws FXSuspend when needed
 */
class WorkerBridge {
    private worker: Worker;
    private ready: boolean = false;
    private readyHandlers: Set<() => void> = new Set();
    private responseHandlers = new Map<number, {
        resolve: (v: any) => void;
        reject: (e: Error) => void;
    }>();
    
    constructor(workerCode: string) {
        // Create worker from code (already loaded via @)
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        this.worker = new Worker(URL.createObjectURL(blob));
        
        // Setup message handler
        this.worker.onmessage = (e: MessageEvent) => this.handleMessage(e.data);
        this.worker.onerror = (e: ErrorEvent) => this.handleError(e);
        
        // Wait for ready signal (will suspend if not immediate)
        this.ensureReady();
    }
    
    private handleMessage(data: any): void {
        // Ready signal
        if (data.type === 'ready') {
            this.ready = true;
            this.readyHandlers.forEach(h => h());
            this.readyHandlers.clear();
            return;
        }
        
        // Response to request
        const { id, success, result, error } = data;
        const handler = this.responseHandlers.get(id);
        
        if (!handler) return;
        
        this.responseHandlers.delete(id);
        
        if (success) {
            handler.resolve(result);
        } else {
            handler.reject(new Error(error || 'Worker request failed'));
        }
    }
    
    private handleError(error: ErrorEvent): void {
        console.error('[Scout Worker] Error:', error);
        // Reject all pending requests
        this.responseHandlers.forEach(({ reject }) => {
            reject(new Error('Worker crashed'));
        });
        this.responseHandlers.clear();
    }
    
    private ensureReady(): void {
        if (this.ready) return;
        
        // Create promise for ready state
        const readyPromise = new Promise<void>(resolve => {
            this.readyHandlers.add(resolve);
        });
        
        // SUSPEND until ready
        throw new (globalThis as any).FXSuspend(readyPromise);
    }
    
    /**
     * Request data from worker - SYNCHRONOUS from caller's perspective!
     * Throws FXSuspend if result not ready immediately
     */
    requestSync(type: string, url: string, options: any = {}): any {
        // Ensure worker is ready first
        this.ensureReady();
        
        const id = Date.now() + Math.random();
        
        // Create promise for result
        const resultPromise = new Promise((resolve, reject) => {
            this.responseHandlers.set(id, { resolve, reject });
            
            // Send request to worker
            this.worker.postMessage({ id, type, url, options });
            
            // Timeout handling
            const timeout = options.timeout || 30000;
            setTimeout(() => {
                if (this.responseHandlers.has(id)) {
                    this.responseHandlers.delete(id);
                    reject(new Error(`Worker timeout after ${timeout}ms`));
                }
            }, timeout);
        });
        
        // Try to check if resolved immediately (cache hit in worker)
        let result: any;
        let resolved = false;
        let error: any;
        
        resultPromise.then(
            r => { result = r; resolved = true; },
            e => { error = e; resolved = true; }
        );
        
        // If not resolved immediately, SUSPEND
        if (!resolved) {
            throw new (globalThis as any).FXSuspend(resultPromise);
        }
        
        // Was resolved immediately (cache hit) - return it!
        if (error) throw error;
        return result;
    }
    
    destroy(): void {
        this.responseHandlers.forEach(({ reject }) => {
            reject(new Error('Worker destroyed'));
        });
        this.responseHandlers.clear();
        this.readyHandlers.clear();
        
        if (this.worker) {
            this.worker.terminate();
        }
    }
}

// ===== MAIN SCOUT PLUGIN =====
export class FXScout {
    private fx: FXCore;
    private options: Required<ScoutOptions>;
    
    public readonly name = 'scout';
    public readonly version = '3.0.0';
    public readonly description = 'Zero-async module loader with deep dependency analysis';
    
    // State
    private bridge?: WorkerBridge;
    private moduleCache = new Map<string, any>();
    private componentCache = new Map<string, FXComponent>();
    private loadingSet = new Set<string>(); // Prevent duplicate concurrent loads
    
    constructor(fx: FXCore, options: ScoutOptions = {}) {
        this.fx = fx;
        this.options = {
            cacheEnabled: options.cacheEnabled ?? true,
            workerEnabled: options.workerEnabled ?? true,
            preloadEnabled: options.preloadEnabled ?? true,
            maxCacheSize: options.maxCacheSize ?? 100,
            bundleOptimization: options.bundleOptimization ?? true,
            maxDepth: options.maxDepth ?? 10,
            timeout: options.timeout ?? 30000
        };
        
        // Initialize worker if enabled
        if (this.options.workerEnabled) {
            this.initWorker();
        }
        
        console.log('[FX Scout] Plugin initialized', this.options);
    }
    
    private initWorker(): void {
        // Load worker code via FX's @ syntax
        // This may SUSPEND on first load - that's perfectly fine!
        // FX will replay this entire constructor when ready
        const workerCode = this.fx.moduleLoader.loadSync("/fx/FX TypeScript/plugins/workers/fx-scout-worker.ts");
        
        // Create bridge (may suspend again if worker not ready)
        this.bridge = new WorkerBridge(workerCode);
        
        console.log('[FX Scout] Worker bridge established');
    }
    
    // ===== PUBLIC SYNCHRONOUS API =====
    
    /**
     * Load module with full dependency resolution
     * SYNCHRONOUS from caller's perspective!
     */
    loadModule(url: string, options: Partial<ScoutOptions> = {}): any {
        const cacheKey = `module:${url}`;
        
        // Check main thread cache
        if (this.options.cacheEnabled && this.moduleCache.has(cacheKey)) {
            return this.moduleCache.get(cacheKey);
        }
        
        // Prevent duplicate concurrent loads
        if (this.loadingSet.has(cacheKey)) {
            // Already loading - use FX's built-in loader as fallback
            return this.fx.moduleLoader.loadSync(url);
        }
        
        this.loadingSet.add(cacheKey);
        
        try {
            // If no worker, fallback to FX's loader
            if (!this.bridge) {
                return this.fx.moduleLoader.loadSync(url);
            }
            
            // Request from worker (may SUSPEND!)
            const { moduleTree, loadOrder } = this.bridge.requestSync('loadModuleTree', url, {
                optimize: options.bundleOptimization ?? this.options.bundleOptimization,
                maxDepth: options.maxDepth ?? this.options.maxDepth,
                timeout: options.timeout ?? this.options.timeout
            });
            
            // Execute modules in dependency order
            const result = this.executeModules(loadOrder, moduleTree);
            
            // Cache result
            if (this.options.cacheEnabled) {
                this.cacheModule(cacheKey, result);
            }
            
            return result;
            
        } finally {
            this.loadingSet.delete(cacheKey);
        }
    }
    
    /**
     * Load FX Component (.fxc file)
     * SYNCHRONOUS from caller's perspective!
     */
    loadComponent(url: string): FXComponent {
        const cacheKey = `component:${url}`;
        
        // Check cache
        if (this.options.cacheEnabled && this.componentCache.has(cacheKey)) {
            return this.componentCache.get(cacheKey)!;
        }
        
        // Prevent duplicates
        if (this.loadingSet.has(cacheKey)) {
            const content = this.fx.moduleLoader.loadSync(url);
            return this.parseComponentSimple(content, url);
        }
        
        this.loadingSet.add(cacheKey);
        
        try {
            if (!this.bridge) {
                // Fallback: parse locally
                const content = this.fx.moduleLoader.loadSync(url);
                return this.parseComponentSimple(content, url);
            }
            
            // Request from worker (may SUSPEND!)
            const component = this.bridge.requestSync('loadComponent', url, {
                timeout: this.options.timeout
            });
            
            // Cache it
            if (this.options.cacheEnabled) {
                this.componentCache.set(cacheKey, component);
            }
            
            return component;
            
        } finally {
            this.loadingSet.delete(cacheKey);
        }
    }
    
    /**
     * Fetch raw content
     * SYNCHRONOUS from caller's perspective!
     */
    fetch(url: string): string {
        if (!this.bridge) {
            return this.fx.moduleLoader.loadSync(url);
        }
        
        // Request from worker (may SUSPEND!)
        const result = this.bridge.requestSync('fetchSync', url, {
            timeout: this.options.timeout
        });
        
        return result.content;
    }
    
    /**
     * Analyze module dependencies without executing
     * SYNCHRONOUS from caller's perspective!
     */
    analyze(url: string): {
        tree: ModuleTree;
        loadOrder: LoadOrder[];
        stats: {
            totalModules: number;
            totalSize: number;
            maxDepth: number;
            cacheHits: number;
        };
    } {
        if (!this.bridge) {
            return {
                tree: { url, content: '', dependencies: [], localDependencies: [] },
                loadOrder: [],
                stats: { totalModules: 0, totalSize: 0, maxDepth: 0, cacheHits: 0 }
            };
        }
        
        // Request from worker (may SUSPEND!)
        const { moduleTree, loadOrder } = this.bridge.requestSync('loadModuleTree', url, {
            optimize: this.options.bundleOptimization,
            maxDepth: this.options.maxDepth,
            timeout: this.options.timeout
        });
        
        const stats = {
            totalModules: loadOrder.length,
            totalSize: loadOrder.reduce((sum: number, m: any) => sum + m.size, 0),
            maxDepth: Math.max(...loadOrder.map((m: any) => m.depth || 0)),
            cacheHits: loadOrder.filter((m: any) => m.fromCache).length
        };
        
        return { tree: moduleTree, loadOrder, stats };
    }
    
    /**
     * Preload modules in background
     * Fire and forget - doesn't block
     */
    preload(...urls: string[]): void {
        if (!this.options.preloadEnabled || !this.bridge) return;
        
        console.log(`[FX Scout] Preloading ${urls.length} modules...`);
        
        // Try to load each (suspends will be caught and ignored)
        for (const url of urls) {
            try {
                if (url.endsWith('.fxc')) {
                    this.loadComponent(url);
                } else {
                    this.loadModule(url);
                }
            } catch (e) {
                // Ignore suspends during preload - it's background loading
                if (!(e as any)?.tag || (e as any).tag !== 'FX:SUSPEND') {
                    console.warn(`[FX Scout] Preload failed for ${url}:`, e);
                }
            }
        }
    }
    
    /**
     * Get statistics - SYNCHRONOUS!
     */
    getStats(): {
        mainThread: {
            moduleCache: number;
            componentCache: number;
            loadingInProgress: number;
        };
        worker?: any;
        options: Required<ScoutOptions>;
    } {
        const stats: any = {
            mainThread: {
                moduleCache: this.moduleCache.size,
                componentCache: this.componentCache.size,
                loadingInProgress: this.loadingSet.size
            },
            options: this.options
        };
        
        // Get worker stats (may SUSPEND!)
        if (this.bridge) {
            try {
                stats.worker = this.bridge.requestSync('getStats', '', {
                    timeout: 5000
                });
            } catch (e) {
                stats.worker = { error: 'Failed to get worker stats' };
            }
        }
        
        return stats;
    }
    
    /**
     * Clear caches - SYNCHRONOUS!
     */
    clearCache(type: 'all' | 'modules' | 'components' = 'all'): void {
        // Clear main thread caches
        if (type === 'all' || type === 'modules') {
            this.moduleCache.clear();
            console.log('[FX Scout] Module cache cleared');
        }
        
        if (type === 'all' || type === 'components') {
            this.componentCache.clear();
            console.log('[FX Scout] Component cache cleared');
        }
        
        // Clear worker cache (may SUSPEND but we don't care about result)
        if (this.bridge) {
            try {
                this.bridge.requestSync('clearCache', '', {
                    type,
                    timeout: 5000
                });
            } catch (e) {
                console.warn('[FX Scout] Worker cache clear failed:', e);
            }
        }
    }
    
    // ===== PRIVATE HELPERS =====
    
    private executeModules(loadOrder: LoadOrder[], tree: ModuleTree): ModuleResult {
        const moduleRegistry = new Map<string, any>();
        
        // Execute in dependency order
        for (const mod of loadOrder) {
            try {
                const exports = this.executeModule(mod.content, mod.url, moduleRegistry);
                moduleRegistry.set(mod.url, exports);
            } catch (error) {
                console.error(`[FX Scout] Failed to execute ${mod.url}:`, error);
                throw error;
            }
        }
        
        return {
            exports: moduleRegistry.get(tree.url),
            moduleTree: tree,
            loadOrder,
            moduleRegistry
        };
    }
    
    private executeModule(content: string, url: string, registry: Map<string, any>): any {
        const module: { exports: any } = { exports: {} };
        const exports = module.exports;
        
        // Provide require function
        const require = (path: string) => {
            const resolved = new URL(path, url).href;
            if (registry.has(resolved)) {
                return registry.get(resolved);
            }
            throw new Error(`Module not found: ${path} (required from ${url})`);
        };
        
        try {
            // Execute module code
            const fn = new Function('module', 'exports', 'require', 'fx', 'console', content);
            fn.call(exports, module, exports, require, this.fx, console);
            
            // Return default export or entire exports object
            return (module.exports as any)?.default ?? module.exports;
            
        } catch (error) {
            console.error(`[FX Scout] Execution error in ${url}:`, error);
            throw error;
        }
    }
    
    private parseComponentSimple(content: string, url: string): FXComponent {
        const sections: Record<string, any> = {};
        
        // Extract YAML metadata
        const metaMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (metaMatch) {
            sections.metadata = this.parseYAML(metaMatch[1]);
            content = content.replace(metaMatch[0], '').trim();
        }
        
        // Extract sections (--- sectionName)
        const sectionRe = /^---\s*(\w+)\s*\n([\s\S]*?)(?=\n---\s*\w+|$)/gm;
        let match;
        
        while ((match = sectionRe.exec(content)) !== null) {
            const [, sectionName, sectionContent] = match;
            sections[sectionName] = sectionContent.trim();
        }
        
        return {
            url,
            type: 'fxc',
            sections,
            dependencies: []
        };
    }
    
    private parseYAML(yaml: string): Record<string, any> {
        const result: Record<string, any> = {};
        
        yaml.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            
            const idx = trimmed.indexOf(':');
            if (idx > -1) {
                const key = trimmed.substring(0, idx).trim();
                const val = trimmed.substring(idx + 1).trim();
                
                // Parse value
                if (val === 'true') result[key] = true;
                else if (val === 'false') result[key] = false;
                else if (val === 'null') result[key] = null;
                else if (/^\d+$/.test(val)) result[key] = parseInt(val);
                else if (/^\d*\.\d+$/.test(val)) result[key] = parseFloat(val);
                else result[key] = val.replace(/^['"]|['"]$/g, '');
            }
        });
        
        return result;
    }
    
    private cacheModule(key: string, result: any): void {
        // FIFO eviction if cache full
        if (this.moduleCache.size >= this.options.maxCacheSize) {
            const first = this.moduleCache.keys().next();
            if (!first.done) {
                this.moduleCache.delete(first.value);
            }
        }
        
        this.moduleCache.set(key, result);
    }
    
    destroy(): void {
        this.moduleCache.clear();
        this.componentCache.clear();
        this.loadingSet.clear();
        
        if (this.bridge) {
            this.bridge.destroy();
        }
        
        console.log('[FX Scout] Plugin destroyed');
    }
}

// ===== PLUGIN FACTORY =====
export default function(fx: FXCore, options?: ScoutOptions): FXScout {
    return new FXScout(fx, options);
}