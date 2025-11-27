/**
 * FX Scout Nested Module Loading Test
 * Tests deep dependency resolution (3+ levels)
 * Tests circular dependency handling
 * Tests both worker and non-worker modes
 */

import type { FXCore } from '../../fx.v4';
import { FXScout } from '../fx-scout';

// Enhanced Mock FX Core that simulates real module loading
class MockFXCoreWithModules implements Partial<FXCore> {
    private moduleContents = new Map<string, string>();

    constructor() {
        // Setup mock module contents
        this.setupMockModules();
    }

    private setupMockModules(): void {
        // Worker code
        this.moduleContents.set('/fx/FX TypeScript/plugins/workers/fx-scout-worker.ts',
            this.getMockWorkerCode());

        // Test modules with nested imports
        this.moduleContents.set('/test/module-a.js', `
            import { greetFromB } from './module-b.js';
            import { utilityC } from './module-c.js';

            export function greetFromA() {
                return "Hello from Module A";
            }

            export function callNestedGreeting() {
                return "Module A calling: " + greetFromB();
            }

            export function useUtility() {
                return "Module A using: " + utilityC();
            }
        `);

        this.moduleContents.set('/test/module-b.js', `
            import { utilityC, helperC } from './module-c.js';

            export function greetFromB() {
                return "Hello from Module B";
            }

            export function callDeeperNesting() {
                return "Module B calling: " + utilityC();
            }

            export function useHelper() {
                return "Module B helper: " + helperC();
            }
        `);

        this.moduleContents.set('/test/module-c.js', `
            export function utilityC() {
                return "Utility from Module C";
            }

            export function helperC() {
                return "Helper from Module C";
            }

            export const constantC = "CONSTANT_FROM_C";
        `);

        // Circular dependency modules
        this.moduleContents.set('/test/circular-a.js', `
            import { functionFromB } from './circular-b.js';

            export function functionFromA() {
                return "Function from Circular A";
            }

            export function callB() {
                return functionFromB();
            }
        `);

        this.moduleContents.set('/test/circular-b.js', `
            import { functionFromA } from './circular-a.js';

            export function functionFromB() {
                return "Function from Circular B";
            }

            export function callA() {
                return functionFromA();
            }
        `);
    }

    private getMockWorkerCode(): string {
        return `
            // Mock worker that simulates real behavior
            const cache = new Map();
            const moduleTree = {};

            self.postMessage({ type: 'ready' });

            self.onmessage = async (e) => {
                const { id, type, url, options } = e.data;

                try {
                    let result;

                    switch (type) {
                        case 'fetchSync':
                            result = {
                                content: 'mock content for ' + url,
                                fromCache: cache.has(url)
                            };
                            cache.set(url, result);
                            break;

                        case 'loadModuleTree':
                            // Simulate module tree loading
                            result = {
                                moduleTree: {
                                    url,
                                    content: 'module content',
                                    dependencies: [
                                        {
                                            url: url + '/dep1',
                                            content: 'dep1 content',
                                            dependencies: [
                                                {
                                                    url: url + '/dep1/dep2',
                                                    content: 'dep2 content',
                                                    dependencies: [],
                                                    localDependencies: [],
                                                    depth: 2
                                                }
                                            ],
                                            localDependencies: [],
                                            depth: 1
                                        }
                                    ],
                                    localDependencies: [],
                                    depth: 0
                                },
                                loadOrder: [
                                    { url: url + '/dep1/dep2', content: 'dep2', size: 100, fromCache: false, depth: 2 },
                                    { url: url + '/dep1', content: 'dep1', size: 200, fromCache: false, depth: 1 },
                                    { url: url, content: 'root', size: 300, fromCache: false, depth: 0 }
                                ]
                            };
                            break;

                        case 'loadComponent':
                            result = {
                                url,
                                type: 'fxc',
                                sections: {
                                    metadata: { name: 'test', version: '1.0.0' },
                                    template: '<div>Test</div>',
                                    script: 'export default {}',
                                    style: '.test { color: red; }'
                                },
                                dependencies: []
                            };
                            break;

                        case 'getStats':
                            result = {
                                cacheSize: cache.size,
                                stats: { hits: 0, misses: 0, loads: 0 }
                            };
                            break;

                        case 'clearCache':
                            cache.clear();
                            result = { cleared: true };
                            break;

                        default:
                            throw new Error('Unknown type: ' + type);
                    }

                    self.postMessage({ id, success: true, result });
                } catch (error) {
                    self.postMessage({ id, success: false, error: error.message });
                }
            };
        `;
    }

    moduleLoader = {
        loadSync: (path: string) => {
            const content = this.moduleContents.get(path);
            if (content) {
                return content;
            }
            // Return generic mock for unknown modules
            return `export default { mock: true, path: '${path}' };`;
        }
    };
}

// Test runner for nested module loading
export async function runNestedLoadingTests(): Promise<void> {
    console.log('\n🔍 Starting Nested Module Loading Tests');
    console.log('=' .repeat(60));

    const mockFX = new MockFXCoreWithModules() as FXCore;
    let testsPassed = 0;
    let testsFailed = 0;

    // Test 1: Load module with 3+ levels of nesting (worker mode)
    console.log('\n⏳ Test 1: Deep nested module loading (with worker)');
    try {
        const scout = new FXScout(mockFX, {
            workerEnabled: true,
            maxDepth: 10
        });

        // Give worker time to initialize
        await new Promise(resolve => setTimeout(resolve, 100));

        const analysis = scout.analyze('/test/module-a.js');

        if (analysis.tree && analysis.loadOrder.length >= 3) {
            console.log('✅ PASS: Module tree loaded with depth:', analysis.stats.maxDepth);
            console.log('   - Total modules:', analysis.stats.totalModules);
            console.log('   - Max depth:', analysis.stats.maxDepth);
            console.log('   - Load order:', analysis.loadOrder.map(m => m.url).join(' -> '));
            testsPassed++;
        } else {
            console.log('❌ FAIL: Module tree incomplete');
            testsFailed++;
        }
    } catch (error) {
        console.error('❌ FAIL: Error during nested loading:', error);
        testsFailed++;
    }

    // Test 2: Load module without worker (fallback mode)
    console.log('\n⏳ Test 2: Module loading without worker (fallback)');
    try {
        const scout = new FXScout(mockFX, {
            workerEnabled: false
        });

        const result = scout.loadModule('/test/module-a.js');

        if (result) {
            console.log('✅ PASS: Module loaded in fallback mode');
            testsPassed++;
        } else {
            console.log('❌ FAIL: Fallback mode failed');
            testsFailed++;
        }
    } catch (error) {
        console.error('❌ FAIL: Error in fallback mode:', error);
        testsFailed++;
    }

    // Test 3: Circular dependency detection
    console.log('\n⏳ Test 3: Circular dependency handling');
    try {
        const scout = new FXScout(mockFX, {
            workerEnabled: true
        });

        // Give worker time to initialize
        await new Promise(resolve => setTimeout(resolve, 100));

        const analysis = scout.analyze('/test/circular-a.js');

        // Should handle circular deps gracefully
        if (analysis.tree) {
            console.log('✅ PASS: Circular dependency handled gracefully');
            if (analysis.tree.circular || analysis.tree.dependencies.some((d: any) => d.circular)) {
                console.log('   - Circular dependency detected and marked');
            }
            testsPassed++;
        } else {
            console.log('❌ FAIL: Circular dependency caused failure');
            testsFailed++;
        }
    } catch (error) {
        console.error('❌ FAIL: Error with circular dependency:', error);
        testsFailed++;
    }

    // Test 4: Component with dependencies
    console.log('\n⏳ Test 4: Component loading with dependencies');
    try {
        const scout = new FXScout(mockFX, {
            workerEnabled: true
        });

        // Give worker time to initialize
        await new Promise(resolve => setTimeout(resolve, 100));

        const component = scout.loadComponent('/test/component-with-deps.fxc');

        if (component && component.type === 'fxc') {
            console.log('✅ PASS: Component loaded with dependencies');
            console.log('   - Sections:', Object.keys(component.sections).join(', '));
            testsPassed++;
        } else {
            console.log('❌ FAIL: Component loading failed');
            testsFailed++;
        }
    } catch (error) {
        console.error('❌ FAIL: Error loading component:', error);
        testsFailed++;
    }

    // Test 5: Performance with multiple modules
    console.log('\n⏳ Test 5: Performance test with 10+ modules');
    try {
        const scout = new FXScout(mockFX, {
            workerEnabled: true,
            cacheEnabled: true
        });

        // Give worker time to initialize
        await new Promise(resolve => setTimeout(resolve, 100));

        const startTime = Date.now();

        // Load multiple modules
        for (let i = 0; i < 10; i++) {
            scout.loadModule(`/test/perf-module-${i}.js`);
        }

        const elapsed = Date.now() - startTime;
        const stats = scout.getStats();

        if (stats.mainThread.moduleCache >= 10) {
            console.log(`✅ PASS: Loaded 10 modules in ${elapsed}ms`);
            console.log(`   - Cached modules: ${stats.mainThread.moduleCache}`);
            testsPassed++;
        } else {
            console.log('❌ FAIL: Not all modules loaded');
            testsFailed++;
        }
    } catch (error) {
        console.error('❌ FAIL: Performance test error:', error);
        testsFailed++;
    }

    // Test 6: Worker error recovery
    console.log('\n⏳ Test 6: Worker error recovery');
    try {
        const scout = new FXScout(mockFX, {
            workerEnabled: true
        });

        // Give worker time to initialize
        await new Promise(resolve => setTimeout(resolve, 100));

        // Try to load invalid module (should handle error)
        try {
            scout.loadModule(':::invalid:::');
            console.log('❌ FAIL: Should have thrown error');
            testsFailed++;
        } catch (loadError) {
            console.log('✅ PASS: Error handled gracefully');
            testsPassed++;

            // Worker should still be functional
            const result = scout.loadModule('/test/recovery-test.js');
            if (result) {
                console.log('   - Worker recovered and still functional');
            }
        }
    } catch (error) {
        console.error('❌ FAIL: Worker recovery failed:', error);
        testsFailed++;
    }

    // Summary
    console.log('\n' + '=' .repeat(60));
    console.log('NESTED LOADING TEST RESULTS');
    console.log('=' .repeat(60));
    console.log(`Total: ${testsPassed + testsFailed} | Passed: ${testsPassed} | Failed: ${testsFailed}`);
    console.log(`Result: ${testsFailed === 0 ? '🎉 ALL TESTS PASSED!' : '⚠️ SOME TESTS FAILED'}`);
    console.log('=' .repeat(60) + '\n');

    return;
}

// Export for use
export default runNestedLoadingTests;

// Auto-run if executed directly
if (typeof window !== 'undefined' && (window as any).runNestedTests) {
    runNestedLoadingTests();
}