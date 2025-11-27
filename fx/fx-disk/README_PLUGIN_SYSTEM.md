
# FX Plugin System with WASM VFS

Complete plugin loading system with WASM Virtual File System integration for zero-latency module loading.

## 🎯 Quick Start

```typescript
// 1. Create a bundle
import { BundleBuilder } from './fx-disk/index.js';

const builder = new BundleBuilder();
builder.addPlugin('./plugins/fx-dom-dollar.ts');
builder.addPlugin('./plugins/fx-cache.ts');
await builder.writeBundle('./dist/bundle.bin');

// 2. Initialize FX with VFS
import { FXCore } from './fx.ts';
import { FXDiskSyncLoader, patchFXWithPluginLoader } from './fx-disk/index.js';

const fx = new FXCore();
fx.moduleLoader = new FXDiskSyncLoader({
    bundleUrl: './dist/bundle.bin'
});

patchFXWithPluginLoader(fx);
const $$ = fx.proxy();

// 3. Load plugins with @ syntax
$$("plugins.dom@./plugins/fx-dom-dollar.ts").options({
    global: "$dom"
});

// 4. Use the plugin!
$dom("#element").css({ color: "blue" });
```

## 📦 What's Included

### Core Components

1. **FXDiskSyncLoader** (`fx-sync-loader.ts`)
   - Drop-in replacement for SyncModuleLoader
   - VFS-first loading (instant <1ms)
   - Worker+SAB fallback for network
   - CSP-compatible mode

2. **PluginLoader** (`fx-plugin-loader.ts`)
   - Enhanced @ syntax support
   - Automatic module mounting
   - Global registration
   - Plugin lifecycle management

3. **BundleBuilder** (`fx-bundle-builder.ts`)
   - Create optimized VFS bundles
   - LZ4 compression
   - Chunk-level deduplication
   - CLI and programmatic API

4. **CLI Tool** (`cli/build-bundle.ts`)
   - Command-line bundle creation
   - Glob pattern support
   - JSON configuration
   - Multiple output formats

### Documentation

- **PLUGIN_LOADING.md** - Complete guide with examples
- **README_PLUGIN_SYSTEM.md** (this file) - Overview
- **examples/** - Practical examples

## 🚀 The @ Syntax

The enhanced `@` syntax combines FX path navigation with module loading:

```
[fxPath]@[modulePath]
```

### Examples

```typescript
// Auto-path with global
$$("@./plugins/fx-dom-dollar.ts").options({ global: "$dom" });

// Custom path
$$("app.database@./plugins/fx-orm.ts").options({ global: "$db" });

// With configuration
$$("@./plugins/fx-cache.ts").options({
    global: "$cache",
    config: { maxSize: 100, ttl: 3600 }
});

// With initialization callback
$$("@./plugins/fx-analytics.ts").options({
    global: "$analytics",
    onInit: (instance, node) => {
        instance.track('app_started');
    }
});
```

## 🏗️ Building Bundles

### Using CLI

```bash
# Basic
node fx-disk/cli/build-bundle.ts \
  --plugins "./plugins/*.ts" \
  --output ./dist/bundle.bin

# With config file
node fx-disk/cli/build-bundle.ts --config bundle.config.json

# All options
node fx-disk/cli/build-bundle.ts \
  --plugins "./plugins/fx-dom-dollar.ts,./plugins/fx-orm.ts" \
  --modules "./lib/*.ts" \
  --assets "./assets/*" \
  --manifest "./.fxrc.json" \
  --output ./dist/bundle.bin \
  --format base64 \
  --name "my-app" \
  --version "1.0.0" \
  --verbose
```

### Using API

```typescript
import { BundleBuilder } from './fx-disk/index.js';

const builder = new BundleBuilder({
    compress: true,
    format: 'binary',
    metadata: {
        name: 'my-app',
        version: '1.0.0'
    }
});

// Add plugins
builder.addPlugin('./plugins/fx-dom-dollar.ts');
builder.addPlugin('./plugins/fx-orm.ts');

// Add modules
builder.addModule('./lib/utils.ts');

// Add assets
builder.addAsset('./assets/config.json');

// Add all plugins from directory
await builder.addPluginsFromDir('./plugins', /\.(ts|js)$/);

// Build
const bundle = await builder.build();

// Write
await builder.writeBundle('./dist/bundle.bin');

// Or get as base64
const base64 = await builder.buildBase64();
```

### Bundle Config File

`bundle.config.json`:

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
    "./assets/logo.png"
  ],
  "manifest": "./.fxrc.json",
  "output": "./dist/bundle.bin",
  "format": "binary",
  "compress": true
}
```

## 🔧 Plugin Options

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

    /** Mount plugin at specific FX path */
    mountPath?: string;

    /** Plugin configuration object */
    config?: Record<string, any>;

    /** Custom initialization callback */
    onInit?: (instance: any, node: FXNodeProxy) => void;
}
```

## 📚 Architecture

```
┌─────────────────────────────────────────────────────┐
│                  FX Application                      │
├─────────────────────────────────────────────────────┤
│  $$("path@module").options({ global: "$x" })       │
├──────────────┬──────────────────────────────────────┤
│ PluginLoader │  FXDiskSyncLoader                     │
├──────────────┼──────────────────────────────────────┤
│  @ Parser    │  VFS → Worker+SAB → XHR              │
│  Mount Logic │  Module Execution                     │
│  Global Reg  │  Dependency Resolution                │
└──────────────┴──────────────────────────────────────┘
                          ↓
              ┌───────────────────────┐
              │   WASM VFS Bundle     │
              ├───────────────────────┤
              │ - LZ4 Compressed      │
              │ - 4KB Chunk Dedup     │
              │ - Instant Loading     │
              └───────────────────────┘
```

## ⚡ Performance

| Loading Method | Latency | Blocking | Use Case |
|---------------|---------|----------|----------|
| VFS (bundled) | <1ms | None | ✅ Production |
| Sync XHR | 5-50ms | Brief | Development |
| Worker+SAB | 50-200ms | None | Large files |
| Async fetch | 50-200ms | None | Dynamic imports |

## 🎯 Use Cases

### 1. Embedded Application

Bundle everything, zero network requests:

```typescript
import { FX_BUNDLE } from './dist/fx-bundle.js';

fx.moduleLoader = new FXDiskSyncLoader({
    bundleBase64: FX_BUNDLE
});
```

### 2. Progressive Loading

Load core first, plugins on demand:

```typescript
// Core bundle
fx.moduleLoader = new FXDiskSyncLoader({
    bundleUrl: '/bundles/core.bin'
});

// Later, load feature plugins
$$("@./plugins/advanced-charts.ts").options({ global: "$charts" });
```

### 3. Hot Module Reloading

```typescript
const loader = patchFXWithPluginLoader(fx);

// Reload plugin
loader.unload("plugins.dom");
$$("@./plugins/fx-dom-dollar.ts").options({ global: "$dom" });
```

### 4. Remote Plugins

```typescript
// Load from CDN
$$("@https://cdn.example.com/plugins/fx-maps.ts").options({
    global: "$maps"
});
```

## 🛡️ Security

- **CSP Compatible**: Works in Content Security Policy environments
- **Integrity Checking**: SHA-384 hash verification
- **Sandboxed Execution**: Plugins run in isolated scope
- **No eval()**: Uses Function constructor or dynamic import

```typescript
// Set integrity hash
fx.moduleLoader.setIntegrity(
    "./plugins/fx-dom-dollar.ts",
    "sha384-..."
);

// Load with verification
$$("@./plugins/fx-dom-dollar.ts").options({ global: "$dom" });
```

## 📊 Bundle Statistics

```typescript
const builder = new BundleBuilder();
// ... add files ...
const stats = builder.getStats();

console.log(stats);
// {
//   filesCount: 10,
//   files: 10,
//   chunks: 156,
//   dedups: 42,
//   totalSize: 245760,
//   compressedSize: 89012,
//   ratio: 0.362
// }
```

## 🔍 Debugging

```typescript
// Check VFS contents
console.log('VFS Files:', fx.moduleLoader.listFiles());

// Check loaded plugins
const loader = fx.__pluginLoader;
console.log('Plugins:', loader.getStats());

// Check module cache
console.log('VFS Stats:', fx.moduleLoader.getStats());

// Check if file exists
console.log('Exists:', fx.moduleLoader.exists('./plugins/my-plugin.ts'));
```

## 🚨 Troubleshooting

### Plugin Not Loading

```typescript
// 1. Check VFS has the file
const files = fx.moduleLoader.listFiles();
console.log('Available:', files);

// 2. Check path is correct
const exists = fx.moduleLoader.exists('./plugins/my-plugin.ts');
console.log('Exists:', exists);

// 3. Try manual load
const code = fx.moduleLoader.loadSync('./plugins/my-plugin.ts');
console.log('Code:', code);
```

### CSP Errors

If you see `unsafe-eval` errors:

```typescript
// Enable CSP mode
fx.moduleLoader = new FXDiskSyncLoader({
    bundleUrl: '/bundle.bin',
    // CSP detected automatically, or force it:
    cspMode: true
});
```

### Global Not Defined

```typescript
// Ensure plugin is loaded first
$$("@./plugins/fx-dom-dollar.ts").options({ global: "$dom" });

// Then check
setTimeout(() => {
    console.log('$dom:', typeof $dom);
}, 100);
```

## 📖 Examples

See the `examples/` directory:

- `basic-plugin-loading.ts` - Basic usage
- `complete-app-example.html` - Interactive browser demo
- `bundled-app.ts` - Production app with embedded bundle
- `hot-reload.ts` - Development with HMR

## 🎓 Best Practices

1. **Bundle in Production**
   - Always use VFS bundles for instant loading
   - Embed critical plugins
   - Lazy-load features

2. **Development Workflow**
   - Use file watching to rebuild bundles
   - Enable verbose logging
   - Test CSP mode

3. **Plugin Design**
   - Export factory function accepting FX
   - Keep plugins focused and small
   - Document configuration options
   - Provide TypeScript types

4. **Performance**
   - Bundle similar plugins together
   - Enable compression
   - Monitor bundle size
   - Use code splitting for large apps

## 🔗 Integration

### With FX Core

```typescript
import { FXCore } from './fx.ts';
import { FXDiskSyncLoader, patchFXWithPluginLoader } from './fx-disk/index.js';

class MyApp extends FXCore {
    constructor() {
        super();
        this.moduleLoader = new FXDiskSyncLoader({
            bundleUrl: '/bundles/app.bin'
        });
        patchFXWithPluginLoader(this);
    }
}

const app = new MyApp();
```

### With Build Tools

```javascript
// webpack.config.js
module.exports = {
    plugins: [
        new FXBundlePlugin({
            plugins: './plugins/*.ts',
            output: './dist/fx-bundle.bin'
        })
    ]
};
```

## 📦 Distribution

### NPM Package

```json
{
  "name": "my-fx-app",
  "version": "1.0.0",
  "files": ["dist/bundle.bin"],
  "scripts": {
    "build:bundle": "node fx-disk/cli/build-bundle.ts --config bundle.config.json"
  }
}
```

### CDN

```html
<script type="module">
import { FXCore } from 'https://cdn.example.com/fx.js';
import { FXDiskSyncLoader, patchFXWithPluginLoader } from 'https://cdn.example.com/fx-disk.js';

const fx = new FXCore();
fx.moduleLoader = new FXDiskSyncLoader({
    bundleUrl: 'https://cdn.example.com/bundles/app.bin'
});
patchFXWithPluginLoader(fx);
window.$$ = fx.proxy();
</script>
```

## 🤝 Contributing

See the main FX repository for contribution guidelines.

## 📄 License

MIT

---

**Made with ❤️ by the FX Team**

For complete documentation, see [PLUGIN_LOADING.md](./PLUGIN_LOADING.md)
