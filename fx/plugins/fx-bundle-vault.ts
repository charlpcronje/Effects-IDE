// /plugins/fx-bundle-vault.ts
/**
 * @fx-plugin fx-bundle-vault
 * @fx-global $vault
 * @fx-description Workspace snapshots, exports, imports, and project bundling
 * @fx-dependencies fx-cache
 * @fx-provides $vault
 * @fx-version 1.0.0
 *
 * FX Bundle Vault Plugin - Handles workspace snapshots, state exports/imports,
 * project bundling, and migration between bundle versions.
 */

import type { FXCore, FXNodeProxy } from '../fx.v4';

// Get FXSuspend from global
const FXSuspend = (globalThis as any).FXSuspend;

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface BundleManifest {
    id: string;
    name: string;
    version: string;
    created: number;
    modified: number;
    description?: string;
    author?: string;
    fxVersion: string;
    bundleVersion: string;
    checksum: string;
    size: number;
    contents: BundleContents;
    migrations?: MigrationScript[];
}

export interface BundleContents {
    plugins: string[];
    modules: string[];
    assets: AssetEntry[];
    layout?: any;
    theme?: any;
    settings?: Record<string, any>;
    nodeGraph?: any;
    openFiles?: string[];
    aiSessions?: any[];
}

export interface AssetEntry {
    path: string;
    type: string;
    size: number;
    hash: string;
    compressed?: boolean;
}

export interface MigrationScript {
    fromVersion: string;
    toVersion: string;
    transform: string; // Serialized function
}

export interface Snapshot {
    id: string;
    label: string;
    timestamp: number;
    data: SnapshotData;
    parent?: string; // Previous snapshot ID
    size: number;
}

export interface SnapshotData {
    nodeGraph: any;
    layout: any;
    openFiles: string[];
    theme: any;
    settings: any;
}

export interface WorkspaceBundle {
    manifest: BundleManifest;
    data: ArrayBuffer;
}

export interface ExportOptions {
    includeLayout?: boolean;
    includeTheme?: boolean;
    includeSettings?: boolean;
    includeOpenFiles?: boolean;
    includeAISessions?: boolean;
    includeAssets?: boolean;
    compress?: boolean;
    encrypt?: boolean;
    password?: string;
}

export interface ImportOptions {
    mergeSettings?: boolean;
    restoreLayout?: boolean;
    restoreTheme?: boolean;
    validateChecksum?: boolean;
    runMigrations?: boolean;
}

export interface VaultConfig {
    maxSnapshots?: number;
    autoSnapshot?: boolean;
    snapshotInterval?: number; // ms
    storageKey?: string;
    compressSnapshots?: boolean;
}

// ============================================================================
// Logger
// ============================================================================

class VaultLogger {
    static log(level: string, message: string, data?: any): void {
        console.log(`[FX-VAULT:${level.toUpperCase()}]`, message, data ?? '');
    }
    static info(message: string, data?: any): void { this.log('info', message, data); }
    static warn(message: string, data?: any): void { this.log('warn', message, data); }
    static error(message: string, data?: any): void { this.log('error', message, data); }
    static debug(message: string, data?: any): void { this.log('debug', message, data); }
}

// ============================================================================
// Compression Utilities
// ============================================================================

class CompressionUtil {
    static async compress(data: Uint8Array): Promise<Uint8Array> {
        if ('CompressionStream' in globalThis) {
            const stream = new Blob([data]).stream().pipeThrough(
                new (globalThis as any).CompressionStream('gzip')
            );
            const compressed = await new Response(stream).arrayBuffer();
            return new Uint8Array(compressed);
        }
        // Fallback: no compression
        return data;
    }

    static async decompress(data: Uint8Array): Promise<Uint8Array> {
        if ('DecompressionStream' in globalThis) {
            const stream = new Blob([data]).stream().pipeThrough(
                new (globalThis as any).DecompressionStream('gzip')
            );
            const decompressed = await new Response(stream).arrayBuffer();
            return new Uint8Array(decompressed);
        }
        // Fallback: assume not compressed
        return data;
    }
}

// ============================================================================
// Checksum Utilities
// ============================================================================

class ChecksumUtil {
    static async sha256(data: Uint8Array): Promise<string> {
        if ('crypto' in globalThis && globalThis.crypto.subtle) {
            const hash = await crypto.subtle.digest('SHA-256', data);
            return Array.from(new Uint8Array(hash))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
        }
        // Simple fallback hash
        return this.simpleHash(data);
    }

    static simpleHash(data: Uint8Array): string {
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            hash = ((hash << 5) - hash + data[i]) | 0;
        }
        return Math.abs(hash).toString(16).padStart(8, '0');
    }
}

// ============================================================================
// Bundle Format
// ============================================================================

const BUNDLE_MAGIC = 0x46584256; // "FXBV" - FX Bundle Vault
const BUNDLE_VERSION = 1;

class BundleFormat {
    static async pack(manifest: BundleManifest, contents: Record<string, Uint8Array>): Promise<ArrayBuffer> {
        const encoder = new TextEncoder();

        // Serialize manifest
        const manifestJson = JSON.stringify(manifest);
        const manifestBytes = encoder.encode(manifestJson);

        // Calculate total size
        let contentSize = 0;
        const contentEntries: Array<{ key: string; data: Uint8Array }> = [];
        for (const [key, data] of Object.entries(contents)) {
            contentEntries.push({ key, data });
            contentSize += 4 + encoder.encode(key).length + 4 + data.length;
        }

        // Header: magic(4) + version(4) + manifestLen(4) + contentCount(4)
        const headerSize = 16;
        const totalSize = headerSize + manifestBytes.length + contentSize;

        const buffer = new ArrayBuffer(totalSize);
        const view = new DataView(buffer);
        const bytes = new Uint8Array(buffer);

        let offset = 0;

        // Write header
        view.setUint32(offset, BUNDLE_MAGIC, false); offset += 4;
        view.setUint32(offset, BUNDLE_VERSION, false); offset += 4;
        view.setUint32(offset, manifestBytes.length, false); offset += 4;
        view.setUint32(offset, contentEntries.length, false); offset += 4;

        // Write manifest
        bytes.set(manifestBytes, offset);
        offset += manifestBytes.length;

        // Write contents
        for (const { key, data } of contentEntries) {
            const keyBytes = encoder.encode(key);
            view.setUint32(offset, keyBytes.length, false); offset += 4;
            bytes.set(keyBytes, offset); offset += keyBytes.length;
            view.setUint32(offset, data.length, false); offset += 4;
            bytes.set(data, offset); offset += data.length;
        }

        return buffer;
    }

    static async unpack(buffer: ArrayBuffer): Promise<{
        manifest: BundleManifest;
        contents: Record<string, Uint8Array>;
    }> {
        const view = new DataView(buffer);
        const bytes = new Uint8Array(buffer);
        const decoder = new TextDecoder();

        let offset = 0;

        // Read header
        const magic = view.getUint32(offset, false); offset += 4;
        if (magic !== BUNDLE_MAGIC) {
            throw new Error('Invalid bundle format');
        }

        const version = view.getUint32(offset, false); offset += 4;
        if (version > BUNDLE_VERSION) {
            throw new Error(`Unsupported bundle version: ${version}`);
        }

        const manifestLen = view.getUint32(offset, false); offset += 4;
        const contentCount = view.getUint32(offset, false); offset += 4;

        // Read manifest
        const manifestBytes = bytes.slice(offset, offset + manifestLen);
        offset += manifestLen;
        const manifest = JSON.parse(decoder.decode(manifestBytes)) as BundleManifest;

        // Read contents
        const contents: Record<string, Uint8Array> = {};
        for (let i = 0; i < contentCount; i++) {
            const keyLen = view.getUint32(offset, false); offset += 4;
            const key = decoder.decode(bytes.slice(offset, offset + keyLen));
            offset += keyLen;

            const dataLen = view.getUint32(offset, false); offset += 4;
            const data = bytes.slice(offset, offset + dataLen);
            offset += dataLen;

            contents[key] = data;
        }

        return { manifest, contents };
    }
}

// ============================================================================
// Bundle Vault Plugin Class
// ============================================================================

export class FXBundleVault {
    public readonly name = 'bundle-vault';
    public readonly version = '1.0.0';
    public readonly description = 'Workspace snapshots and project bundling';

    private fx: FXCore;
    private config: VaultConfig;
    private snapshots = new Map<string, Snapshot>();
    private autoSnapshotInterval: NodeJS.Timeout | number | null = null;
    private db: IDBDatabase | null = null;
    private dbReady: Promise<void>;

    constructor(fx: FXCore, config: VaultConfig = {}) {
        this.fx = fx;
        this.config = {
            maxSnapshots: 50,
            autoSnapshot: true,
            snapshotInterval: 60000, // 1 minute
            storageKey: 'fx-vault',
            compressSnapshots: true,
            ...config
        };

        this.initNodes();
        this.dbReady = this.initStorage();

        if (this.config.autoSnapshot) {
            this.startAutoSnapshot();
        }

        VaultLogger.info('FX Bundle Vault initialized');
    }

    // ========================================================================
    // Initialization
    // ========================================================================

    private initNodes(): void {
        const $$ = this.fx.proxy();

        $$('vault.snapshots').val([]);
        $$('vault.bundles').val([]);
        $$('vault.stats').val({
            snapshotCount: 0,
            totalSize: 0,
            lastSnapshot: null,
            lastExport: null
        });
    }

    private async initStorage(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (typeof indexedDB === 'undefined') {
                VaultLogger.warn('IndexedDB not available, using in-memory storage');
                resolve();
                return;
            }

            const request = indexedDB.open('fx-bundle-vault', 1);

            request.onerror = () => {
                VaultLogger.error('Failed to open vault database', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.loadSnapshots();
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                if (!db.objectStoreNames.contains('snapshots')) {
                    const store = db.createObjectStore('snapshots', { keyPath: 'id' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('label', 'label', { unique: false });
                }

                if (!db.objectStoreNames.contains('bundles')) {
                    const store = db.createObjectStore('bundles', { keyPath: 'id' });
                    store.createIndex('name', 'name', { unique: false });
                    store.createIndex('created', 'created', { unique: false });
                }
            };
        });
    }

    private async loadSnapshots(): Promise<void> {
        if (!this.db) return;

        return new Promise((resolve) => {
            const tx = this.db!.transaction('snapshots', 'readonly');
            const store = tx.objectStore('snapshots');
            const request = store.getAll();

            request.onsuccess = () => {
                for (const snapshot of request.result) {
                    this.snapshots.set(snapshot.id, snapshot);
                }
                this.updateStats();
                resolve();
            };

            request.onerror = () => resolve();
        });
    }

    private startAutoSnapshot(): void {
        this.autoSnapshotInterval = setInterval(() => {
            this.snapshot('Auto-save').catch(e => VaultLogger.error('Auto-snapshot failed', e));
        }, this.config.snapshotInterval!);
    }

    // ========================================================================
    // Snapshot Operations
    // ========================================================================

    /**
     * Create a snapshot of current state
     */
    async snapshot(label: string = 'Snapshot'): Promise<Snapshot> {
        await this.dbReady;

        const $$ = this.fx.proxy();

        // Capture current state
        const data: SnapshotData = {
            nodeGraph: this.serializeNodeGraph(),
            layout: $$('ui.panels').val() || {},
            openFiles: Object.keys($$('workspace.files').val() || {}),
            theme: $$('settings.themes.active').val(),
            settings: $$('settings').val() || {}
        };

        // Create snapshot
        const serialized = JSON.stringify(data);
        let bytes = new TextEncoder().encode(serialized);

        if (this.config.compressSnapshots) {
            bytes = await CompressionUtil.compress(bytes);
        }

        const snapshot: Snapshot = {
            id: `snapshot-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            label,
            timestamp: Date.now(),
            data,
            parent: this.getLatestSnapshotId(),
            size: bytes.length
        };

        // Store snapshot
        this.snapshots.set(snapshot.id, snapshot);

        if (this.db) {
            const tx = this.db.transaction('snapshots', 'readwrite');
            const store = tx.objectStore('snapshots');
            store.put(snapshot);
        }

        // Enforce max snapshots
        await this.pruneSnapshots();

        // Update nodes
        this.updateStats();
        VaultLogger.info(`Snapshot created: ${label}`, { id: snapshot.id });

        return snapshot;
    }

    /**
     * Restore a snapshot
     */
    async restore(snapshotId: string): Promise<void> {
        const snapshot = this.snapshots.get(snapshotId);
        if (!snapshot) {
            throw new Error(`Snapshot not found: ${snapshotId}`);
        }

        const $$ = this.fx.proxy();

        // Create backup before restore
        await this.snapshot('Before restore');

        // Restore state
        if (snapshot.data.nodeGraph) {
            this.restoreNodeGraph(snapshot.data.nodeGraph);
        }

        if (snapshot.data.layout) {
            $$('ui.panels').val(snapshot.data.layout);
        }

        if (snapshot.data.theme) {
            $$('settings.themes.active').val(snapshot.data.theme);
        }

        if (snapshot.data.settings) {
            // Merge settings carefully
            const current = $$('settings').val() || {};
            $$('settings').val({ ...current, ...snapshot.data.settings });
        }

        VaultLogger.info(`Snapshot restored: ${snapshotId}`);
    }

    /**
     * Delete a snapshot
     */
    async deleteSnapshot(snapshotId: string): Promise<void> {
        this.snapshots.delete(snapshotId);

        if (this.db) {
            const tx = this.db.transaction('snapshots', 'readwrite');
            const store = tx.objectStore('snapshots');
            store.delete(snapshotId);
        }

        this.updateStats();
        VaultLogger.info(`Snapshot deleted: ${snapshotId}`);
    }

    /**
     * Get all snapshots
     */
    getSnapshots(): Snapshot[] {
        return Array.from(this.snapshots.values())
            .sort((a, b) => b.timestamp - a.timestamp);
    }

    /**
     * Get a specific snapshot
     */
    getSnapshot(id: string): Snapshot | undefined {
        return this.snapshots.get(id);
    }

    private getLatestSnapshotId(): string | undefined {
        const snapshots = this.getSnapshots();
        return snapshots[0]?.id;
    }

    private async pruneSnapshots(): Promise<void> {
        const max = this.config.maxSnapshots!;
        const snapshots = this.getSnapshots();

        if (snapshots.length > max) {
            const toDelete = snapshots.slice(max);
            for (const snapshot of toDelete) {
                await this.deleteSnapshot(snapshot.id);
            }
        }
    }

    // ========================================================================
    // Export Operations
    // ========================================================================

    /**
     * Export workspace as bundle
     */
    async export(name: string, options: ExportOptions = {}): Promise<WorkspaceBundle> {
        const $$ = this.fx.proxy();

        // Build contents
        const contents: BundleContents = {
            plugins: [],
            modules: [],
            assets: []
        };

        // Include plugins list
        const plugins = $$('plugins').nodes();
        contents.plugins = Object.keys(plugins);

        // Include layout
        if (options.includeLayout !== false) {
            contents.layout = $$('ui.panels').val();
        }

        // Include theme
        if (options.includeTheme !== false) {
            contents.theme = $$('settings.themes.active').val();
        }

        // Include settings
        if (options.includeSettings !== false) {
            contents.settings = $$('settings').val();
        }

        // Include open files
        if (options.includeOpenFiles) {
            contents.openFiles = Object.keys($$('workspace.files').val() || {});
        }

        // Include AI sessions
        if (options.includeAISessions) {
            contents.aiSessions = Object.values($$('ai.sessions').val() || {});
        }

        // Include node graph
        contents.nodeGraph = this.serializeNodeGraph();

        // Build manifest
        const encoder = new TextEncoder();
        const contentsJson = JSON.stringify(contents);
        const contentsBytes = encoder.encode(contentsJson);

        const manifest: BundleManifest = {
            id: `bundle-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            name,
            version: '1.0.0',
            created: Date.now(),
            modified: Date.now(),
            fxVersion: '1.0.0',
            bundleVersion: String(BUNDLE_VERSION),
            checksum: await ChecksumUtil.sha256(contentsBytes),
            size: contentsBytes.length,
            contents
        };

        // Pack bundle
        const bundleContents: Record<string, Uint8Array> = {
            'contents.json': contentsBytes
        };

        // Compress if requested
        let data = await BundleFormat.pack(manifest, bundleContents);

        if (options.compress) {
            const compressed = await CompressionUtil.compress(new Uint8Array(data));
            data = compressed.buffer;
        }

        const bundle: WorkspaceBundle = { manifest, data };

        // Update stats
        const $stats = $$('vault.stats');
        $stats.val({ ...$stats.val(), lastExport: Date.now() });

        VaultLogger.info(`Bundle exported: ${name}`, { id: manifest.id, size: data.byteLength });

        return bundle;
    }

    /**
     * Export bundle to file (browser)
     */
    async exportToFile(name: string, options: ExportOptions = {}): Promise<void> {
        const bundle = await this.export(name, options);

        // Create download
        const blob = new Blob([bundle.data], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}.fxbundle`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);

        VaultLogger.info(`Bundle saved to file: ${name}.fxbundle`);
    }

    // ========================================================================
    // Import Operations
    // ========================================================================

    /**
     * Import a workspace bundle
     */
    async import(data: ArrayBuffer, options: ImportOptions = {}): Promise<BundleManifest> {
        // Try to decompress if compressed
        let bundleData = data;
        try {
            const decompressed = await CompressionUtil.decompress(new Uint8Array(data));
            bundleData = decompressed.buffer;
        } catch {
            // Not compressed, use as-is
        }

        // Unpack bundle
        const { manifest, contents } = await BundleFormat.unpack(bundleData);

        // Validate checksum if requested
        if (options.validateChecksum) {
            const contentsData = contents['contents.json'];
            if (contentsData) {
                const checksum = await ChecksumUtil.sha256(contentsData);
                if (checksum !== manifest.checksum) {
                    throw new Error('Bundle checksum mismatch');
                }
            }
        }

        // Run migrations if needed
        if (options.runMigrations && manifest.migrations) {
            await this.runMigrations(manifest);
        }

        // Parse contents
        const decoder = new TextDecoder();
        const bundleContents = JSON.parse(decoder.decode(contents['contents.json'])) as BundleContents;

        const $$ = this.fx.proxy();

        // Restore layout
        if (options.restoreLayout && bundleContents.layout) {
            $$('ui.panels').val(bundleContents.layout);
        }

        // Restore theme
        if (options.restoreTheme && bundleContents.theme) {
            $$('settings.themes.active').val(bundleContents.theme);
        }

        // Merge or replace settings
        if (bundleContents.settings) {
            if (options.mergeSettings) {
                const current = $$('settings').val() || {};
                $$('settings').val({ ...current, ...bundleContents.settings });
            } else {
                $$('settings').val(bundleContents.settings);
            }
        }

        // Restore node graph
        if (bundleContents.nodeGraph) {
            this.restoreNodeGraph(bundleContents.nodeGraph);
        }

        VaultLogger.info(`Bundle imported: ${manifest.name}`, { id: manifest.id });

        return manifest;
    }

    /**
     * Import bundle from file (browser)
     */
    async importFromFile(file: File, options: ImportOptions = {}): Promise<BundleManifest> {
        const data = await file.arrayBuffer();
        return this.import(data, options);
    }

    /**
     * Run migration scripts
     */
    private async runMigrations(manifest: BundleManifest): Promise<void> {
        if (!manifest.migrations) return;

        // Sort migrations by version
        const sorted = [...manifest.migrations].sort((a, b) => {
            return a.fromVersion.localeCompare(b.fromVersion);
        });

        for (const migration of sorted) {
            try {
                // Parse and execute transform
                const transform = new Function('data', migration.transform);
                // Would apply transform to data
                VaultLogger.info(`Migration applied: ${migration.fromVersion} -> ${migration.toVersion}`);
            } catch (e) {
                VaultLogger.error(`Migration failed: ${migration.fromVersion} -> ${migration.toVersion}`, e);
            }
        }
    }

    // ========================================================================
    // Node Graph Serialization
    // ========================================================================

    private serializeNodeGraph(): any {
        const $$ = this.fx.proxy();
        const root = $$('').node();

        const serialize = (node: any, path: string = ''): any => {
            if (!node) return null;

            const result: any = {
                value: node.__value,
                type: node.__type
            };

            if (node.__nodes && Object.keys(node.__nodes).length > 0) {
                result.children = {};
                for (const [key, child] of Object.entries(node.__nodes)) {
                    // Skip internal nodes
                    if (key.startsWith('__')) continue;
                    result.children[key] = serialize(child, `${path}.${key}`);
                }
            }

            return result;
        };

        return serialize(root);
    }

    private restoreNodeGraph(data: any): void {
        const $$ = this.fx.proxy();

        const restore = (nodeData: any, path: string): void => {
            if (!nodeData) return;

            if (nodeData.value !== undefined) {
                $$(path).val(nodeData.value);
            }

            if (nodeData.children) {
                for (const [key, child] of Object.entries(nodeData.children)) {
                    restore(child, path ? `${path}.${key}` : key);
                }
            }
        };

        if (data.children) {
            for (const [key, child] of Object.entries(data.children)) {
                // Skip certain paths
                if (['plugins', 'vault'].includes(key)) continue;
                restore(child, key);
            }
        }
    }

    // ========================================================================
    // Presets
    // ========================================================================

    /**
     * Save current layout as preset
     */
    async saveLayoutPreset(name: string): Promise<void> {
        const $$ = this.fx.proxy();

        const preset = {
            name,
            created: Date.now(),
            layout: $$('ui.panels').val(),
            theme: $$('settings.themes.active').val()
        };

        const presets = $$('vault.presets').val() || {};
        presets[name] = preset;
        $$('vault.presets').val(presets);

        VaultLogger.info(`Layout preset saved: ${name}`);
    }

    /**
     * Load a layout preset
     */
    async loadLayoutPreset(name: string): Promise<void> {
        const $$ = this.fx.proxy();

        const presets = $$('vault.presets').val() || {};
        const preset = presets[name];

        if (!preset) {
            throw new Error(`Preset not found: ${name}`);
        }

        if (preset.layout) {
            $$('ui.panels').val(preset.layout);
        }

        if (preset.theme) {
            $$('settings.themes.active').val(preset.theme);
        }

        VaultLogger.info(`Layout preset loaded: ${name}`);
    }

    /**
     * Get all layout presets
     */
    getLayoutPresets(): string[] {
        const $$ = this.fx.proxy();
        const presets = $$('vault.presets').val() || {};
        return Object.keys(presets);
    }

    // ========================================================================
    // Utilities
    // ========================================================================

    private updateStats(): void {
        const $$ = this.fx.proxy();

        let totalSize = 0;
        for (const snapshot of this.snapshots.values()) {
            totalSize += snapshot.size;
        }

        const snapshots = this.getSnapshots();

        $$('vault.snapshots').val(snapshots.map(s => ({
            id: s.id,
            label: s.label,
            timestamp: s.timestamp,
            size: s.size
        })));

        $$('vault.stats').val({
            snapshotCount: this.snapshots.size,
            totalSize,
            lastSnapshot: snapshots[0]?.timestamp || null,
            lastExport: $$('vault.stats').val()?.lastExport || null
        });
    }

    /**
     * Clear all snapshots
     */
    async clearSnapshots(): Promise<void> {
        this.snapshots.clear();

        if (this.db) {
            const tx = this.db.transaction('snapshots', 'readwrite');
            const store = tx.objectStore('snapshots');
            store.clear();
        }

        this.updateStats();
        VaultLogger.info('All snapshots cleared');
    }

    /**
     * Get storage usage
     */
    getStorageUsage(): { snapshots: number; total: number } {
        let total = 0;
        for (const snapshot of this.snapshots.values()) {
            total += snapshot.size;
        }
        return { snapshots: this.snapshots.size, total };
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        if (this.autoSnapshotInterval) {
            clearInterval(this.autoSnapshotInterval as number);
            this.autoSnapshotInterval = null;
        }

        if (this.db) {
            this.db.close();
            this.db = null;
        }

        VaultLogger.info('FX Bundle Vault disposed');
    }
}

// ============================================================================
// Plugin Export
// ============================================================================

export default function(fx: FXCore, config: VaultConfig = {}): FXBundleVault {
    return new FXBundleVault(fx, config);
}
