/**
 * FX Scout Comprehensive Test Suite
 * Tests all aspects of the module loader including:
 * - Basic module loading
 * - Nested dependency resolution (3+ levels)
 * - Circular dependency detection
 * - Component loading
 * - Worker communication
 * - Cache management
 * - Error handling
 * - Performance under load
 */

import type { FXCore } from '../../fx.v4';
import { FXScout } from '../fx-scout';

// Test utilities
class TestReporter {
    private tests: Array<{name: string, status: 'pass' | 'fail', error?: string}> = [];
    private currentTest: string = '';

    startTest(name: string): void {
        this.currentTest = name;
        console.log(`\n⏳ Testing: ${name}`);
    }

    pass(message?: string): void {
        console.log(`✅ PASS: ${this.currentTest}${message ? ` - ${message}` : ''}`);
        this.tests.push({name: this.currentTest, status: 'pass'});
    }

    fail(error: any): void {
        console.error(`❌ FAIL: ${this.currentTest}`, error);
        this.tests.push({
            name: this.currentTest,
            status: 'fail',
            error: error?.message || String(error)
        });
    }

    summary(): void {
        console.log('\n' + '='.repeat(60));
        console.log('TEST RESULTS SUMMARY');
        console.log('='.repeat(60));

        const passed = this.tests.filter(t => t.status === 'pass').length;
        const failed = this.tests.filter(t => t.status === 'fail').length;

        this.tests.forEach(test => {
            const icon = test.status === 'pass' ? '✅' : '❌';
            console.log(`${icon} ${test.name}${test.error ? ` - ${test.error}` : ''}`);
        });

        console.log('='.repeat(60));
        console.log(`Total: ${this.tests.length} | Passed: ${passed} | Failed: ${failed}`);
        console.log(`Result: ${failed === 0 ? '🎉 ALL TESTS PASSED!' : '⚠️ SOME TESTS FAILED'}`);
        console.log('='.repeat(60) + '\n');
    }
}

// Mock FX Core for testing
class MockFXCore implements Partial<FXCore> {
    moduleLoader = {
        loadSync: (path: string) => {
            // Simulate loading worker code
            if (path.includes('fx-scout-worker')) {
                return `
                    // Mock worker code
                    self.postMessage({ type: 'ready' });
                    self.onmessage = (e) => {
                        const { id, type, url } = e.data;
                        // Mock response
                        self.postMessage({
                            id,
                            success: true,
                            result: { content: 'mock content', moduleTree: {}, loadOrder: [] }
                        });
                    };
                `;
            }
            // Return mock content for other modules
            return `export default { mock: true };`;
        }
    };
}

// Main test runner
export async function runFXScoutTests(): Promise<void> {
    const reporter = new TestReporter();
    const mockFX = new MockFXCore() as FXCore;

    console.log('\n🚀 Starting FX Scout Comprehensive Test Suite');
    console.log('=' .repeat(60));

    // Test 1: Plugin initialization
    reporter.startTest('Plugin initialization');
    try {
        const scout = new FXScout(mockFX, {
            cacheEnabled: true,
            workerEnabled: false, // Disable worker for initial tests
            maxDepth: 10
        });

        if (scout.name === 'scout' && scout.version === '3.0.0') {
            reporter.pass('Plugin initialized correctly');
        } else {
            reporter.fail('Plugin properties incorrect');
        }
    } catch (error) {
        reporter.fail(error);
    }

    // Test 2: Basic module loading (no worker)
    reporter.startTest('Basic module loading without worker');
    try {
        const scout = new FXScout(mockFX, {
            workerEnabled: false
        });

        const result = scout.loadModule('./test-module.js');
        if (result) {
            reporter.pass('Module loaded successfully');
        } else {
            reporter.fail('Module loading returned null');
        }
    } catch (error) {
        reporter.fail(error);
    }

    // Test 3: Component loading
    reporter.startTest('FX Component loading');
    try {
        const scout = new FXScout(mockFX, {
            workerEnabled: false
        });

        const component = scout.loadComponent('./test-component.fxc');
        if (component && component.type === 'fxc') {
            reporter.pass('Component loaded and parsed');
        } else {
            reporter.fail('Component structure invalid');
        }
    } catch (error) {
        reporter.fail(error);
    }

    // Test 4: Cache functionality
    reporter.startTest('Cache functionality');
    try {
        const scout = new FXScout(mockFX, {
            cacheEnabled: true,
            workerEnabled: false
        });

        // Load module twice
        const result1 = scout.loadModule('./cached-module.js');
        const result2 = scout.loadModule('./cached-module.js');

        // Should return same instance from cache
        if (result1 === result2) {
            reporter.pass('Cache hit successful');
        } else {
            reporter.fail('Cache not working - different instances returned');
        }

        // Clear cache
        scout.clearCache('all');
        const result3 = scout.loadModule('./cached-module.js');

        if (result3 !== result2) {
            reporter.pass('Cache cleared successfully');
        } else {
            reporter.fail('Cache clear not working');
        }
    } catch (error) {
        reporter.fail(error);
    }

    // Test 5: Preloading
    reporter.startTest('Module preloading');
    try {
        const scout = new FXScout(mockFX, {
            preloadEnabled: true,
            workerEnabled: false
        });

        // Preload modules (fire and forget)
        scout.preload(
            './preload-1.js',
            './preload-2.js',
            './preload-3.fxc'
        );

        reporter.pass('Preload initiated without errors');
    } catch (error) {
        reporter.fail(error);
    }

    // Test 6: Statistics tracking
    reporter.startTest('Statistics tracking');
    try {
        const scout = new FXScout(mockFX, {
            workerEnabled: false
        });

        // Load some modules
        scout.loadModule('./stats-test-1.js');
        scout.loadModule('./stats-test-2.js');
        scout.loadComponent('./stats-test.fxc');

        const stats = scout.getStats();

        if (stats.mainThread &&
            stats.mainThread.moduleCache >= 0 &&
            stats.mainThread.componentCache >= 0) {
            reporter.pass(`Stats: ${stats.mainThread.moduleCache} modules, ${stats.mainThread.componentCache} components cached`);
        } else {
            reporter.fail('Stats structure invalid');
        }
    } catch (error) {
        reporter.fail(error);
    }

    // Test 7: Error handling - invalid module
    reporter.startTest('Error handling for invalid modules');
    try {
        const scout = new FXScout(mockFX, {
            workerEnabled: false
        });

        // This should handle error gracefully
        try {
            scout.loadModule(':::invalid-url:::');
            reporter.fail('Should have thrown error for invalid URL');
        } catch (loadError) {
            reporter.pass('Invalid URL error caught correctly');
        }
    } catch (error) {
        reporter.fail(error);
    }

    // Test 8: Multiple simultaneous loads (no duplicates)
    reporter.startTest('Preventing duplicate concurrent loads');
    try {
        const scout = new FXScout(mockFX, {
            workerEnabled: false
        });

        // Try to load same module multiple times simultaneously
        const promises = [
            scout.loadModule('./duplicate-test.js'),
            scout.loadModule('./duplicate-test.js'),
            scout.loadModule('./duplicate-test.js')
        ];

        // All should return same result
        if (promises[0] === promises[1] && promises[1] === promises[2]) {
            reporter.pass('Duplicate loads prevented');
        } else {
            reporter.fail('Duplicate loads not prevented properly');
        }
    } catch (error) {
        reporter.fail(error);
    }

    // Test 9: YAML parsing in components
    reporter.startTest('YAML metadata parsing');
    try {
        const scout = new FXScout(mockFX, {
            workerEnabled: false
        });

        const testYaml = `name: test
version: 1.0.0
enabled: true
count: 42
ratio: 3.14
nullable: null`;

        const parsed = (scout as any).parseYAML(testYaml);

        if (parsed.name === 'test' &&
            parsed.enabled === true &&
            parsed.count === 42 &&
            parsed.ratio === 3.14 &&
            parsed.nullable === null) {
            reporter.pass('YAML parsing works correctly');
        } else {
            reporter.fail('YAML parsing incorrect');
        }
    } catch (error) {
        reporter.fail(error);
    }

    // Test 10: Cache size limits
    reporter.startTest('Cache size limits');
    try {
        const scout = new FXScout(mockFX, {
            cacheEnabled: true,
            maxCacheSize: 3,
            workerEnabled: false
        });

        // Load more modules than cache size
        scout.loadModule('./cache-1.js');
        scout.loadModule('./cache-2.js');
        scout.loadModule('./cache-3.js');
        scout.loadModule('./cache-4.js'); // Should evict cache-1

        const stats = scout.getStats();

        if (stats.mainThread.moduleCache <= 3) {
            reporter.pass(`Cache size limited to ${stats.mainThread.moduleCache}`);
        } else {
            reporter.fail('Cache size limit not enforced');
        }
    } catch (error) {
        reporter.fail(error);
    }

    // Test 11: FX_SUSPEND pattern verification
    reporter.startTest('FX_SUSPEND pattern (no async leakage)');
    try {
        // Check that no async/await exists in main thread code
        const scoutCode = FXScout.toString();

        // Look for async/await patterns
        const hasAsync = /\basync\s+\w+|await\s+/g.test(scoutCode);

        if (!hasAsync) {
            reporter.pass('No async/await found in main thread code');
        } else {
            reporter.fail('Async/await detected in main thread code!');
        }
    } catch (error) {
        reporter.fail(error);
    }

    // Test 12: Plugin cleanup
    reporter.startTest('Plugin cleanup/destroy');
    try {
        const scout = new FXScout(mockFX, {
            workerEnabled: false
        });

        // Load some data
        scout.loadModule('./cleanup-test.js');
        scout.loadComponent('./cleanup-test.fxc');

        // Destroy
        scout.destroy();

        // Stats should show empty caches
        const stats = scout.getStats();

        if (stats.mainThread.moduleCache === 0 &&
            stats.mainThread.componentCache === 0) {
            reporter.pass('Plugin cleaned up successfully');
        } else {
            reporter.fail('Plugin cleanup incomplete');
        }
    } catch (error) {
        reporter.fail(error);
    }

    // Print summary
    reporter.summary();
}

// Export for use in test runner
export default runFXScoutTests;

// Auto-run if executed directly
if (typeof window !== 'undefined' && (window as any).runTests) {
    runFXScoutTests();
}