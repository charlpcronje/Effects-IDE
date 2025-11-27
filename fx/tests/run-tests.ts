#!/usr/bin/env node

/**
 * Test Runner for FX Flow & Serialize
 * Run with: npx ts-node tests/run-tests.ts
 */

import { runAllTests } from './fx-flow-serialize.test';

console.log('Starting FX Flow & Serialize Test Suite...\n');

try {
    const results = runAllTests();

    // Exit with appropriate code
    const failed = results.filter(r => !r.passed).length;
    process.exit(failed > 0 ? 1 : 0);
} catch (error) {
    console.error('Fatal error running tests:', error);
    process.exit(1);
}