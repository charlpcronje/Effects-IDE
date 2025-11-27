# FXDisk WASM Smart Client

Zero-latency synchronous module loading with chunk-level deduplication and real-time hot shard updates.

## Features

- **WASM Virtual Filesystem** - All files stored in compressed, chunked format
- **4KB Chunk Deduplication** - Identical blocks stored and fetched once
- **LZ4 Streaming Decompression** - Fast, memory-efficient decompression
- **Adaptive Streaming Loader** - Frame-based downloads that never block UI
- **Hot Shard Updates** - Real-time delta updates from server
- **Sync API** - True synchronous file access (<1ms latency)
- **FX Framework Integration** - Drop-in replacement for SyncModuleLoader

## Quick Start

```typescript
import { initFXDisk, load, read } from './fx-disk/index.js';

// Load a pre-built bundle
await initFXDisk('https://example.com/fx-bundle.bin');

// Sync module loading (instant!)
const fx = load('fx.ts');
const plugin = load('plugins/my-plugin.ts');

// Sync file reading
const code = read('utils.ts');
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    FXDisk Client                         │
├─────────────────────────────────────────────────────────┤
│  State Machine: UNMOUNTED → STREAMING → READY           │
├──────────────┬──────────────┬───────────────────────────┤
│  Streaming   │  VFS         │  Hot Shard                │
│  Loader      │  (Chunks)    │  Handler                  │
├──────────────┴──────────────┴───────────────────────────┤
│  LZ4 Decompressor  │  Chunk Manager (4KB Dedup)         │
└─────────────────────────────────────────────────────────┘
```

## State Machine

```
UNMOUNTED
   ↓ load bundle
STREAMING
   ↓ chunks received
DECOMPRESSING
   ↓ write to VFS
READY
   ↓ hot shard
PATCHING → READY
```

## File Structure

```
fx-disk/
├── index.ts                 # Main entry point
├── fx-load.ts               # Minimal sync loader
├── fx-disk-client.ts        # Main client class
├── fx-disk-vfs.ts           # Virtual file system
├── fx-disk-chunks.ts        # Chunk deduplication
├── fx-disk-streaming.ts     # Adaptive streaming
├── fx-disk-hotshard.ts      # Hot shard handler
├── fx-disk-lz4.ts           # LZ4 decompressor
├── fx-disk-integration.ts   # FX Framework integration
├── fx-disk-types.ts         # TypeScript types
├── fx-disk-logger.ts        # Unified logger
├── demo.html                # Interactive demo
└── rust/
    └── lib.rs               # WASM VFS implementation
```

## Usage Examples

### Basic Loading

```typescript
import { load, read, exists } from './fx-disk/index.js';

// Load module
const module = load('my-module.ts');

// Read raw file
const content = read('config.json');

// Check existence
if (exists('optional.ts')) {
    load('optional.ts');
}
```

### fx.ts Integration (Drop-in Replacement)

The recommended way is to replace `SyncModuleLoader` in fx.ts:

```typescript
// In fx.ts, change line ~611 from:
this.moduleLoader = new SyncModuleLoader();

// To:
import { FXDiskSyncLoader } from './fx-disk/index.js';
this.moduleLoader = new FXDiskSyncLoader({
    bundleUrl: '/bundles/app.bin'  // Loads synchronously via XHR
});

// Or with embedded base64 bundle (no network):
import { FX_BUNDLE } from './dist/fx-bundle.js';
this.moduleLoader = new FXDiskSyncLoader({
    bundleBase64: FX_BUNDLE
});
```

Then the existing `@` syntax works exactly as before:

```typescript
// Load plugin with global registration
$$("@./plugins/db-plugin.ts").options({ global: "$db", type: "plugin" });

// Now use the plugin globally
$db.query("SELECT * FROM users");

// Load module with automatic execution
$$("@./utils/helpers.ts").options({ instantiateDefault: true });
```

### Runtime Bundle Loading (Also Sync)

```typescript
const loader = new FXDiskSyncLoader();

// Load bundle later - STILL SYNC (blocks but fast for local files)
loader.loadBundle('/bundles/plugins.bin');

// Now loads are instant
const code = loader.loadSync('./plugins/my-plugin.ts');
```

### FX Framework Integration (Alternative)

```typescript
import { FXCore } from './fx.ts';
import { FXDiskSyncLoader } from './fx-disk/index.js';

// Create FX with FXDisk loader (bundle loads sync in constructor)
class MyFXCore extends FXCore {
    constructor() {
        super();
        this.moduleLoader = new FXDiskSyncLoader({
            bundleUrl: '/bundles/app.bin'
        });
    }
}

const fx = new MyFXCore();
const $$ = fx.proxy();

// Instant! No await anywhere
$$('@./plugins/my-plugin.ts').options({ global: '$plugin' });
```

### Hot Shard Updates

```typescript
import { getFXDiskClient, createFXDiskIntegration } from './fx-disk/index.js';

const client = getFXDiskClient({
    hotShard: {
        serverUrl: 'wss://example.com/shards',
        reconnectDelay: 1000,
    }
});

// With FX integration
const { unsubscribe } = createFXDiskIntegration(fx, $$, {
    hotShard: { serverUrl: 'wss://example.com/shards' }
});

// Node updates from hot shards are auto-applied
client.connectHotShard();
```

### Custom Configuration

```typescript
import { getFXDiskClient, LogLevel } from './fx-disk/index.js';

const client = getFXDiskClient({
    logLevel: LogLevel.DEBUG,
    streaming: {
        initialChunkSize: 32768,
        targetFrameTime: 16,
        adaptiveEnabled: true,
    },
    hotShard: {
        serverUrl: 'wss://example.com/shards',
        maxReconnectAttempts: 10,
    }
});
```

## Performance

| Method           | Latency   | UI Blocking |
|------------------|-----------|-------------|
| Async fetch      | 50-200ms  | None        |
| Sync XHR         | 50-200ms  | **Yes**     |
| FXDisk VFS       | **<1ms**  | Negligible  |

## API Reference

### `load(path: string): unknown`
Synchronously load and execute a module.

### `read(path: string): string`
Synchronously read a file as string.

### `exists(path: string): boolean`
Check if file exists in VFS.

### `list(): string[]`
List all files in VFS.

### `loadBundle(url: string): Promise<number>`
Load bundle from URL.

### `loadBundleBase64(base64: string): Promise<number>`
Load bundle from base64 string.

### `getFXDiskClient(config?): FXDiskClient`
Get the singleton client instance.

### `patchFXWithDisk(fx, config?): FXDiskModuleLoader`
Patch FXCore to use FXDisk loader.

## Building WASM Module

```bash
cd fx-disk/rust
wasm-pack build --target web --out-dir ../dist/wasm
```

## License

MIT
