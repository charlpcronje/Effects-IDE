// /workers/fx-scout.worker.ts
/**
 * FX Scout Worker - Complete Module Loading Infrastructure
 * Lives in Web Worker - async/await is perfectly fine here!
 * All the power, properly placed.
 */

// ===== LOGGER =====
class ScoutLogger {
    private static logBuffer: Array<any> = [];
    private static maxBufferSize = 100;
    
    static log(level: string, message: string, data: any = {}): void {
        const entry = { 
            level: level.toUpperCase(), 
            message, 
            data, 
            timestamp: Date.now() 
        };
        this.logBuffer.push(entry);
        if (this.logBuffer.length > this.maxBufferSize) {
            this.logBuffer.shift();
        }
        console.log(`[SCOUT:${entry.level}]`, message, data);
    }
    
    static error(message: string, error: any): void { 
        this.log('error', message, { error: error?.message || error }); 
    }
    static warn(message: string, data?: any): void { this.log('warn', message, data); }
    static info(message: string, data?: any): void { this.log('info', message, data); }
    static debug(message: string, data?: any): void { this.log('debug', message, data); }
    
    static getBuffer(): typeof ScoutLogger.logBuffer {
        return [...this.logBuffer];
    }
    
    static clear(): void {
        this.logBuffer = [];
    }
}

// ===== INTERFACES =====
interface FXComponentSection {
    metadata?: Record<string, any>;
    template?: string;
    style?: string;
    script?: string;
    data?: string;
    [key: string]: any;
}

interface FXComponent {
    url: string;
    type: 'fxc';
    sections: FXComponentSection;
    dependencies: ModuleDependency[];
}

interface ModuleDependency {
    path: string;
    resolvedUrl: string;
    type: string;
    baseUrl: string;
}

interface ModuleTree {
    url: string;
    content: string;
    dependencies: ModuleTree[];
    localDependencies: ModuleDependency[];
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

// ===== WORKER MODULE LOADER =====
class WorkerModuleLoader {
    private moduleCache = new Map<string, string>();
    private treeCache = new Map<string, ModuleTree>();
    private componentCache = new Map<string, FXComponent>();
    private dependencyGraph = new Map<string, string[]>();
    private stats = { 
        hits: 0, 
        misses: 0, 
        loads: 0,
        components: 0,
        errors: 0 
    };
    
    // Regex patterns
    private importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|[\w$]+)\s+from\s+)?['"`]([^'"`]+)['"`]/g;
    private requireRegex = /require\s*\(['"`]([^'"`]+)['"`]\)/g;
    private dynamicImportRegex = /import\s*\(['"`]([^'"`]+)['"`]\)/g;
    private fxComponentRegex = /<fx-component[^>]*src\s*=\s*['""]([^'"]+)['"]/g;
    private exportRegex = /export\s+(?:default\s+|(?:const|let|var|function|class)\s+)(\w+)/g;
    
    // ASYNC IS FINE IN WORKER!
    async fetchSync(url: string, options: any = {}): Promise<any> {
        try {
            if (this.moduleCache.has(url)) {
                this.stats.hits++;
                ScoutLogger.debug('Cache hit', { url });
                return {
                    content: this.moduleCache.get(url),
                    fromCache: true,
                    cacheHit: true
                };
            }

            this.stats.misses++;
            ScoutLogger.debug('Cache miss, fetching', { url });

            // Use fetch instead of deprecated synchronous XMLHttpRequest
            const fetchOptions: RequestInit = {
                method: 'GET',
                headers: options.headers || {}
            };

            const response = await fetch(url, fetchOptions);

            if (response.ok) {
                const content = await response.text();

                // Cache if under 5MB
                if (content.length < 5 * 1024 * 1024) {
                    this.moduleCache.set(url, content);
                }

                // Parse headers
                const headers: Record<string, string> = {};
                response.headers.forEach((value, key) => {
                    headers[key.toLowerCase()] = value;
                });

                return {
                    content,
                    fromCache: false,
                    status: response.status,
                    headers
                };
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error: any) {
            this.stats.errors++;
            ScoutLogger.error('Fetch failed', error);
            throw new Error(`Failed to fetch ${url}: ${error.message}`);
        }
    }


    async loadModuleTree(
        url: string, 
        visited: Set<string> = new Set(), 
        depth: number = 0, 
        maxDepth: number = 10
    ): Promise<ModuleTree> {
        // Check tree cache
        if (this.treeCache.has(url)) {
            ScoutLogger.debug('Tree cache hit', { url });
            return this.treeCache.get(url)!;
        }
        
        // Circular dependency detection
        if (visited.has(url)) {
            ScoutLogger.warn('Circular dependency detected', { url });
            return {
                url,
                content: '',
                dependencies: [],
                localDependencies: [],
                circular: true,
                error: 'Circular dependency detected'
            };
        }

        // Max depth check
        if (depth > maxDepth) {
            ScoutLogger.warn('Max depth exceeded', { url, depth });
            return {
                url,
                content: '',
                dependencies: [],
                localDependencies: [],
                error: 'Max depth exceeded'
            };
        }

        visited.add(url);
        this.stats.loads++;

        try {
            const { content, fromCache } = await this.fetchSync(url);
            const dependencies = this.extractDependencies(content, url);
            const exports = this.extractExports(content);
            
            ScoutLogger.info('Loading module tree', { 
                url, 
                depth, 
                depCount: dependencies.length,
                fromCache 
            });
            
            const resolvedDeps: ModuleTree[] = [];
            for (const dep of dependencies) {
                const resolved = await this.loadModuleTree(
                    dep.resolvedUrl, 
                    new Set(visited), 
                    depth + 1,
                    maxDepth
                );
                resolvedDeps.push(resolved);
            }

            // Store in dependency graph
            this.dependencyGraph.set(url, dependencies.map(d => d.resolvedUrl));

            const tree: ModuleTree = {
                url,
                content,
                dependencies: resolvedDeps,
                localDependencies: dependencies,
                fromCache,
                size: content.length,
                exports,
                depth
            };
            
            // Cache the tree
            this.treeCache.set(url, tree);
            
            return tree;
        } catch (error: any) {
            this.stats.errors++;
            ScoutLogger.error('Module tree load failed', error);
            return {
                url,
                content: '',
                dependencies: [],
                localDependencies: [],
                error: error.message
            };
        }
    }

    extractDependencies(content: string, baseUrl: string): ModuleDependency[] {
        const dependencies: ModuleDependency[] = [];
        const seen = new Set<string>();

        const addDependency = (path: string, type: string) => {
            if (seen.has(path)) return;
            seen.add(path);

            const resolvedUrl = this.resolveUrl(path, baseUrl);
            if (resolvedUrl && this.isLocalModule(resolvedUrl)) {
                dependencies.push({
                    path,
                    resolvedUrl,
                    type,
                    baseUrl
                });
            }
        };

        // ES6 imports
        this.importRegex.lastIndex = 0;
        let match;
        while ((match = this.importRegex.exec(content)) !== null) {
            addDependency(match[1], 'import');
        }

        // CommonJS requires
        this.requireRegex.lastIndex = 0;
        while ((match = this.requireRegex.exec(content)) !== null) {
            addDependency(match[1], 'require');
        }

        // Dynamic imports
        this.dynamicImportRegex.lastIndex = 0;
        while ((match = this.dynamicImportRegex.exec(content)) !== null) {
            addDependency(match[1], 'dynamic');
        }

        // FX component references
        this.fxComponentRegex.lastIndex = 0;
        while ((match = this.fxComponentRegex.exec(content)) !== null) {
            addDependency(match[1], 'component');
        }

        return dependencies;
    }

    extractExports(content: string): string[] {
        const exports: string[] = [];
        let match;
        this.exportRegex.lastIndex = 0;
        while ((match = this.exportRegex.exec(content)) !== null) {
            exports.push(match[1] || 'default');
        }
        return exports;
    }

    resolveUrl(importPath: string, baseUrl: string): string | null {
        try {
            if (importPath.startsWith('http') || importPath.startsWith('//')) {
                return importPath;
            }
            
            if (importPath.startsWith('./') || importPath.startsWith('../')) {
                return new URL(importPath, baseUrl).href;
            }
            
            if (importPath.startsWith('/')) {
                const base = new URL(baseUrl);
                return `${base.protocol}//${base.host}${importPath}`;
            }
            
            // Node module or CDN - skip for now
            return null;
        } catch (error) {
            ScoutLogger.warn('URL resolution failed', { importPath, baseUrl });
            return null;
        }
    }

    isLocalModule(url: string): boolean {
        try {
            const urlObj = new URL(url);
            const currentOrigin = self.location?.origin || 'http://localhost';
            return urlObj.origin === currentOrigin || 
                   url.startsWith('./') || 
                   url.startsWith('../') ||
                   url.startsWith('/');
        } catch {
            return false;
        }
    }

    buildLoadOrder(moduleTree: ModuleTree): LoadOrder[] {
        const loadOrder: LoadOrder[] = [];
        const visited = new Set<string>();

        const visit = (module: ModuleTree) => {
            if (visited.has(module.url) || module.error || module.circular) return;
            visited.add(module.url);

            // Visit dependencies first (depth-first)
            module.dependencies.forEach(dep => visit(dep));
            
            // Then add this module
            loadOrder.push({
                url: module.url,
                content: module.content,
                size: module.size || 0,
                fromCache: module.fromCache || false,
                exports: module.exports,
                depth: module.depth
            });
        };

        visit(moduleTree);
        return loadOrder;
    }

    optimizeBundle(loadOrder: LoadOrder[]): LoadOrder[] {
        // Sort by depth (deepest first) and size (smallest first)
        return loadOrder.sort((a, b) => {
            if (a.depth !== b.depth) return (b.depth || 0) - (a.depth || 0);
            return a.size - b.size;
        });
    }

    // ===== FX COMPONENT SUPPORT =====
    async loadFXComponent(url: string): Promise<FXComponent> {
        // Check cache
        if (this.componentCache.has(url)) {
            ScoutLogger.debug('Component cache hit', { url });
            return this.componentCache.get(url)!;
        }
        
        try {
            this.stats.components++;
            const { content } = await this.fetchSync(url);
            const component = this.parseFXComponent(content, url);
            
            // Cache it
            this.componentCache.set(url, component);
            
            ScoutLogger.info('FX component loaded', { url });
            return component;
        } catch (error: any) {
            this.stats.errors++;
            ScoutLogger.error('Component load failed', error);
            throw new Error(`Failed to load FX component ${url}: ${error.message}`);
        }
    }

    parseFXComponent(content: string, url: string): FXComponent {
        const sections: FXComponentSection = {};
        
        // Extract metadata (YAML frontmatter)
        const metadataMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (metadataMatch) {
            sections.metadata = this.parseYAML(metadataMatch[1]);
            content = content.replace(metadataMatch[0], '').trim();
        }
        
        // Extract sections (--- sectionName)
        const sectionRegex = /^---\s*(\w+)\s*\n([\s\S]*?)(?=\n---\s*\w+|$)/gm;
        let match;
        
        while ((match = sectionRegex.exec(content)) !== null) {
            const [, sectionName, sectionContent] = match;
            sections[sectionName] = sectionContent.trim();
        }
        
        // Extract dependencies from all sections
        const allContent = Object.values(sections).join('\n');
        const dependencies = this.extractDependencies(allContent, url);
        
        return {
            url,
            type: 'fxc',
            sections,
            dependencies
        };
    }

    parseYAML(yamlStr: string): Record<string, any> {
        const result: Record<string, any> = {};
        const lines = yamlStr.split('\n');
        let currentIndent = 0;
        let currentObj: any = result;
        const stack: any[] = [result];
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            
            const indent = line.length - line.trimStart().length;
            const colonIndex = trimmed.indexOf(':');
            
            if (colonIndex > -1) {
                const key = trimmed.substring(0, colonIndex).trim();
                const value = trimmed.substring(colonIndex + 1).trim();
                
                // Handle nested objects
                if (indent > currentIndent) {
                    currentIndent = indent;
                    currentObj = stack[stack.length - 1];
                } else if (indent < currentIndent) {
                    while (stack.length > 1 && indent < currentIndent) {
                        stack.pop();
                        currentIndent -= 2;
                    }
                    currentObj = stack[stack.length - 1];
                }
                
                // Parse value
                if (!value) {
                    currentObj[key] = {};
                    stack.push(currentObj[key]);
                } else if (value === 'true') {
                    currentObj[key] = true;
                } else if (value === 'false') {
                    currentObj[key] = false;
                } else if (value === 'null') {
                    currentObj[key] = null;
                } else if (/^\d+$/.test(value)) {
                    currentObj[key] = parseInt(value);
                } else if (/^\d*\.\d+$/.test(value)) {
                    currentObj[key] = parseFloat(value);
                } else if (value.startsWith('[') && value.endsWith(']')) {
                    try {
                        currentObj[key] = JSON.parse(value);
                    } catch {
                        currentObj[key] = value;
                    }
                } else {
                    currentObj[key] = value.replace(/^['"]|['"]$/g, '');
                }
            }
        }
        
        return result;
    }

    getStats() {
        return {
            cacheSize: this.moduleCache.size,
            treeCacheSize: this.treeCache.size,
            componentCacheSize: this.componentCache.size,
            dependencyGraphSize: this.dependencyGraph.size,
            stats: this.stats,
            logs: ScoutLogger.getBuffer()
        };
    }

    clearCache(type?: 'all' | 'modules' | 'trees' | 'components') {
        switch (type) {
            case 'modules':
                this.moduleCache.clear();
                break;
            case 'trees':
                this.treeCache.clear();
                break;
            case 'components':
                this.componentCache.clear();
                break;
            case 'all':
            default:
                this.moduleCache.clear();
                this.treeCache.clear();
                this.componentCache.clear();
                this.dependencyGraph.clear();
        }
        ScoutLogger.info('Cache cleared', { type });
    }
}

// ===== WORKER INSTANCE =====
const loader = new WorkerModuleLoader();

// ===== MESSAGE HANDLER =====
self.onmessage = async (e: MessageEvent) => {
    const { type, url, options, id } = e.data;
    
    try {
        let result: any;
        
        switch (type) {
            case 'fetchSync':
                result = await loader.fetchSync(url, options);
                break;
                
            case 'loadModuleTree':
                const moduleTree = await loader.loadModuleTree(
                    url, 
                    new Set(), 
                    0, 
                    options?.maxDepth || 10
                );
                const loadOrder = loader.buildLoadOrder(moduleTree);
                const optimized = options?.optimize ? 
                    loader.optimizeBundle(loadOrder) : loadOrder;
                result = { moduleTree, loadOrder: optimized };
                break;
                
            case 'loadFXComponent':
                result = await loader.loadFXComponent(url);
                break;
                
            case 'getStats':
                result = loader.getStats();
                break;
                
            case 'clearCache':
                loader.clearCache(options?.type);
                result = { cleared: true, type: options?.type || 'all' };
                break;
                
            default:
                throw new Error(`Unknown request type: ${type}`);
        }
        
        self.postMessage({
            id,
            success: true,
            result
        });
        
    } catch (error: any) {
        ScoutLogger.error('Worker request failed', error);
        self.postMessage({
            id,
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
};

// Signal ready
ScoutLogger.info('FX Scout Worker initialized');
self.postMessage({ type: 'ready' });