# Instructions for AI Assistants - FX Plugin System Upgrade

**For:** AI Assistants helping users upgrade their FX projects
**Version:** 2.0.0
**Complexity:** Moderate
**Time Required:** 15-30 minutes

---

## 🎯 Your Mission

You are helping a user upgrade their existing FX project to use the new FX Plugin System with WASM VFS. This upgrade adds:

- Zero-latency plugin loading (<1ms)
- Enhanced @ syntax for loading plugins
- Automatic bundling with compression
- Offline support

---

## 📋 Quick Overview

### What Changes

**Before:**
```typescript
import domPlugin from './plugins/fx-dom-dollar.ts';
const $dom = domPlugin(fx);
(globalThis as any).$dom = $dom;
```

**After:**
```typescript
$$("@./plugins/fx-dom-dollar.ts").options({
    global: "$dom"
});
```

### Key Components

1. **FXDiskSyncLoader** - Replaces `SyncModuleLoader`, adds VFS support
2. **PluginLoader** - Handles @ syntax and plugin mounting
3. **BundleBuilder** - Creates optimized VFS bundles
4. **@ Syntax** - `path@module` format for loading plugins

---

## 🚀 Step-by-Step Upgrade Process

### Step 1: Understand the User's Project

**Ask these questions:**

1. Where is their FX code located? (usually `./fx/FX TypeScript/` or `./src/fx/`)
2. What plugins do they use? (check imports in their code)
3. Do they use TypeScript or JavaScript?
4. What build tool? (webpack/vite/rollup/none)

**Locate these files:**

- `fx.ts` or `fx.v4.ts` - Core FX file
- `plugins/` directory - Their plugins
- Main application file - Where FX is initialized

### Step 2: Copy fx-disk Module

**Instructions:**

```bash
# Copy the entire fx-disk directory
cp -r /path/to/upgrade-package/fx-disk/ ./[FX_LOCATION]/fx-disk/

# Example:
cp -r fx-upgrade-package/fx-disk/ ./fx/FX\ TypeScript/fx-disk/
```

**Verify:**
```bash
ls [FX_LOCATION]/fx-disk/index.ts
# Should exist
```

### Step 3: Update FX Initialization

**Find** their FX initialization code. It looks like:

```typescript
import { FXCore } from './fx.ts';
const fx = new FXCore();
const $$ = fx.proxy();
```

**Replace with:**

```typescript
import { FXCore } from './fx.ts';
import {
    FXDiskSyncLoader,
    patchFXWithPluginLoader
} from './fx-disk/index.js';

const fx = new FXCore();

// Add VFS loader
fx.moduleLoader = new FXDiskSyncLoader({
    bundleUrl: '/dist/fx-bundle.bin'
});

// Enable @ syntax
patchFXWithPluginLoader(fx);

const $$ = fx.proxy();

// Optionally make global
(globalThis as any).fx = fx;
(globalThis as any).$$ = $$;
```

### Step 4: Create Bundle Configuration

**Create** `bundle.config.json` in project root:

```json
{
  "name": "PROJECT_NAME",
  "version": "1.0.0",
  "plugins": [
    // Add their actual plugin paths here
    "./fx/FX TypeScript/plugins/fx-dom-dollar.ts",
    "./fx/FX TypeScript/plugins/fx-cache.ts"
  ],
  "output": "./dist/fx-bundle.bin",
  "format": "binary",
  "compress": true
}
```

**Important:** Replace the plugins array with the user's actual plugins!

### Step 5: Update Plugin Loading Code

**Search for** these patterns in their code:

**Pattern 1: Direct Import**
```typescript
// FIND
import domPlugin from './plugins/fx-dom-dollar.ts';
const $dom = domPlugin(fx);
(globalThis as any).$dom = $dom;

// REPLACE WITH
$$("@./plugins/fx-dom-dollar.ts").options({
    global: "$dom"
});

// REMOVE THE IMPORT LINE
```

**Pattern 2: Dynamic Import**
```typescript
// FIND
import('./plugins/fx-cache.ts').then(m => {
    const cache = m.default(fx);
    (globalThis as any).$cache = cache;
});

// REPLACE WITH
$$("@./plugins/fx-cache.ts").options({
    global: "$cache"
});
```

**Pattern 3: Plugin with Config**
```typescript
// FIND
const db = dbPlugin(fx);
db.configure({ driver: 'sqlite' });
(globalThis as any).$db = db;

// REPLACE WITH
$$("@./plugins/fx-orm.ts").options({
    global: "$db",
    config: { driver: 'sqlite' }
});
```

### Step 6: Update Build Scripts

**Add to** `package.json`:

```json
{
  "scripts": {
    "build:bundle": "node fx/FX\\ TypeScript/fx-disk/cli/build-bundle.ts --config bundle.config.json",
    "prebuild": "npm run build:bundle",
    "dev": "npm run build:bundle && [EXISTING_DEV_COMMAND]",
    "build": "npm run build:bundle && [EXISTING_BUILD_COMMAND]"
  }
}
```

### Step 7: Build the Bundle

**Run:**

```bash
node fx/FX\ TypeScript/fx-disk/cli/build-bundle.ts \
  --config bundle.config.json \
  --verbose
```

**Expected output:**
```
🚀 FX Bundle Builder
==================

📦 Adding plugins...
  ✓ ./fx/FX TypeScript/plugins/fx-dom-dollar.ts
  ✓ ./fx/FX TypeScript/plugins/fx-cache.ts

🔨 Building bundle...

📊 Bundle Statistics:
  Files:          2
  Chunks:         45
  Deduplicated:   12
  Original size:  89.23 KB
  Compressed:     32.15 KB
  Ratio:          36.0%

💾 Writing bundle to: ./dist/fx-bundle.bin
  ✓ Bundle written successfully!

✨ Done!
```

**Verify:**
```bash
ls -lh dist/fx-bundle.bin
# Should show a .bin file
```

### Step 8: Test the Upgrade

**Create** `test-upgrade.ts`:

```typescript
import { FXCore } from './fx/FX TypeScript/fx.ts';
import {
    FXDiskSyncLoader,
    patchFXWithPluginLoader
} from './fx/FX TypeScript/fx-disk/index.js';

async function test() {
    console.log('Testing upgrade...\n');

    const fx = new FXCore();
    fx.moduleLoader = new FXDiskSyncLoader({
        bundleUrl: './dist/fx-bundle.bin'
    });
    patchFXWithPluginLoader(fx);
    const $$ = fx.proxy();

    console.log('✅ FX initialized');

    const stats = (fx.moduleLoader as any).getStats();
    console.log('📊 VFS Stats:', stats);

    const files = (fx.moduleLoader as any).listFiles();
    console.log('📁 VFS Files:', files);

    console.log('\n✅ Upgrade successful!');
}

test().catch(console.error);
```

**Run:**
```bash
node test-upgrade.ts
```

---

## 🎯 Common Scenarios

### Scenario 1: Simple App with 2-3 Plugins

**Steps:**
1. Copy `fx-disk/`
2. Update FX init (add VFS loader)
3. Create bundle config with 2-3 plugins
4. Replace plugin imports with @ syntax
5. Build bundle
6. Test

**Time:** 10-15 minutes

### Scenario 2: Medium App with 5-10 Plugins

**Steps:**
1. Copy `fx-disk/`
2. Update FX init
3. Create bundle config with all plugins
4. Search and replace all plugin loading code
5. Build bundle
6. Test each plugin individually
7. Full app test

**Time:** 20-30 minutes

### Scenario 3: Large App with Many Plugins

**Steps:**
1. Copy `fx-disk/`
2. Update FX init
3. Create multiple bundle configs (core + features)
4. Migrate core plugins first
5. Test core functionality
6. Migrate feature plugins
7. Test features
8. Optimize bundles

**Time:** 30-60 minutes

---

## 🔍 Troubleshooting Guide

### Issue 1: "Cannot find module 'fx-disk'"

**Diagnosis:**
```bash
ls ./fx/FX\ TypeScript/fx-disk/index.ts
```

**Solution:**
- If missing: Copy `fx-disk/` again
- Check import path matches file location
- Verify no typos in import statement

### Issue 2: "Module not found in bundle"

**Diagnosis:**
```bash
node -e "
const loader = require('./fx/FX TypeScript/fx-disk/index.js').FXDiskSyncLoader;
const l = new loader({bundleUrl:'./dist/fx-bundle.bin'});
console.log(l.listFiles());
"
```

**Solution:**
- Check plugin path in `bundle.config.json`
- Ensure path is relative to project root
- Rebuild bundle
- Example: `"./fx/FX TypeScript/plugins/my-plugin.ts"`

### Issue 3: "Global undefined"

**Diagnosis:**
```typescript
console.log('$dom' in globalThis); // false = problem
```

**Solution:**
- Ensure `options({ global: "$dom" })` is called
- Check plugin loaded successfully
- Verify no errors in console
- Try loading plugin manually to test

### Issue 4: "Bundle file not found"

**Diagnosis:**
```bash
ls dist/fx-bundle.bin
```

**Solution:**
- Build bundle: `npm run build:bundle`
- Check bundleUrl matches actual path
- Verify dist/ directory exists
- Check file permissions

---

## 📝 Code Templates

### Template 1: FX Initialization

```typescript
import { FXCore } from './fx/FX TypeScript/fx.ts';
import {
    FXDiskSyncLoader,
    patchFXWithPluginLoader
} from './fx/FX TypeScript/fx-disk/index.js';

const fx = new FXCore();

fx.moduleLoader = new FXDiskSyncLoader({
    bundleUrl: '/dist/fx-bundle.bin'
});

patchFXWithPluginLoader(fx);
const $$ = fx.proxy();

// Make global if needed
(globalThis as any).fx = fx;
(globalThis as any).$$ = $$;

export { fx, $$ };
```

### Template 2: Plugin Loading

```typescript
// Load with global registration
$$("@./plugins/[PLUGIN_NAME].ts").options({
    global: "$[GLOBAL_NAME]"
});

// Load with config
$$("@./plugins/[PLUGIN_NAME].ts").options({
    global: "$[GLOBAL_NAME]",
    config: {
        // Plugin configuration
    }
});

// Load at custom path
$$("[CUSTOM_PATH]@./plugins/[PLUGIN_NAME].ts").options({
    global: "$[GLOBAL_NAME]"
});
```

### Template 3: Bundle Config

```json
{
  "name": "[PROJECT_NAME]",
  "version": "1.0.0",
  "plugins": [
    "./fx/FX TypeScript/plugins/[PLUGIN_1].ts",
    "./fx/FX TypeScript/plugins/[PLUGIN_2].ts"
  ],
  "modules": [],
  "output": "./dist/fx-bundle.bin",
  "format": "binary",
  "compress": true
}
```

---

## ✅ Verification Checklist

After completing the upgrade, verify:

- [ ] `fx-disk/` directory copied to correct location
- [ ] `bundle.config.json` created with correct plugin paths
- [ ] FX initialization updated with `FXDiskSyncLoader`
- [ ] `patchFXWithPluginLoader(fx)` called
- [ ] All plugin imports replaced with @ syntax
- [ ] Bundle built successfully (`dist/fx-bundle.bin` exists)
- [ ] Test script passes
- [ ] Application runs without errors
- [ ] All plugins load correctly
- [ ] Globals defined (e.g., `$dom`, `$cache`)
- [ ] Build scripts updated in `package.json`

---

## 🎓 Key Concepts to Understand

### 1. The @ Syntax

Format: `[path]@[module]`

- `@./plugins/my-plugin.ts` - Auto path (plugins.my-plugin)
- `custom.path@./plugins/my-plugin.ts` - Custom path

### 2. Plugin Options

```typescript
{
    global: string,        // Global variable name
    config: object,        // Plugin configuration
    type: string,          // Plugin type
    onInit: function,      // Initialization callback
    mountPath: string,     // Override mount path
}
```

### 3. VFS Loading

- Plugins bundled in `fx-bundle.bin`
- Loaded from VFS (<1ms)
- Falls back to network if not in VFS
- Supports compression and deduplication

---

## 📚 Reference Documentation

Point users to these files for more information:

- **`INSTALLATION_INSTRUCTIONS.md`** - Detailed installation
- **`UPGRADE_GUIDE.md`** - Complete migration guide
- **`PLUGIN_LOADING.md`** - Plugin system guide
- **`QUICK_REFERENCE.md`** - Quick syntax reference
- **`README_PLUGIN_SYSTEM.md`** - System overview

---

## 🎯 Success Criteria

The upgrade is successful when:

1. ✅ Application starts without errors
2. ✅ All plugins load in <1ms (check with console.time)
3. ✅ Bundle contains all plugins (check with listFiles())
4. ✅ Globals are defined ($dom, $cache, etc.)
5. ✅ Application functionality matches previous version
6. ✅ Build process includes bundle building
7. ✅ Performance improved (faster load times)

---

## 💡 Tips for AI Assistants

1. **Be Patient** - This is a significant upgrade, take time to explain
2. **Check Paths** - Most issues are path-related
3. **Test Incrementally** - Migrate one plugin at a time if needed
4. **Use Templates** - Provide ready-to-use code from templates
5. **Verify Each Step** - Check files exist before proceeding
6. **Show Examples** - Use actual code from their project
7. **Debug Systematically** - Follow troubleshooting guide

---

## 🔄 Typical Workflow

```
1. Analyze user's project
   ↓
2. Copy fx-disk files
   ↓
3. Update FX initialization
   ↓
4. Create bundle config
   ↓
5. Update plugin loading code
   ↓
6. Build bundle
   ↓
7. Test
   ↓
8. Debug if needed
   ↓
9. Verify complete
```

---

## 📞 When Users Need More Help

If users need additional help, direct them to:

1. `UPGRADE_GUIDE.md` - Comprehensive guide
2. `examples/` - Working examples
3. Enable verbose logging: `--verbose` flag
4. Check VFS contents: `fx.moduleLoader.listFiles()`
5. Verify bundle: Rebuild with `--verbose`

---

**You're ready to help users upgrade their FX projects!**

Start with Step 1 and work through systematically. Good luck! 🚀
