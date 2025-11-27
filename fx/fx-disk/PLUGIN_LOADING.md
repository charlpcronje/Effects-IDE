# FX Plugin Loading with WASM VFS

Complete guide to loading plugins from the WASM Virtual File System using the enhanced `@` syntax.

## Table of Contents

1. [Quick Start](#quick-start)
2. [The Enhanced @ Syntax](#the-enhanced--syntax)
3. [Creating Bundles](#creating-bundles)
4. [Loading Plugins](#loading-plugins)
5. [Advanced Usage](#advanced-usage)
6. [API Reference](#api-reference)

## Quick Start

### 1. Create a Bundle

First, bundle your plugins into a VFS bundle:

```bash
# Using the CLI
node fx-disk/cli/build-bundle.ts \
  --plugins "./plugins/fx-dom-dollar.ts,./plugins/fx-orm.ts" \
  --output ./dist/fx-bundle.bin
```

Or programmatically:

```typescript
import { BundleBuilder } from './fx-disk/fx-bundle-builder.js';

const builder = new BundleBuilder();
builder.addPlugin('./plugins/fx-dom-dollar.ts');
builder.addPlugin('./plugins/fx-orm.ts');
builder.addPlugin('./plugins/fx-cache.ts');

const bundle = await builder.build();
await builder.writeBundle('./dist/fx-bundle.bin', bundle);
```

### 2. Initialize FX with VFS

```typescript
import { FXCore } from './fx.ts';
import { FXDiskSyncLoader, patchFXWithPluginLoader } from './fx-disk/index.js';

// Create FX with VFS loader
const fx = new FXCore();
fx.moduleLoader = new FXDiskSyncLoader({
    bundleUrl: '/dist/fx-bundle.bin'  // Loads synchronously
});

// Enable plugin loader
patchFXWithPluginLoader(fx);

// Export globally
const $$ = fx.proxy();
(globalThis as any).$$ = $$;
```

### 3. Load Plugins

Now use the enhanced @ syntax to load plugins:

```typescript
// Load plugin and register globally
$$("plugins.dom@./plugins/fx-dom-dollar.ts").options({
    global: "$dom"
});

// Now use it!
$dom("#my-element").css({ color: "blue" });
```

## The Enhanced @ Syntax

The `@` syntax combines FX path navigation with module loading:

```
[path]@[module]
```

### Examples

```typescript
// Mount at specific path with global registration
$$("plugins.dom@./plugins/fx-dom-dollar.ts").options({
    global: "$dom"
});

// Leading @ uses automatic path (plugins.{moduleName})
$$("@./plugins/fx-orm.ts").options({
    global: "$db"
});

// Custom mount path
$$("app.database@./plugins/fx-orm.ts").options({
    type: "database"
});

// Load without options (just mount)
$$("utils@./lib/helpers.ts").options();
```

### Syntax Breakdown

| Syntax | Path | Module | Result |
|--------|------|--------|--------|
| `path@module` | Custom FX path | Module file | Mounts at `path` |
| `@module` | Auto-generated | Module file | Mounts at `plugins.{name}` |

## Creating Bundles

### Using the CLI

```bash
# Basic usage
node build-bundle.ts --plugins "./plugins/*.ts" --output ./dist/bundle.bin

# With configuration file
node build-bundle.ts --config bundle.config.json

# With manifest
node build-bundle.ts \
  --plugins "./plugins/*.ts" \
  --manifest "./.fxrc.json" \
  --output ./dist/bundle.bin \
  --format base64
```

### Bundle Configuration File

Create `bundle.config.json`:

```json
{
  "name": "my-app",
  "version": "1.0.0",
  "plugins": [
    "./plugins/fx-dom-dollar.ts",
    "./plugins/fx-orm.ts",
    "./plugins/fx-cache.ts"
  ],
  "modules": [
    "./lib/utils.ts",
    "./lib/helpers.ts"
  ],
  "assets": [
    "./assets/logo.png",
    "./assets/styles.css"
  ],
  "manifest": "./.fxrc.json",
  "output": "./dist/fx-bundle.bin",
  "format": "binary",
  "compress": true
}
```

### Programmatic API

```typescript
import { BundleBuilder, createBundle } from './fx-disk/index.js';

// Method 1: Using BundleBuilder
const builder = new BundleBuilder({
    compress: true,
    format: 'binary',
    metadata: {
        name: 'my-app',
        version: '1.0.0'
    }
});

builder.addPlugin('./plugins/fx-dom-dollar.ts');
builder.addPlugin('./plugins/fx-orm.ts');
builder.addModule('./lib/utils.ts');
builder.addAsset('./assets/config.json');

const bundle = await builder.build();
await builder.writeBundle('./dist/bundle.bin', bundle);

// Method 2: Using createBundle helper
const bundle = await createBundle({
    compress: true,
    format: 'base64'
}, async (builder) => {
    await builder.addPluginsFromDir('./plugins');
    builder.addModule('./lib/utils.ts');
    builder.addManifest({
        plugins: {
            "$dom": "./plugins/fx-dom-dollar.ts",
            "$db": "./plugins/fx-orm.ts"
        }
    });
});
```

## Loading Plugins

### Basic Loading

```typescript
// Load with global registration
$$("@./plugins/fx-dom-dollar.ts").options({
    global: "$dom"
});

// Load at custom path
$$("app.dom@./plugins/fx-dom-dollar.ts").options();

// Load with configuration
$$("@./plugins/fx-orm.ts").options({
    global: "$db",
    config: {
        driver: "sqlite",
        filename: "app.db"
    }
});
```

### Plugin Options

```typescript
interface PluginLoadOptions {
    /** Register as global variable (e.g., "$dom") */
    global?: string;

    /** Plugin type identifier */
    type?: string;

    /** Execute default export immediately (default: true) */
    instantiateDefault?: boolean;

    /** Pass FX instance to plugin factory (default: true) */
    passFx?: boolean;

    /** Mount plugin at specific FX path (overrides path in selector) */
    mountPath?: string;

    /** Plugin configuration object */
    config?: Record<string, any>;

    /** Custom initialization callback */
    onInit?: (instance: any, node: FXNodeProxy) => void;
}
```

### Full Example

```typescript
$$("plugins.database@./plugins/fx-orm.ts").options({
    global: "$db",
    type: "database",
    config: {
        driver: "sqlite",
        filename: "./data/app.db",
        migrations: "./migrations"
    },
    onInit: (db, node) => {
        console.log("Database initialized:", db);

        // Setup auto-connect
        db.connect().catch(console.error);
    }
});

// Now use it
const users = await $db.query("SELECT * FROM users");
```

## Advanced Usage

### Embedding Bundles

Instead of loading from a URL, embed the bundle in your code:

```typescript
// 1. Build as base64
const builder = new BundleBuilder();
builder.addPlugin('./plugins/fx-dom-dollar.ts');
const base64Bundle = await builder.buildBase64();

// 2. Create embedded bundle file
// dist/fx-bundle.js
export const FX_BUNDLE = "...base64 string...";

// 3. Use in your app
import { FX_BUNDLE } from './dist/fx-bundle.js';
import { FXDiskSyncLoader } from './fx-disk/index.js';

fx.moduleLoader = new FXDiskSyncLoader({
    bundleBase64: FX_BUNDLE  // No network request!
});
```

### Hot Module Reloading

```typescript
import { patchFXWithPluginLoader, PluginLoader } from './fx-disk/index.js';

const loader = patchFXWithPluginLoader(fx);

// Load initial plugin
$$("@./plugins/fx-dom-dollar.ts").options({ global: "$dom" });

// Later, reload it
loader.unload("plugins.fx-dom-dollar", "./plugins/fx-dom-dollar.ts");
$$("@./plugins/fx-dom-dollar.ts").options({ global: "$dom" });
```

### Remote Plugin Loading

```typescript
// Load from CDN
$$("@https://cdn.example.com/plugins/fx-charts.ts").options({
    global: "$charts"
});

// Load with integrity check
fx.moduleLoader.setIntegrity(
    "https://cdn.example.com/plugins/fx-charts.ts",
    "sha384-..."
);

$$("@https://cdn.example.com/plugins/fx-charts.ts").options({
    global: "$charts"
});
```

### Plugin Dependencies

Plugins can require other modules:

```typescript
// plugins/fx-advanced.ts
import { helpers } from '../lib/helpers.js';

export default function(fx) {
    return {
        name: "advanced",

        doSomething() {
            return helpers.process(fx.root);
        }
    };
}
```

The loader will automatically handle dependencies via the `require()` function.

### Conditional Loading

```typescript
// Load different plugins based on environment
const isDev = process.env.NODE_ENV === 'development';

if (isDev) {
    $$("@./plugins/fx-devtools.ts").options({ global: "$devtools" });
}

// Or load based on feature flags
if ($$("config.features.database").val()) {
    $$("@./plugins/fx-orm.ts").options({ global: "$db" });
}
```

### Plugin Composition

```typescript
// Load base plugin
$$("@./plugins/fx-dom-dollar.ts").options({ global: "$dom" });

// Extend it with additional functionality
$$("@./plugins/fx-dom-animations.ts").options({
    onInit: (animations, node) => {
        // Add animations to $dom
        $dom.animate = animations.animate;
        $dom.transition = animations.transition;
    }
});
```

## API Reference

### PluginLoader

```typescript
class PluginLoader {
    /** Load a plugin from a module spec */
    loadPlugin(spec: PluginModuleSpec, options?: PluginLoadOptions): FXNodeProxy;

    /** Check if a plugin is loaded */
    isLoaded(mountPath: string, modulePath?: string): boolean;

    /** Unload a plugin */
    unload(mountPath: string, modulePath?: string): boolean;

    /** Get plugin statistics */
    getStats(): { loadedCount: number; plugins: string[] };
}
```

### parsePluginSpec

```typescript
/** Parse the @ syntax into mount path and module path */
function parsePluginSpec(pathSpec: string): PluginModuleSpec | null;

// Example
const spec = parsePluginSpec("plugins.dom@./plugins/fx-dom-dollar.ts");
// => { mountPath: "plugins.dom", modulePath: "./plugins/fx-dom-dollar.ts" }
```

### patchFXWithPluginLoader

```typescript
/** Patch FX instance to support @ syntax */
function patchFXWithPluginLoader(fx: FXCore): PluginLoader;

// Example
import { patchFXWithPluginLoader } from './fx-disk/index.js';

const loader = patchFXWithPluginLoader(fx);
$$("@./plugins/my-plugin.ts").options({ global: "$plugin" });
```

### BundleBuilder

```typescript
class BundleBuilder {
    /** Add a plugin to the bundle */
    addPlugin(path: string, virtualPath?: string): this;

    /** Add a module to the bundle */
    addModule(path: string, virtualPath?: string): this;

    /** Add an asset file */
    addAsset(path: string, virtualPath?: string): this;

    /** Add all plugins from a directory */
    addPluginsFromDir(dir: string, pattern?: RegExp): Promise<this>;

    /** Add a manifest configuration */
    addManifest(config: any): this;

    /** Build the bundle */
    build(): Promise<Uint8Array>;

    /** Build and get as base64 */
    buildBase64(): Promise<string>;

    /** Build and write to file */
    writeBundle(outputPath: string, bundle?: Uint8Array): Promise<void>;

    /** Get bundle statistics */
    getStats(): object;
}
```

## Performance

| Method | Latency | Notes |
|--------|---------|-------|
| VFS (bundled) | <1ms | Instant, synchronous |
| Sync XHR (local) | 5-50ms | Blocks UI briefly |
| Worker+SAB | 50-200ms | Non-blocking with suspend/replay |
| Async fetch | 50-200ms | Requires await |

## Best Practices

1. **Bundle in Production**: Always use bundles in production for instant loading
2. **Lazy Load**: Only load plugins you need
3. **Cache Bundles**: Use service workers to cache bundles
4. **Version Bundles**: Include version in bundle metadata
5. **Test Plugins**: Ensure plugins work in CSP mode
6. **Minimize Dependencies**: Keep plugins lean
7. **Use TypeScript**: Get type safety for plugin APIs

## Troubleshooting

### Plugin Not Loading

```typescript
// Check if VFS has the file
const loader = fx.moduleLoader;
console.log('VFS files:', loader.listFiles());

// Check if file exists
console.log('Exists:', loader.exists('./plugins/my-plugin.ts'));
```

### CSP Mode Issues

```typescript
// Plugins using new Function() won't work in CSP mode
// Use dynamic import instead:
$$("@./plugins/my-plugin.js").options({
    instantiateDefault: false
});

// Or load async
const plugin = await import('./plugins/my-plugin.js');
$$("plugins.myPlugin").set(plugin.default(fx));
```

### Global Not Defined

```typescript
// Ensure global is set AFTER loading
$$("@./plugins/fx-dom-dollar.ts").options({ global: "$dom" });

// Check if it's defined
if (typeof $dom !== 'undefined') {
    console.log('$dom is ready!');
}
```

## Examples

See the `examples/` directory for complete examples:

- `examples/basic-plugin-loading.ts` - Basic plugin loading
- `examples/bundled-app.ts` - Complete bundled application
- `examples/hot-reload.ts` - Hot module reloading
- `examples/remote-plugins.ts` - Loading from CDN

## License

MIT
