// fx-disk/examples/basic-plugin-loading.ts
/**
 * Basic Plugin Loading Example
 *
 * Shows how to:
 * 1. Create a bundle with plugins
 * 2. Load plugins using @ syntax
 * 3. Use loaded plugins
 */

import { FXCore } from '../../fx.ts';
import { FXDiskSyncLoader, patchFXWithPluginLoader, BundleBuilder } from '../index.js';

// ============================================
// Step 1: Create a bundle with plugins
// ============================================

async function createExampleBundle() {
    console.log('📦 Creating bundle with plugins...\n');

    const builder = new BundleBuilder({
        compress: true,
        metadata: {
            name: 'example-app',
            version: '1.0.0'
        }
    });

    // Add plugins
    builder.addPlugin('../../plugins/fx-dom-dollar.ts');
    builder.addPlugin('../../plugins/fx-cache.ts');

    // Build
    const bundle = await builder.build();

    // Write to file
    await builder.writeBundle('./dist/example-bundle.bin', bundle);

    console.log('✅ Bundle created: ./dist/example-bundle.bin\n');

    return bundle;
}

// ============================================
// Step 2: Initialize FX with the bundle
// ============================================

async function initializeFX(bundleData?: Uint8Array) {
    console.log('🚀 Initializing FX with VFS...\n');

    // Create FX instance
    const fx = new FXCore();

    // Setup VFS loader with bundle
    if (bundleData) {
        // Load from bundle data (in-memory)
        fx.moduleLoader = new FXDiskSyncLoader({
            bundleBase64: btoa(String.fromCharCode(...bundleData))
        });
    } else {
        // Load from file
        fx.moduleLoader = new FXDiskSyncLoader({
            bundleUrl: './dist/example-bundle.bin'
        });
    }

    // Enable plugin loader with @ syntax
    const pluginLoader = patchFXWithPluginLoader(fx);

    console.log('✅ FX initialized\n');
    console.log('📊 VFS Stats:', (fx.moduleLoader as any).getStats());
    console.log('');

    return { fx, pluginLoader };
}

// ============================================
// Step 3: Load plugins using @ syntax
// ============================================

function loadPlugins(fx: FXCore) {
    console.log('🔌 Loading plugins...\n');

    // Get $$ helper
    const $$ = fx.proxy();

    // Method 1: Load with auto path and global registration
    console.log('Loading fx-dom-dollar...');
    $$("@./plugins/fx-dom-dollar.ts").options({
        global: "$dom"
    });
    console.log('✅ $dom registered globally\n');

    // Method 2: Load with custom path
    console.log('Loading fx-cache...');
    $$("app.cache@./plugins/fx-cache.ts").options({
        global: "$cache",
        config: {
            maxSize: 100,
            ttl: 3600
        }
    });
    console.log('✅ $cache registered globally\n');

    return $$;
}

// ============================================
// Step 4: Use the loaded plugins
// ============================================

function usePlugins($$: any) {
    console.log('🎯 Using plugins...\n');

    // Only run DOM examples if in browser
    if (typeof document !== 'undefined') {
        // Create a test element
        const div = document.createElement('div');
        div.id = 'test-element';
        div.textContent = 'Hello FX!';
        document.body.appendChild(div);

        // Use $dom plugin
        console.log('Using $dom:');
        (globalThis as any).$dom("#test-element")
            .css({
                color: "blue",
                fontSize: 24,
                fontWeight: "bold"
            })
            .attr({
                "data-fx": "true"
            });

        console.log('✅ Styled element with $dom\n');
    }

    // Use $cache plugin
    console.log('Using $cache:');
    const cache = (globalThis as any).$cache;

    cache.set('user:1', { name: 'Alice', email: 'alice@example.com' });
    cache.set('user:2', { name: 'Bob', email: 'bob@example.com' });

    console.log('Cached values:');
    console.log('  user:1 =', cache.get('user:1'));
    console.log('  user:2 =', cache.get('user:2'));
    console.log('✅ Used $cache\n');

    // Access via FX tree
    console.log('Access via FX tree:');
    const cacheNode = $$("app.cache");
    console.log('  Cache stats:', cacheNode.get('stats').val());
    console.log('');
}

// ============================================
// Step 5: Demonstrate plugin loader features
// ============================================

function demonstrateFeatures(fx: FXCore) {
    console.log('✨ Plugin Loader Features:\n');

    const pluginLoader = (fx as any).__pluginLoader;

    // Check what's loaded
    const stats = pluginLoader.getStats();
    console.log('Loaded plugins:', stats.plugins);
    console.log('Total loaded:', stats.loadedCount);
    console.log('');

    // Check if specific plugin is loaded
    const isDomLoaded = pluginLoader.isLoaded('plugins.fx-dom-dollar');
    console.log('Is dom plugin loaded?', isDomLoaded);
    console.log('');

    // Show VFS contents
    const vfsFiles = (fx.moduleLoader as any).listFiles();
    console.log('Files in VFS:');
    vfsFiles.forEach((file: string) => console.log(`  - ${file}`));
    console.log('');
}

// ============================================
// Main
// ============================================

async function main() {
    console.log('╔════════════════════════════════════════╗');
    console.log('║   FX Plugin Loading - Basic Example   ║');
    console.log('╚════════════════════════════════════════╝\n');

    try {
        // Step 1: Create bundle
        const bundle = await createExampleBundle();

        // Step 2: Initialize FX
        const { fx, pluginLoader } = await initializeFX(bundle);

        // Step 3: Load plugins
        const $$ = loadPlugins(fx);

        // Step 4: Use plugins
        usePlugins($$);

        // Step 5: Demonstrate features
        demonstrateFeatures(fx);

        console.log('╔════════════════════════════════════════╗');
        console.log('║            ✅ Success!                  ║');
        console.log('╚════════════════════════════════════════╝\n');

    } catch (error) {
        console.error('❌ Error:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run if called directly
if (typeof require !== 'undefined' && require.main === module) {
    main();
}

export { createExampleBundle, initializeFX, loadPlugins, usePlugins };
