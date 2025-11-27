/**
 * FX Scout Manifest Integration Test
 * Tests integration with .fxrc.json manifest system
 * Tests lazy loading, callbacks, and configuration
 */

import type { FXCore } from '../../fx.v4';
import { FXScout } from '../fx-scout';
import * as fs from 'fs';

// Manifest-aware Mock FX Core
class MockFXCoreWithManifest implements Partial<FXCore> {
    private manifest: any;
    private loadedModules = new Set<string>();

    constructor() {
        // Load manifest
        this.manifest = {
            name: "fx-scout-test-manifest",
            version: "1.0.0",
            plugins: [
                {
                    name: "scout",
                    enabled: true,
                    options: {
                        cacheEnabled: true,
                        workerEnabled: true,
                        maxDepth: 15,
                        maxCacheSize: 200
                    }
                }
            ],
            modules: {
                lazyLoad: true,
                preload: ["./modules/module-c.js"],
                aliases: {
                    "@utils": "./modules/module-c.js",
                    "@components": "./modules/"
                }
            },
            dependencies: [
                {
                    name: "module-a",
                    path: "./modules/module-a.js",
                    lazy: false
                },
                {
                    name: "module-b",
                    path: "./modules/module-b.js",
                    lazy: true,
                    onLoad: "console.log('Module B loaded via manifest');"
                },
                {
                    name: "test-component",
                    path: "./modules/test-component.fxc",
                    type: "component",
                    lazy: true
                }
            ],
            hooks: {
                afterModuleLoad: [
                    {
                        module: "module-a",
                        callback: "console.log('Module A loaded, running hook');"
                    }
                ],
                beforeComponentLoad: [
                    {
                        component: "test-component",
                        callback: "console.log('About to load test component');"
                    }
                ]
            },
            optimization: {
                bundleModules: true,
                minify: false,
                treeshake: true
            }
        };
    }

    getManifest() {
        return this.manifest;
    }

    moduleLoader = {
        loadSync: (path: string) => {
            // Track loaded modules
            this.loadedModules.add(path);

            // Mock worker code
            if (path.includes('fx-scout-worker')) {
                return this.getMockWorkerCode();
            }

            // Mock module content based on path
            if (path.includes('module-a')) {
                return `
                    export function greetFromA() { return "Hello from A"; }
                    export default { greetFromA };
                `;
            }
            if (path.includes('module-b')) {
                return `
                    export function greetFromB() { return "Hello from B"; }
                    export default { greetFromB };
                `;
            }
            if (path.includes('module-c')) {
                return `
                    export function utilityC() { return "Utility C"; }
                    export default { utilityC };
                `;
            }
            if (path.endsWith('.fxc')) {
                return `
                    ---
                    name: test-component
                    version: 1.0.0
                    ---
                    --- template
                    <div>Component</div>
                    --- script
                    export default {};
                `;
            }

            return `export default { mock: true, path: '${path}' };`;
        }
    };

    private getMockWorkerCode(): string {
        return `
            self.postMessage({ type: 'ready' });
            self.onmessage = (e) => {
                const { id, type, url, options } = e.data;
                let result = {};

                switch (type) {
                    case 'loadModuleTree':
                        result = {
                            moduleTree: { url, content: 'mock', dependencies: [], localDependencies: [] },
                            loadOrder: [{ url, content: 'mock', size: 100, fromCache: false }]
                        };
                        break;
                    case 'loadComponent':
                        result = {
                            url,
                            type: 'fxc',
                            sections: { metadata: {}, template: '', script: '' },
                            dependencies: []
                        };
                        break;
                    case 'fetchSync':
                        result = { content: 'mock content', fromCache: false };
                        break;
                    case 'getStats':
                        result = { cacheSize: 0, stats: {} };
                        break;
                    case 'clearCache':
                        result = { cleared: true };
                        break;
                }

                self.postMessage({ id, success: true, result });
            };
        `;
    }

    isModuleLoaded(path: string): boolean {
        return this.loadedModules.has(path);
    }
}

// Manifest-aware FX Scout Extension
class ManifestAwareFXScout extends FXScout {
    private manifest: any;
    private lazyModules = new Map<string, () => any>();
    private hooks = new Map<string, Function[]>();

    constructor(fx: FXCore & { getManifest?: () => any }, options?: any) {
        // Use manifest options if available
        const manifestOptions = fx.getManifest?.()?.plugins?.find((p: any) => p.name === 'scout')?.options;
        super(fx, { ...manifestOptions, ...options });

        this.manifest = fx.getManifest?.();
        this.initializeFromManifest();
    }

    private initializeFromManifest(): void {
        if (!this.manifest) return;

        // Register lazy modules
        this.manifest.dependencies?.forEach((dep: any) => {
            if (dep.lazy) {
                this.lazyModules.set(dep.name, () => {
                    console.log(`[Manifest] Lazy loading: ${dep.name}`);

                    // Execute onLoad callback if present
                    if (dep.onLoad) {
                        try {
                            new Function(dep.onLoad)();
                        } catch (e) {
                            console.error(`[Manifest] onLoad callback error:`, e);
                        }
                    }

                    // Load based on type
                    if (dep.type === 'component') {
                        return this.loadComponent(dep.path);
                    } else {
                        return this.loadModule(dep.path);
                    }
                });
            }
        });

        // Register hooks
        if (this.manifest.hooks) {
            // After module load hooks
            this.manifest.hooks.afterModuleLoad?.forEach((hook: any) => {
                const hooks = this.hooks.get(`afterModule:${hook.module}`) || [];
                hooks.push(new Function(hook.callback));
                this.hooks.set(`afterModule:${hook.module}`, hooks);
            });

            // Before component load hooks
            this.manifest.hooks.beforeComponentLoad?.forEach((hook: any) => {
                const hooks = this.hooks.get(`beforeComponent:${hook.component}`) || [];
                hooks.push(new Function(hook.callback));
                this.hooks.set(`beforeComponent:${hook.component}`, hooks);
            });
        }

        // Preload modules if specified
        if (this.manifest.modules?.preload) {
            console.log(`[Manifest] Preloading ${this.manifest.modules.preload.length} modules...`);
            this.preload(...this.manifest.modules.preload);
        }

        // Load non-lazy dependencies immediately
        this.manifest.dependencies?.forEach((dep: any) => {
            if (!dep.lazy) {
                console.log(`[Manifest] Loading immediate dependency: ${dep.name}`);
                try {
                    if (dep.type === 'component') {
                        this.loadComponent(dep.path);
                    } else {
                        this.loadModule(dep.path);
                    }
                } catch (e) {
                    console.error(`[Manifest] Failed to load ${dep.name}:`, e);
                }
            }
        });
    }

    // Get lazy module loader
    getLazyModule(name: string): (() => any) | undefined {
        return this.lazyModules.get(name);
    }

    // Resolve alias from manifest
    resolveAlias(alias: string): string | undefined {
        if (!this.manifest?.modules?.aliases) return undefined;
        return this.manifest.modules.aliases[alias];
    }

    // Override loadModule to support hooks
    loadModule(url: string, options?: any): any {
        // Check for alias
        const resolved = this.resolveAlias(url) || url;

        // Extract module name for hooks
        const moduleName = resolved.split('/').pop()?.replace(/\.(js|ts|mjs)$/, '');

        const result = super.loadModule(resolved, options);

        // Run after hooks
        const hooks = this.hooks.get(`afterModule:${moduleName}`);
        if (hooks) {
            hooks.forEach(hook => {
                try {
                    hook();
                } catch (e) {
                    console.error(`[Manifest] Hook error:`, e);
                }
            });
        }

        return result;
    }

    // Override loadComponent to support hooks
    loadComponent(url: string): any {
        // Extract component name for hooks
        const componentName = url.split('/').pop()?.replace(/\.fxc$/, '');

        // Run before hooks
        const hooks = this.hooks.get(`beforeComponent:${componentName}`);
        if (hooks) {
            hooks.forEach(hook => {
                try {
                    hook();
                } catch (e) {
                    console.error(`[Manifest] Hook error:`, e);
                }
            });
        }

        return super.loadComponent(url);
    }
}

// Test runner for manifest integration
export async function runManifestTests(): Promise<void> {
    console.log('\n📋 Starting Manifest Integration Tests');
    console.log('=' .repeat(60));

    const mockFX = new MockFXCoreWithManifest() as FXCore & { getManifest: () => any; isModuleLoaded: (path: string) => boolean };
    let testsPassed = 0;
    let testsFailed = 0;

    // Test 1: Scout initialization from manifest
    console.log('\n⏳ Test 1: Scout initialization from manifest options');
    try {
        const scout = new ManifestAwareFXScout(mockFX);

        const stats = scout.getStats();

        if (stats.options.maxDepth === 15 && stats.options.maxCacheSize === 200) {
            console.log('✅ PASS: Scout initialized with manifest options');
            console.log('   - Max depth:', stats.options.maxDepth);
            console.log('   - Max cache size:', stats.options.maxCacheSize);
            testsPassed++;
        } else {
            console.log('❌ FAIL: Manifest options not applied');
            testsFailed++;
        }
    } catch (error) {
        console.error('❌ FAIL: Initialization error:', error);
        testsFailed++;
    }

    // Test 2: Non-lazy module loading
    console.log('\n⏳ Test 2: Non-lazy module auto-loading');
    try {
        const scout = new ManifestAwareFXScout(mockFX, { workerEnabled: false });

        // Give time for initialization
        await new Promise(resolve => setTimeout(resolve, 50));

        // Check if module-a was loaded (it's non-lazy in manifest)
        if (mockFX.isModuleLoaded('./modules/module-a.js')) {
            console.log('✅ PASS: Non-lazy module loaded automatically');
            testsPassed++;
        } else {
            console.log('❌ FAIL: Non-lazy module not loaded');
            testsFailed++;
        }
    } catch (error) {
        console.error('❌ FAIL: Non-lazy loading error:', error);
        testsFailed++;
    }

    // Test 3: Lazy module registration
    console.log('\n⏳ Test 3: Lazy module registration');
    try {
        const scout = new ManifestAwareFXScout(mockFX, { workerEnabled: false });

        const lazyLoader = scout.getLazyModule('module-b');

        if (lazyLoader && typeof lazyLoader === 'function') {
            console.log('✅ PASS: Lazy module registered');

            // Test lazy loading
            const result = lazyLoader();
            if (result) {
                console.log('   - Lazy module loaded on demand');
            }
            testsPassed++;
        } else {
            console.log('❌ FAIL: Lazy module not registered');
            testsFailed++;
        }
    } catch (error) {
        console.error('❌ FAIL: Lazy module error:', error);
        testsFailed++;
    }

    // Test 4: Alias resolution
    console.log('\n⏳ Test 4: Module alias resolution');
    try {
        const scout = new ManifestAwareFXScout(mockFX, { workerEnabled: false });

        const resolved = scout.resolveAlias('@utils');

        if (resolved === './modules/module-c.js') {
            console.log('✅ PASS: Alias resolved correctly');
            console.log('   - @utils -> ./modules/module-c.js');

            // Test loading via alias
            const result = scout.loadModule('@utils');
            if (result) {
                console.log('   - Module loaded via alias');
            }
            testsPassed++;
        } else {
            console.log('❌ FAIL: Alias not resolved');
            testsFailed++;
        }
    } catch (error) {
        console.error('❌ FAIL: Alias resolution error:', error);
        testsFailed++;
    }

    // Test 5: Preload from manifest
    console.log('\n⏳ Test 5: Module preloading from manifest');
    try {
        const scout = new ManifestAwareFXScout(mockFX, { workerEnabled: false });

        // Give time for preload
        await new Promise(resolve => setTimeout(resolve, 50));

        const stats = scout.getStats();

        // Check if preload happened (module-c should be in cache)
        if (stats.mainThread.moduleCache > 0) {
            console.log('✅ PASS: Modules preloaded from manifest');
            console.log('   - Modules in cache:', stats.mainThread.moduleCache);
            testsPassed++;
        } else {
            console.log('❌ FAIL: Preload did not occur');
            testsFailed++;
        }
    } catch (error) {
        console.error('❌ FAIL: Preload error:', error);
        testsFailed++;
    }

    // Test 6: Hooks execution
    console.log('\n⏳ Test 6: Hook execution on module load');
    try {
        const scout = new ManifestAwareFXScout(mockFX, { workerEnabled: false });

        // Capture console output
        const originalLog = console.log;
        let hookExecuted = false;
        console.log = (msg: string) => {
            if (msg.includes('Module A loaded, running hook')) {
                hookExecuted = true;
            }
            originalLog(msg);
        };

        // Load module-a (should trigger afterModuleLoad hook)
        scout.loadModule('./modules/module-a.js');

        // Restore console.log
        console.log = originalLog;

        if (hookExecuted) {
            console.log('✅ PASS: afterModuleLoad hook executed');
            testsPassed++;
        } else {
            console.log('❌ FAIL: Hook not executed');
            testsFailed++;
        }
    } catch (error) {
        console.error('❌ FAIL: Hook execution error:', error);
        testsFailed++;
    }

    // Test 7: Component lazy loading
    console.log('\n⏳ Test 7: Component lazy loading from manifest');
    try {
        const scout = new ManifestAwareFXScout(mockFX, { workerEnabled: false });

        const lazyComponentLoader = scout.getLazyModule('test-component');

        if (lazyComponentLoader && typeof lazyComponentLoader === 'function') {
            console.log('✅ PASS: Lazy component registered');

            // Test lazy loading
            const component = lazyComponentLoader();
            if (component && component.type === 'fxc') {
                console.log('   - Component loaded on demand');
                console.log('   - Type:', component.type);
            }
            testsPassed++;
        } else {
            console.log('❌ FAIL: Lazy component not registered');
            testsFailed++;
        }
    } catch (error) {
        console.error('❌ FAIL: Component lazy loading error:', error);
        testsFailed++;
    }

    // Summary
    console.log('\n' + '=' .repeat(60));
    console.log('MANIFEST INTEGRATION TEST RESULTS');
    console.log('=' .repeat(60));
    console.log(`Total: ${testsPassed + testsFailed} | Passed: ${testsPassed} | Failed: ${testsFailed}`);
    console.log(`Result: ${testsFailed === 0 ? '🎉 ALL TESTS PASSED!' : '⚠️ SOME TESTS FAILED'}`);
    console.log('=' .repeat(60) + '\n');
}

// Export for use
export default runManifestTests;

// Auto-run if executed directly
if (typeof window !== 'undefined' && (window as any).runManifestTests) {
    runManifestTests();
}