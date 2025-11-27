# FX Scout Plugin Documentation

## Overview

FX Scout is a zero-async module loader for the FX Framework that provides deep dependency analysis and intelligent module loading. It leverages FX's suspend/replay pattern to provide synchronous APIs while performing async operations in a Web Worker.

**Version:** 3.0.0 "The Navigator"

## Key Features

- **Zero Async in Main Thread**: Uses FX_SUSPEND pattern for clean synchronous APIs
- **Deep Dependency Resolution**: Automatically loads nested dependencies (unlimited depth)
- **Worker-Based Loading**: Offloads heavy operations to Web Worker
- **Circular Dependency Detection**: Gracefully handles circular imports
- **Component Support**: Native support for `.fxc` components
- **Manifest Integration**: Works seamlessly with `.fxrc.json` configuration
- **Intelligent Caching**: Multi-level cache with configurable limits
- **Performance Optimized**: Bundle optimization and parallel loading

## Installation

```javascript
import { FXScout } from './plugins/fx-scout';

// Initialize with FX Core
const scout = new FXScout(fx, {
    cacheEnabled: true,
    workerEnabled: true,
    maxDepth: 10
});

// Or use the factory function
import createScout from './plugins/fx-scout';
const scout = createScout(fx, options);
```

## Configuration Options

```typescript
interface ScoutOptions {
    cacheEnabled?: boolean;      // Enable caching (default: true)
    workerEnabled?: boolean;     // Use Web Worker (default: true)
    preloadEnabled?: boolean;    // Allow preloading (default: true)
    maxCacheSize?: number;       // Max cached modules (default: 100)
    bundleOptimization?: boolean; // Optimize load order (default: true)
    maxDepth?: number;           // Max dependency depth (default: 10)
    timeout?: number;            // Request timeout in ms (default: 30000)
}
```

## API Reference

### Loading Modules

#### `loadModule(url: string, options?: ScoutOptions): any`

Load a module with full dependency resolution. **Synchronous from caller's perspective!**

```javascript
// Load a single module
const module = scout.loadModule('./utils/helper.js');

// With custom options
const module = scout.loadModule('./deep-module.js', {
    maxDepth: 20,
    timeout: 60000
});
```

### Loading Components

#### `loadComponent(url: string): FXComponent`

Load an FX Component (`.fxc` file). **Synchronous from caller's perspective!**

```javascript
const component = scout.loadComponent('./components/header.fxc');

// Access component sections
console.log(component.sections.template);
console.log(component.sections.script);
console.log(component.sections.style);
```

### Dependency Analysis

#### `analyze(url: string): AnalysisResult`

Analyze module dependencies without executing. **Synchronous from caller's perspective!**

```javascript
const analysis = scout.analyze('./complex-module.js');

console.log('Module tree:', analysis.tree);
console.log('Load order:', analysis.loadOrder);
console.log('Stats:', analysis.stats);
// Stats include: totalModules, totalSize, maxDepth, cacheHits
```

### Fetching Content

#### `fetch(url: string): string`

Fetch raw content. **Synchronous from caller's perspective!**

```javascript
const content = scout.fetch('./data/config.json');
const parsed = JSON.parse(content);
```

### Preloading

#### `preload(...urls: string[]): void`

Preload modules in background (fire and forget).

```javascript
// Preload multiple modules
scout.preload(
    './module-a.js',
    './module-b.js',
    './component.fxc'
);
```

### Cache Management

#### `clearCache(type?: 'all' | 'modules' | 'components'): void`

Clear caches. **Synchronous!**

```javascript
// Clear all caches
scout.clearCache('all');

// Clear only module cache
scout.clearCache('modules');

// Clear only component cache
scout.clearCache('components');
```

#### `getStats(): StatsResult`

Get statistics. **Synchronous!**

```javascript
const stats = scout.getStats();

console.log('Main thread cache:', stats.mainThread);
console.log('Worker stats:', stats.worker);
console.log('Configuration:', stats.options);
```

### Cleanup

#### `destroy(): void`

Clean up resources and terminate worker.

```javascript
scout.destroy();
```

## Manifest Integration

FX Scout integrates with `.fxrc.json` manifest files for declarative configuration:

```json
{
  "plugins": [
    {
      "name": "scout",
      "enabled": true,
      "options": {
        "cacheEnabled": true,
        "workerEnabled": true,
        "maxDepth": 15,
        "maxCacheSize": 200
      }
    }
  ],
  "modules": {
    "lazyLoad": true,
    "preload": ["./core/utils.js"],
    "aliases": {
      "@utils": "./core/utils.js",
      "@components": "./components/"
    }
  },
  "dependencies": [
    {
      "name": "module-a",
      "path": "./modules/module-a.js",
      "lazy": false
    },
    {
      "name": "module-b",
      "path": "./modules/module-b.js",
      "lazy": true,
      "onLoad": "console.log('Module B loaded');"
    }
  ],
  "hooks": {
    "afterModuleLoad": [
      {
        "module": "module-a",
        "callback": "console.log('Module A post-load hook');"
      }
    ]
  }
}
```

## Advanced Usage

### Nested Module Loading

FX Scout automatically resolves deep dependency chains:

```javascript
// module-a.js imports module-b.js
// module-b.js imports module-c.js
// module-c.js imports module-d.js

const result = scout.loadModule('./module-a.js');
// All dependencies are loaded in correct order
```

### Circular Dependencies

Circular dependencies are detected and handled gracefully:

```javascript
// circular-a.js imports circular-b.js
// circular-b.js imports circular-a.js

const result = scout.analyze('./circular-a.js');
if (result.tree.circular) {
    console.log('Circular dependency detected!');
}
```

### Component Dependencies

Components can have dependencies that are automatically resolved:

```fxc
---
name: my-component
version: 1.0.0
---

--- script
import { utility } from './utils.js';
import { helper } from './helper.js';

export default {
    mounted() {
        utility();
        helper();
    }
}
```

### Custom Worker Bridge

The worker bridge uses FX_SUSPEND for seamless async operations:

```javascript
// Internal implementation example
class WorkerBridge {
    requestSync(type, url, options) {
        // Create promise for result
        const resultPromise = new Promise((resolve, reject) => {
            this.worker.postMessage({ type, url, options });
            // ... handle response
        });

        // Check if resolved immediately (cache hit)
        if (!resolved) {
            // SUSPEND until ready - FX will replay
            throw new FXSuspend(resultPromise);
        }

        return result;
    }
}
```

## Performance Considerations

1. **Worker Initialization**: First module load may suspend while worker initializes
2. **Cache Strategy**: FIFO eviction when cache limit reached
3. **Bundle Optimization**: Modules loaded in dependency order for optimal execution
4. **Memory Management**: Large files (>5MB) are not cached by default

## Error Handling

FX Scout provides comprehensive error handling:

```javascript
try {
    const module = scout.loadModule('./missing-module.js');
} catch (error) {
    console.error('Module load failed:', error);
    // Worker remains functional for subsequent loads
}
```

## Migration Guide

### From Async/Await Pattern

Before (async/await):
```javascript
async function loadModules() {
    const moduleA = await import('./module-a.js');
    const moduleB = await import('./module-b.js');
    return { moduleA, moduleB };
}
```

After (FX Scout):
```javascript
function loadModules() {
    const moduleA = scout.loadModule('./module-a.js');
    const moduleB = scout.loadModule('./module-b.js');
    return { moduleA, moduleB };
}
```

### From Dynamic Imports

Before:
```javascript
const module = await import(`./modules/${name}.js`);
```

After:
```javascript
const module = scout.loadModule(`./modules/${name}.js`);
```

## Troubleshooting

### Worker Not Initializing

If the worker fails to initialize:
1. Check the worker file path is correct
2. Ensure the worker code is accessible
3. Try with `workerEnabled: false` for fallback mode

### Module Not Found

If modules aren't loading:
1. Verify the URL/path is correct
2. Check CORS policies for remote modules
3. Use `scout.analyze()` to debug dependency tree

### Cache Issues

If caching behaves unexpectedly:
1. Clear cache with `scout.clearCache()`
2. Check `maxCacheSize` configuration
3. Monitor with `scout.getStats()`

## Best Practices

1. **Initialize Once**: Create a single FX Scout instance and reuse it
2. **Preload Critical Modules**: Use preload for modules needed soon
3. **Configure Cache Size**: Set appropriate `maxCacheSize` for your app
4. **Use Manifest**: Leverage `.fxrc.json` for declarative configuration
5. **Monitor Performance**: Use `getStats()` to track cache efficiency
6. **Handle Errors**: Always wrap loads in try-catch for robustness

## Example: Complete Application Setup

```javascript
import { FXCore } from './fx.v4';
import { FXScout } from './plugins/fx-scout';

// Initialize FX Core
const fx = new FXCore();

// Initialize Scout with optimal settings
const scout = new FXScout(fx, {
    cacheEnabled: true,
    workerEnabled: true,
    preloadEnabled: true,
    maxCacheSize: 200,
    bundleOptimization: true,
    maxDepth: 15,
    timeout: 30000
});

// Preload critical modules
scout.preload(
    './core/app.js',
    './core/router.js',
    './core/store.js'
);

// Load main application module
try {
    const app = scout.loadModule('./app/main.js');

    // Analyze dependencies for debugging
    const analysis = scout.analyze('./app/main.js');
    console.log(`Loaded ${analysis.stats.totalModules} modules`);
    console.log(`Total size: ${analysis.stats.totalSize} bytes`);
    console.log(`Max depth: ${analysis.stats.maxDepth}`);
    console.log(`Cache hits: ${analysis.stats.cacheHits}`);

    // Initialize application
    app.init();
} catch (error) {
    console.error('Failed to load application:', error);
}

// Cleanup on unload
window.addEventListener('unload', () => {
    scout.destroy();
});
```

## License

FX Scout is part of the FX Framework and follows the same license terms.

## Support

For issues, questions, or contributions, please refer to the FX Framework documentation.