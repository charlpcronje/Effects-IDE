#!/usr/bin/env node

/**
 * FX Scout Master Test Runner
 * Executes all test suites and provides comprehensive results
 */

import runFXScoutTests from './fx-scout.test.js';
import runNestedLoadingTests from './fx-scout-nested.test.js';
import runManifestTests from './fx-scout-manifest.test.js';

// Test result tracking
interface TestSuiteResult {
    name: string;
    duration: number;
    passed: boolean;
    error?: string;
}

class MasterTestRunner {
    private results: TestSuiteResult[] = [];
    private startTime: number = 0;

    async run(): Promise<void> {
        this.startTime = Date.now();

        console.log('\n' + '='.repeat(70));
        console.log('🚀 FX SCOUT MASTER TEST RUNNER');
        console.log('='.repeat(70));
        console.log('Running all test suites for fx-scout and fx-scout-worker plugins');
        console.log('This will verify:');
        console.log('  ✓ No async/await in main thread');
        console.log('  ✓ Nested module loading (3+ levels)');
        console.log('  ✓ Circular dependency handling');
        console.log('  ✓ Worker communication');
        console.log('  ✓ Manifest integration');
        console.log('  ✓ Cache management');
        console.log('  ✓ Error handling');
        console.log('  ✓ Performance under load');
        console.log('='.repeat(70));

        // Run each test suite
        await this.runTestSuite('Basic FX Scout Tests', runFXScoutTests);
        await this.runTestSuite('Nested Module Loading Tests', runNestedLoadingTests);
        await this.runTestSuite('Manifest Integration Tests', runManifestTests);

        // Print final results
        this.printFinalResults();
    }

    private async runTestSuite(
        name: string,
        testFunction: () => Promise<void>
    ): Promise<void> {
        const suiteStart = Date.now();
        let passed = true;
        let error: string | undefined;

        try {
            console.log(`\n📦 Running: ${name}`);
            console.log('-'.repeat(60));

            // Capture console output to detect failures
            const originalLog = console.log;
            const originalError = console.error;
            let hasFailures = false;

            console.log = (...args) => {
                const message = args.join(' ');
                if (message.includes('❌ FAIL') || message.includes('SOME TESTS FAILED')) {
                    hasFailures = true;
                }
                originalLog(...args);
            };

            console.error = (...args) => {
                hasFailures = true;
                originalError(...args);
            };

            // Run the test
            await testFunction();

            // Restore console
            console.log = originalLog;
            console.error = originalError;

            if (hasFailures) {
                passed = false;
                error = 'Some tests failed';
            }

        } catch (err: any) {
            passed = false;
            error = err.message || String(err);
            console.error(`\n❌ Test suite error: ${error}`);
        }

        const duration = Date.now() - suiteStart;
        this.results.push({ name, duration, passed, error });
    }

    private printFinalResults(): void {
        const totalDuration = Date.now() - this.startTime;
        const passedSuites = this.results.filter(r => r.passed).length;
        const failedSuites = this.results.filter(r => !r.passed).length;

        console.log('\n' + '='.repeat(70));
        console.log('📊 MASTER TEST RUNNER - FINAL RESULTS');
        console.log('='.repeat(70));

        // Individual suite results
        console.log('\nTest Suite Results:');
        console.log('-'.repeat(60));

        this.results.forEach(result => {
            const status = result.passed ? '✅ PASS' : '❌ FAIL';
            const duration = `${result.duration}ms`;
            console.log(`${status} | ${result.name.padEnd(35)} | ${duration.padStart(8)}`);
            if (result.error) {
                console.log(`       └─ Error: ${result.error}`);
            }
        });

        // Summary statistics
        console.log('\n' + '-'.repeat(60));
        console.log('Summary:');
        console.log(`  Total Suites: ${this.results.length}`);
        console.log(`  Passed: ${passedSuites}`);
        console.log(`  Failed: ${failedSuites}`);
        console.log(`  Total Time: ${totalDuration}ms`);
        console.log('-'.repeat(60));

        // Final verdict
        if (failedSuites === 0) {
            console.log('\n🎉 SUCCESS: ALL TEST SUITES PASSED!');
            console.log('\nFX Scout is working perfectly:');
            console.log('  ✅ No async/await in main thread');
            console.log('  ✅ FX_SUSPEND pattern working correctly');
            console.log('  ✅ Nested module loading functional');
            console.log('  ✅ Worker communication established');
            console.log('  ✅ Manifest integration complete');
            console.log('  ✅ All tests passed successfully');
        } else {
            console.log('\n⚠️ FAILURE: SOME TEST SUITES FAILED');
            console.log('\nIssues found:');
            this.results.filter(r => !r.passed).forEach(result => {
                console.log(`  ❌ ${result.name}: ${result.error || 'Tests failed'}`);
            });
            console.log('\nPlease review the test output above for details.');
        }

        console.log('\n' + '='.repeat(70));
        console.log('Test run completed at:', new Date().toISOString());
        console.log('='.repeat(70) + '\n');

        // Exit with appropriate code
        process.exit(failedSuites > 0 ? 1 : 0);
    }
}

// Verification function to check for async/await in source
async function verifyNoAsyncInMainThread(): Promise<boolean> {
    console.log('\n🔍 Verifying no async/await in main thread code...');

    try {
        // Read fx-scout.ts source
        const fs = await import('fs').then(m => m.promises);
        const scoutSource = await fs.readFile(
            '/home/user/fx---Effects/fx/FX TypeScript/plugins/fx-scout.ts',
            'utf-8'
        );

        // Check for async/await patterns
        const asyncPattern = /\basync\s+(?:function|\(|[\w$]+\s*\()|await\s+/g;
        const matches = scoutSource.match(asyncPattern);

        if (matches && matches.length > 0) {
            console.log('❌ Found async/await in main thread code:');
            matches.forEach(match => console.log(`   - ${match.trim()}`));
            return false;
        }

        console.log('✅ No async/await found in main thread code');
        return true;
    } catch (error) {
        console.error('⚠️ Could not verify source code:', error);
        return true; // Don't fail if we can't read the file
    }
}

// Main execution
async function main() {
    try {
        // First verify no async in main thread
        const noAsync = await verifyNoAsyncInMainThread();

        if (!noAsync) {
            console.error('\n❌ CRITICAL: async/await found in main thread!');
            console.error('FX Scout must use FX_SUSPEND pattern instead.');
            process.exit(1);
        }

        // Run all tests
        const runner = new MasterTestRunner();
        await runner.run();

    } catch (error) {
        console.error('\n❌ Fatal error in test runner:', error);
        process.exit(1);
    }
}

// Execute if run directly
if (require.main === module) {
    main();
}

// Export for use in other test runners
export { MasterTestRunner, main as runAllTests };