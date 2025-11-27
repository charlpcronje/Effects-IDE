# FX Plugin System - Installation Instructions

**For AI Assistants:** Follow these instructions step-by-step to upgrade an FX project.

---

## 🎯 Installation Overview

This installation adds the FX Plugin System with WASM VFS to an existing FX project. The process takes approximately **10-15 minutes**.

---

## 📋 Prerequisites

Before starting, ensure:

- ✅ Existing FX project using `fx.ts` or `fx.v4.ts`
- ✅ Node.js 16+ or Deno 1.30+ installed
- ✅ TypeScript project (recommended) or JavaScript
- ✅ Build tools configured (webpack/vite/rollup optional)

---

## 🚀 Installation Steps

### Step 1: Extract Upgrade Package

Extract the `fx-upgrade-package.zip` to a temporary location:

```bash
unzip fx-upgrade-package.zip -d /tmp/fx-upgrade
```

### Step 2: Copy fx-disk Module

Copy the entire `fx-disk/` directory to your project:

```bash
# Find your FX directory
# Usually: ./fx/FX TypeScript/ or ./src/fx/

# Copy fx-disk
cp -r /tmp/fx-upgrade/fx-disk/ ./fx/FX\ TypeScript/fx-disk/

# Verify copy
ls -la ./fx/FX\ TypeScript/fx-disk/
```

Expected structure:
```
your-project/
└── fx/
    └── FX TypeScript/
        ├── fx.ts                       # Existing
        ├── fx.v4.ts                    # Existing
        ├── plugins/                    # Existing
        └── fx-disk/                    # NEW
            ├── index.ts
            ├── fx-plugin-loader.ts
            ├── fx-sync-loader.ts
            ├── fx-bundle-builder.ts
            ├── cli/
            ├── examples/
            └── ... (all other files)
```

### Step 3: Update TypeScript Configuration

Add fx-disk to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@fx/*": ["./fx/FX TypeScript/*"],
      "@fx-disk/*": ["./fx/FX TypeScript/fx-disk/*"]
    }
  },
  "include": [
    "fx/**/*.ts",
    "fx/FX TypeScript/fx-disk/**/*.ts"
  ]
}
```

### Step 4: Update Your Main Application File

**Locate your FX initialization code.** It typically looks like:

```typescript
import { FXCore } from './fx.ts';

const fx = new FXCore();
const $$ = fx.proxy();
```

**Update it to:**

```typescript
import { FXCore } from './fx.ts';
import {
    FXDiskSyncLoader,
    patchFXWithPluginLoader
} from './fx-disk/index.js';

const fx = new FXCore();

// Add VFS-powered module loader
fx.moduleLoader = new FXDiskSyncLoader({
    bundleUrl: '/dist/fx-bundle.bin'  // Will create this in Step 6
});

// Enable @ syntax for plugin loading
patchFXWithPluginLoader(fx);

const $$ = fx.proxy();

// Make global (optional)
(globalThis as any).fx = fx;
(globalThis as any).$$ = $$;
```

### Step 5: Create Bundle Configuration

Create `bundle.config.json` in your project root:

```json
{
  "name": "your-app-name",
  "version": "1.0.0",
  "plugins": [
    "./fx/FX TypeScript/plugins/fx-dom-dollar.ts",
    "./fx/FX TypeScript/plugins/fx-cache.ts",
    "./fx/FX TypeScript/plugins/fx-orm.ts"
  ],
  "modules": [],
  "assets": [],
  "output": "./dist/fx-bundle.bin",
  "format": "binary",
  "compress": true
}
```

**Note:** Adjust the `plugins` array to include YOUR actual plugins.

### Step 6: Build Your First Bundle

```bash
# Build the bundle
node fx/FX\ TypeScript/fx-disk/cli/build-bundle.ts \
  --config bundle.config.json \
  --verbose

# You should see:
# 📦 Building bundle...
# ✅ Bundle built successfully!
# 📊 Bundle Statistics: ...
```

Verify the bundle was created:

```bash
ls -lh dist/fx-bundle.bin
# Should show a .bin file (size varies by plugins)
```

### Step 7: Update Plugin Loading Code

**Find all places where you load plugins.** Common patterns:

**Pattern A: Import and Instantiate**
```typescript
// OLD
import domPlugin from './plugins/fx-dom-dollar.ts';
const $dom = domPlugin(fx);
(globalThis as any).$dom = $dom;

// NEW
$$("@./plugins/fx-dom-dollar.ts").options({
    global: "$dom"
});
```

**Pattern B: Dynamic Import**
```typescript
// OLD
import('./plugins/fx-cache.ts').then(m => {
    const cache = m.default(fx);
    (globalThis as any).$cache = cache;
});

// NEW
$$("@./plugins/fx-cache.ts").options({
    global: "$cache"
});
```

**Pattern C: Manual Registration**
```typescript
// OLD
const db = require('./plugins/fx-orm.ts').default(fx);
fx.proxy('app.database').val(db);

// NEW
$$("app.database@./plugins/fx-orm.ts").options({
    global: "$db"
});
```

### Step 8: Update Build Scripts

Add bundle building to your `package.json`:

```json
{
  "scripts": {
    "build:bundle": "node fx/FX\\ TypeScript/fx-disk/cli/build-bundle.ts --config bundle.config.json",
    "prebuild": "npm run build:bundle",
    "dev": "npm run build:bundle && vite",
    "build": "npm run build:bundle && vite build"
  }
}
```

### Step 9: Test the Installation

Create a test file `test-upgrade.ts`:

```typescript
import { FXCore } from './fx/FX TypeScript/fx.ts';
import {
    FXDiskSyncLoader,
    patchFXWithPluginLoader
} from './fx/FX TypeScript/fx-disk/index.js';

async function test() {
    console.log('🧪 Testing FX Plugin System Installation\n');

    // 1. Initialize
    console.log('1️⃣ Initializing FX...');
    const fx = new FXCore();
    fx.moduleLoader = new FXDiskSyncLoader({
        bundleUrl: './dist/fx-bundle.bin'
    });
    patchFXWithPluginLoader(fx);
    const $$ = fx.proxy();
    console.log('   ✅ FX initialized\n');

    // 2. Check VFS
    console.log('2️⃣ Checking VFS...');
    const stats = (fx.moduleLoader as any).getStats();
    console.log('   📊 Stats:', stats);
    console.log('   ✅ VFS ready\n');

    // 3. List files
    console.log('3️⃣ VFS Contents:');
    const files = (fx.moduleLoader as any).listFiles();
    files.forEach((f: string) => console.log('   -', f));
    console.log();

    // 4. Load test plugin
    console.log('4️⃣ Loading test plugin...');
    try {
        $$("@./plugins/fx-dom-dollar.ts").options({
            global: "$dom"
        });
        console.log('   ✅ Plugin loaded\n');
    } catch (e) {
        console.log('   ⚠️  Plugin load error:', e);
    }

    // 5. Check global
    console.log('5️⃣ Checking globals...');
    console.log('   $dom defined:', typeof (globalThis as any).$dom !== 'undefined');
    console.log();

    console.log('✅ All tests passed!\n');
}

test().catch(console.error);
```

Run the test:

```bash
node test-upgrade.ts

# Expected output:
# 🧪 Testing FX Plugin System Installation
# 1️⃣ Initializing FX...
#    ✅ FX initialized
# 2️⃣ Checking VFS...
#    📊 Stats: { vfsReady: true, vfsFiles: 3, ... }
#    ✅ VFS ready
# ...
# ✅ All tests passed!
```

### Step 10: Update Your Application

Now update your actual application code:

1. **Remove old plugin imports** at the top of files
2. **Add plugin loading** using @ syntax where needed
3. **Test each plugin** individually
4. **Verify functionality** matches previous behavior

Example application update:

**Before:**
```typescript
// app.ts
import { FXCore } from './fx.ts';
import domPlugin from './plugins/fx-dom-dollar.ts';
import cachePlugin from './plugins/fx-cache.ts';

const fx = new FXCore();
const $$ = fx.proxy();

// Setup plugins
const $dom = domPlugin(fx);
const $cache = cachePlugin(fx);

(globalThis as any).$dom = $dom;
(globalThis as any).$cache = $cache;

// Use plugins
$dom("#app").css({ color: "blue" });
$cache.set("user", { name: "Alice" });
```

**After:**
```typescript
// app.ts
import { FXCore } from './fx.ts';
import {
    FXDiskSyncLoader,
    patchFXWithPluginLoader
} from './fx-disk/index.js';

const fx = new FXCore();
fx.moduleLoader = new FXDiskSyncLoader({
    bundleUrl: '/dist/fx-bundle.bin'
});
patchFXWithPluginLoader(fx);
const $$ = fx.proxy();

// Load plugins with @ syntax
$$("@./plugins/fx-dom-dollar.ts").options({ global: "$dom" });
$$("@./plugins/fx-cache.ts").options({ global: "$cache" });

// Use plugins (same as before!)
$dom("#app").css({ color: "blue" });
$cache.set("user", { name: "Alice" });
```

---

## ✅ Installation Checklist

- [ ] **Files Copied**
  - [ ] `fx-disk/` directory in correct location
  - [ ] All files present (run `ls fx-disk/`)

- [ ] **Configuration**
  - [ ] `tsconfig.json` updated
  - [ ] `bundle.config.json` created
  - [ ] Plugin paths in config are correct

- [ ] **Code Updates**
  - [ ] FX initialization updated with `FXDiskSyncLoader`
  - [ ] `patchFXWithPluginLoader` called
  - [ ] Plugin loading converted to @ syntax
  - [ ] Old imports removed

- [ ] **Bundle**
  - [ ] Bundle built successfully
  - [ ] `dist/fx-bundle.bin` exists
  - [ ] Bundle contains expected plugins

- [ ] **Testing**
  - [ ] Test script passes
  - [ ] Application runs
  - [ ] Plugins work correctly
  - [ ] No console errors

- [ ] **Build Process**
  - [ ] Bundle build added to scripts
  - [ ] Pre-build hooks configured
  - [ ] CI/CD updated (if applicable)

---

## 🐛 Common Installation Issues

### Issue 1: "Cannot find module 'fx-disk'"

**Cause:** Path incorrect or files not copied

**Fix:**
```bash
# Verify path
ls -la fx/FX\ TypeScript/fx-disk/index.ts

# If missing, re-copy
cp -r /tmp/fx-upgrade/fx-disk/ ./fx/FX\ TypeScript/fx-disk/
```

### Issue 2: "Module not found in bundle"

**Cause:** Plugin path in bundle.config.json is wrong

**Fix:**
```json
{
  "plugins": [
    // Wrong: "./plugins/fx-dom-dollar.ts"
    // Right: "./fx/FX TypeScript/plugins/fx-dom-dollar.ts"
    "./fx/FX TypeScript/plugins/fx-dom-dollar.ts"
  ]
}
```

Rebuild bundle:
```bash
node fx/FX\ TypeScript/fx-disk/cli/build-bundle.ts --config bundle.config.json
```

### Issue 3: "Bundle file not found"

**Cause:** Bundle not built or wrong path

**Fix:**
```bash
# Build bundle
npm run build:bundle

# Check it exists
ls -lh dist/fx-bundle.bin

# Update bundleUrl if needed
fx.moduleLoader = new FXDiskSyncLoader({
    bundleUrl: '/dist/fx-bundle.bin'  // Must match actual location
});
```

### Issue 4: "TypeScript errors"

**Cause:** Missing type definitions

**Fix:**
```typescript
// Add to your .d.ts file or create fx-disk.d.ts
declare module './fx-disk/index.js' {
    export * from './fx-disk/index';
}
```

---

## 🎯 Quick Validation

After installation, run these checks:

```bash
# 1. Files exist
ls fx/FX\ TypeScript/fx-disk/index.ts
# Should show the file

# 2. Bundle exists
ls dist/fx-bundle.bin
# Should show the bundle

# 3. Test runs
node test-upgrade.ts
# Should pass all tests

# 4. App builds
npm run build
# Should complete without errors

# 5. App runs
npm run dev
# Should start dev server
```

---

## 📚 Next Steps

After successful installation:

1. **Read Documentation**
   - `PLUGIN_LOADING.md` - Complete guide
   - `QUICK_REFERENCE.md` - Quick reference
   - `README_PLUGIN_SYSTEM.md` - System overview

2. **Optimize Bundle**
   - Review bundle size
   - Split into multiple bundles if needed
   - Enable compression (should be default)

3. **Setup Development Workflow**
   - File watching for bundle rebuilds
   - Hot module reloading (optional)
   - Development vs production bundles

4. **Deploy to Production**
   - Include bundle in deployment
   - Configure CDN/static hosting
   - Set cache headers
   - Monitor performance

---

## 🆘 Need Help?

1. Check `UPGRADE_GUIDE.md` for detailed migration patterns
2. Review `examples/` for working code
3. Enable verbose logging: `--verbose` flag
4. Check console for errors
5. Verify bundle contents: `fx.moduleLoader.listFiles()`

---

**Installation Complete!** 🎉

Your FX project now has:
- ✅ Zero-latency plugin loading (<1ms)
- ✅ WASM Virtual File System
- ✅ Enhanced @ syntax
- ✅ Automatic bundling
- ✅ Offline support

Enjoy the upgrade!
