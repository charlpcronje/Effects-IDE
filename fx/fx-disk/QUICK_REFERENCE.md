# FX Plugin System - Quick Reference

## Installation & Setup

```typescript
import { FXCore } from './fx.ts';
import {
    FXDiskSyncLoader,
    patchFXWithPluginLoader,
    BundleBuilder
} from './fx-disk/index.js';

// Create FX with VFS
const fx = new FXCore();
fx.moduleLoader = new FXDiskSyncLoader({
    bundleUrl: '/dist/bundle.bin'
    // OR
    // bundleBase64: 'base64string...'
});

// Enable @ syntax
patchFXWithPluginLoader(fx);
const $$ = fx.proxy();
```

## @ Syntax Cheat Sheet

```typescript
// Format: [path]@[module]

// Auto-path (creates plugins.{name})
$$("@./plugins/fx-dom-dollar.ts").options({ global: "$dom" });

// Custom path
$$("app.db@./plugins/fx-orm.ts").options({ global: "$db" });

// With config
$$("@./plugins/fx-cache.ts").options({
    global: "$cache",
    config: { maxSize: 100 }
});

// With callback
$$("@./plugins/analytics.ts").options({
    global: "$analytics",
    onInit: (instance) => instance.track('loaded')
});
```

## Building Bundles

### CLI

```bash
# Basic
node fx-disk/cli/build-bundle.ts \
  -p "./plugins/*.ts" \
  -o ./dist/bundle.bin

# Full
node fx-disk/cli/build-bundle.ts \
  --plugins "./plugins/*.ts" \
  --modules "./lib/*.ts" \
  --manifest "./.fxrc.json" \
  --output ./dist/bundle.bin \
  --format binary \
  --verbose
```

### API

```typescript
const builder = new BundleBuilder();
builder.addPlugin('./plugins/fx-dom-dollar.ts');
builder.addModule('./lib/utils.ts');
const bundle = await builder.build();
await builder.writeBundle('./dist/bundle.bin');
```

## Common Patterns

### 1. Load Plugin

```typescript
$$("@./plugins/my-plugin.ts").options({
    global: "$myPlugin"
});

// Use it
$myPlugin.doSomething();
```

### 2. Load with Config

```typescript
$$("@./plugins/database.ts").options({
    global: "$db",
    config: {
        driver: "sqlite",
        filename: "app.db"
    }
});

// Access config
const config = $$("plugins.database.config").val();
```

### 3. Check Status

```typescript
// VFS stats
console.log(fx.moduleLoader.getStats());

// Loaded plugins
const loader = fx.__pluginLoader;
console.log(loader.getStats());

// List files
console.log(fx.moduleLoader.listFiles());
```

### 4. Unload & Reload

```typescript
const loader = fx.__pluginLoader;

// Unload
loader.unload("plugins.dom", "./plugins/fx-dom-dollar.ts");

// Reload
$$("@./plugins/fx-dom-dollar.ts").options({ global: "$dom" });
```

## Plugin Options Reference

```typescript
{
    global: string,           // Global variable name
    type: string,             // Plugin type
    instantiateDefault: bool, // Call default export (true)
    passFx: bool,            // Pass FX to factory (true)
    mountPath: string,        // Override mount path
    config: object,           // Plugin config
    onInit: (instance, node) => void  // Init callback
}
```

## Bundle Config Reference

```json
{
  "name": "app-name",
  "version": "1.0.0",
  "plugins": ["./plugins/*.ts"],
  "modules": ["./lib/*.ts"],
  "assets": ["./assets/*"],
  "manifest": "./.fxrc.json",
  "output": "./dist/bundle.bin",
  "format": "binary",
  "compress": true
}
```

## Debugging

```typescript
// Check if file exists in VFS
fx.moduleLoader.exists('./plugins/my-plugin.ts');

// List all VFS files
fx.moduleLoader.listFiles();

// Get VFS stats
fx.moduleLoader.getStats();

// Check loaded plugins
fx.__pluginLoader.getStats();

// Is plugin loaded?
fx.__pluginLoader.isLoaded("plugins.dom");
```

## Performance Tips

- ✅ Bundle plugins in production
- ✅ Enable compression
- ✅ Lazy load non-critical plugins
- ✅ Cache bundles with service workers
- ✅ Use base64 embedded bundles for instant load
- ❌ Don't bundle everything in one file
- ❌ Don't load plugins you don't use

## Common Issues

### Plugin not loading
```typescript
// 1. Check VFS
console.log(fx.moduleLoader.listFiles());

// 2. Check path
console.log(fx.moduleLoader.exists('./plugins/my-plugin.ts'));

// 3. Check errors
try {
    $$("@./plugins/my-plugin.ts").options({});
} catch (e) {
    console.error(e);
}
```

### Global undefined
```typescript
// Wait for plugin to load
setTimeout(() => {
    if (typeof $dom !== 'undefined') {
        console.log('Ready!');
    }
}, 100);
```

### CSP errors
```typescript
// Auto-detected, or force CSP mode
fx.moduleLoader = new FXDiskSyncLoader({
    bundleUrl: '/bundle.bin',
    cspMode: true
});
```

## Example: Complete App

```typescript
// 1. Build bundle
const builder = new BundleBuilder();
builder.addPlugin('./plugins/fx-dom-dollar.ts');
builder.addPlugin('./plugins/fx-cache.ts');
await builder.writeBundle('./dist/bundle.bin');

// 2. Initialize
const fx = new FXCore();
fx.moduleLoader = new FXDiskSyncLoader({
    bundleUrl: './dist/bundle.bin'
});
patchFXWithPluginLoader(fx);
const $$ = fx.proxy();

// 3. Load plugins
$$("@./plugins/fx-dom-dollar.ts").options({ global: "$dom" });
$$("@./plugins/fx-cache.ts").options({ global: "$cache" });

// 4. Use!
$dom("#app").css({ background: "blue" });
$cache.set("user", { name: "Alice" });
```

## File Locations

```
fx-disk/
├── index.ts                    # Main exports
├── fx-plugin-loader.ts         # @ syntax implementation
├── fx-sync-loader.ts           # VFS sync loader
├── fx-bundle-builder.ts        # Bundle builder
├── cli/
│   └── build-bundle.ts         # CLI tool
├── examples/
│   ├── basic-plugin-loading.ts
│   └── complete-app-example.html
└── docs/
    ├── PLUGIN_LOADING.md       # Full guide
    ├── README_PLUGIN_SYSTEM.md # Overview
    └── QUICK_REFERENCE.md      # This file
```

## Next Steps

1. Read [PLUGIN_LOADING.md](./PLUGIN_LOADING.md) for full guide
2. Try [examples/complete-app-example.html](./examples/complete-app-example.html)
3. Build your first bundle
4. Create a plugin
5. Deploy to production

---

**Quick Help**

- 📖 Full Documentation: [PLUGIN_LOADING.md](./PLUGIN_LOADING.md)
- 🎯 Overview: [README_PLUGIN_SYSTEM.md](./README_PLUGIN_SYSTEM.md)
- 💡 Examples: [examples/](./examples/)
- 🐛 Issues: GitHub Issues
