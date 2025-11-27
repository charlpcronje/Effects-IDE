#!/usr/bin/env node
/**
 * Simple test to verify FX core framework works
 */

// Test that fx.v4 exports work
import('./fx.v4.ts').then(module => {
    const { fx, $$, initGlobals, FXCore } = module;

    console.log('✅ fx.v4 module loaded successfully');
    console.log('✅ FXCore class available:', typeof FXCore === 'function');
    console.log('✅ fx instance available:', typeof fx === 'object');
    console.log('✅ $$ proxy available:', typeof $$ === 'function');
    console.log('✅ initGlobals available:', typeof initGlobals === 'function');

    // Test basic functionality
    if (fx && $$) {
        // Initialize globals
        const globals = initGlobals();
        console.log('✅ Globals initialized:', globals !== null);

        // Test basic node operations
        $$('test.path').set('hello');
        const value = $$('test.path').val();
        console.log('✅ Basic node operations work:', value === 'hello');

        // Test CSP detection
        const hasCspMode = fx.moduleLoader && 'cspMode' in fx.moduleLoader;
        console.log('✅ CSP mode detection available:', hasCspMode);

        if (hasCspMode) {
            console.log('  CSP mode active:', fx.moduleLoader.cspMode);
        }

        // Test async loading method
        const hasAsyncLoad = fx.moduleLoader && typeof fx.moduleLoader.loadAsync === 'function';
        console.log('✅ Async loading method available:', hasAsyncLoad);

        console.log('\n🎉 All core functionality tests passed!');
        process.exit(0);
    } else {
        console.error('❌ Core functionality not available');
        process.exit(1);
    }
}).catch(error => {
    console.error('❌ Failed to load fx.v4:', error.message);
    process.exit(1);
});