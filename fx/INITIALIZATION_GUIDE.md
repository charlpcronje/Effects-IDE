# FX Framework - Initialization & Bundling Guide

## Overview

The FX Framework has been restructured to provide:
- **Canonical entry point** via `fx.v4.ts`
- **Proper global exports** for browser and server environments
- **CSP-safe module loading** with fallback strategies
- **TypeScript-first development** with full type safety

## Core Architecture

### Module Structure

```
fx/FX TypeScript/
├── fx.ts           # Core framework implementation
├── fx.v4.ts        # Canonical entry point for all imports
├── plugins/        # Plugin modules
│   ├── fx-api.ts
│   ├── fx-cache.ts
│   └── ...
└── validate-build.ts  # Build validation script
```

### Entry Points

#### 1. For Plugins (Internal Use)
```typescript
// All plugins should import from fx.v4
import type { FXCore, FXNodeProxy } from '../fx.v4';
```

#### 2. For Applications (External Use)
```typescript
// ES Modules
import { fx, $$, initGlobals } from './path/to/fx.v4';

// CommonJS
const { fx, $$, initGlobals } = require('./path/to/fx.v4');
```

## Initialization

### Browser Environment

#### Automatic Initialization
```html
<script type="module">
  // fx.v4 auto-initializes globals in browser context
  import './fx.v4.js';

  // Globals are now available
  console.log(window.fx);    // FXCore instance
  console.log(window.$$);     // Root proxy
  console.log(window._$$);    // Path accessor
</script>
```

#### Manual Initialization
```javascript
import { initGlobals } from './fx.v4';

// Initialize globals manually
const { fx, $$, _$$, $_$$ } = initGlobals();

// Use the framework
$$('app.config').set({ theme: 'dark' });
```

### Server Environment (Node.js/Deno)

```javascript
import { fx, $$, initGlobals } from './fx.v4';

// Initialize globals for server context
initGlobals();

// Configure server-specific settings
fx.proxy()('config.server').set({
  port: 3000,
  host: 'localhost'
});
```

## CSP (Content Security Policy) Compatibility

### Understanding CSP Modes

The framework automatically detects CSP restrictions and adapts its behavior:

#### Standard Mode (No CSP)
- Uses `new Function()` for dynamic module loading
- Synchronous module execution
- Full feature set available

#### CSP Mode (unsafe-eval blocked)
- Detected automatically via `detectCSP()`
- Falls back to async module loading
- Uses dynamic `import()` or script injection
- Some features may require async handling

### Handling CSP Restrictions

```javascript
// The framework handles CSP automatically
// But you can check the mode programmatically:

if (fx.moduleLoader.cspMode) {
  console.log('Running in CSP-restricted environment');
  // Use async loading patterns
  const module = await fx.moduleLoader.loadAsync('./plugin.js');
} else {
  // Standard synchronous loading works
  const module = fx.moduleLoader.loadSync('./plugin.js');
}
```

### CSP-Safe Configuration

```html
<!-- CSP header that works with FX Framework -->
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self' 'unsafe-inline';
               worker-src 'self' blob:;">
```

## Bundling Strategies

### 1. Development (No Bundling)

```html
<!-- Use ES modules directly -->
<script type="module">
  import './fx.v4.js';
  import './plugins/fx-api.js';

  // Framework is ready
  $api.configure({ endpoint: '/api' });
</script>
```

### 2. Webpack Configuration

```javascript
// webpack.config.js
module.exports = {
  entry: './src/app.ts',
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      'fx': path.resolve(__dirname, 'fx/FX TypeScript/fx.v4.ts')
    }
  },
  module: {
    rules: [{
      test: /\.ts$/,
      use: 'ts-loader',
      exclude: /node_modules/
    }]
  }
};
```

### 3. Rollup Configuration

```javascript
// rollup.config.js
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';

export default {
  input: 'fx/FX TypeScript/fx.v4.ts',
  output: {
    file: 'dist/fx.bundle.js',
    format: 'es',
    name: 'FX'
  },
  plugins: [
    resolve(),
    typescript()
  ]
};
```

### 4. Vite Configuration

```javascript
// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      'fx': '/fx/FX TypeScript/fx.v4.ts'
    }
  },
  build: {
    lib: {
      entry: 'fx/FX TypeScript/fx.v4.ts',
      name: 'FX',
      fileName: 'fx'
    }
  }
});
```

### 5. Deno Bundle

```bash
# Bundle with Deno
deno bundle fx/FX\ TypeScript/fx.v4.ts fx.bundle.js

# Or use the built-in endpoint
curl http://localhost:8000/fx/module?entry=./fx.v4.ts > fx.bundle.js
```

## Global Exports Reference

### Core Instance
- `fx` - The main FXCore instance
- `$$` - Application root proxy (defaults to 'app')
- `$_$$` - Direct path accessor function
- `$root` - Change root context

### Helper Functions
- `$val(path, value?, default?)` - Get/set value
- `$set(path, value)` - Set value
- `$get(path)` - Get value
- `$has(path)` - Check existence

### System Proxies
- `$app` - Application namespace
- `$config` - Configuration namespace
- `$plugins` - Plugins namespace
- `$modules` - Modules namespace
- `$system` - System namespace
- `$cache` - Cache namespace
- `$dom` - DOM namespace
- `$session` - Session namespace

## Plugin Development

### Creating a Plugin

```typescript
// plugins/my-plugin.ts
import type { FXCore, FXNodeProxy } from '../fx.v4';

export default function myPlugin(fx: FXCore) {
  const $plugin = fx.proxy()('plugins.myPlugin');

  $plugin.set('version', '1.0.0');
  $plugin.set('initialized', true);

  // Add methods
  $plugin.set('doSomething', (arg: string) => {
    console.log('Doing something with:', arg);
    return arg.toUpperCase();
  });

  return $plugin;
}
```

### Registering Plugins

```javascript
import myPlugin from './plugins/my-plugin';

// Register the plugin
fx.pluginManager.register('myPlugin', myPlugin);

// Use the plugin
$plugins.myPlugin.doSomething('hello'); // "HELLO"
```

## Build Validation

Run the validation script to ensure everything compiles:

```bash
# Using Node.js
npx tsx fx/FX\ TypeScript/validate-build.ts

# Or make it executable
chmod +x fx/FX\ TypeScript/validate-build.ts
./fx/FX\ TypeScript/validate-build.ts
```

The validation script checks:
- ✅ Core exports are available
- ✅ All plugins import correctly
- ✅ TypeScript compilation succeeds
- ✅ CSP compatibility is maintained

## Migration from Previous Versions

### Before (Incorrect Imports)
```typescript
// ❌ OLD - Non-existent import
import { FXCore } from '../fx.v4';  // fx.v4 didn't exist!
```

### After (Fixed Imports)
```typescript
// ✅ NEW - Correct import from fx.v4.ts
import type { FXCore, FXNodeProxy } from '../fx.v4';
```

## Troubleshooting

### Issue: "Cannot find module fx.v4"
**Solution**: Ensure `fx.v4.ts` exists in the same directory as `fx.ts`

### Issue: "CSP blocks new Function"
**Solution**: The framework automatically detects and handles this. Check console for CSP mode messages.

### Issue: "Global $$ is undefined"
**Solution**: Call `initGlobals()` or import fx.v4 in browser context

### Issue: "TypeScript compilation errors"
**Solution**: Run the validation script to identify specific issues:
```bash
npx tsx validate-build.ts
```

## Best Practices

1. **Always import from fx.v4** - This is the canonical entry point
2. **Use type imports** for TypeScript interfaces: `import type { ... }`
3. **Initialize globals early** in your application bootstrap
4. **Test CSP compatibility** if deploying to restricted environments
5. **Run validation** before deploying to production
6. **Use async patterns** when CSP mode is detected

## Summary

The FX Framework now provides:
- ✅ **Stable module structure** with fx.v4 as the entry point
- ✅ **Proper TypeScript support** with full type exports
- ✅ **CSP compatibility** with automatic detection and fallbacks
- ✅ **Global exports** properly initialized for all environments
- ✅ **Build validation** to ensure everything compiles
- ✅ **Clear migration path** from previous versions

For more information, refer to the inline documentation in `fx.ts` and `fx.v4.ts`.