/**
 * FX Disk Loader for Dreamweaver IDE
 *
 * Simplified loader that works in Electron renderer with the bundle
 */

interface BundleFile {
    size: number;
    chunks: string[];
    mtime: string;
}

interface BundleChunk {
    data: string; // base64
    size: number;
}

interface Bundle {
    version: string;
    created: string;
    files: Record<string, BundleFile>;
    chunks: Record<string, BundleChunk>;
    metadata: {
        totalFiles: number;
        totalSize: number;
        totalChunks: number;
        chunkSize: number;
    };
}

/**
 * Simple VFS implementation
 */
class SimpleFXDiskVFS {
    private bundle: Bundle | null = null;
    private cache: Map<string, string> = new Map();

    /**
     * Initialize with bundle data
     */
    async init(bundlePath: string): Promise<void> {
        console.log('[FXDisk] Loading bundle from:', bundlePath);

        try {
            const response = await fetch(bundlePath);
            if (!response.ok) {
                throw new Error(`Failed to fetch bundle: ${response.statusText}`);
            }

            const bundleText = await response.text();
            this.bundle = JSON.parse(bundleText);

            if (this.bundle) {
                console.log(`[FXDisk] Bundle loaded:`);
                console.log(`  Files: ${this.bundle.metadata.totalFiles}`);
                console.log(`  Chunks: ${this.bundle.metadata.totalChunks}`);
                console.log(`  Size: ${(this.bundle.metadata.totalSize / 1024).toFixed(2)} KB`);
            }
        } catch (error) {
            console.error('[FXDisk] Failed to load bundle:', error);
            throw error;
        }
    }

    /**
     * Read a file from the VFS
     */
    read(filePath: string): string {
        if (!this.bundle) {
            throw new Error('[FXDisk] Bundle not initialized');
        }

        // Check cache first
        if (this.cache.has(filePath)) {
            return this.cache.get(filePath)!;
        }

        // Normalize path
        const normalizedPath = filePath.replace(/\\/g, '/');

        // Find file in bundle
        const fileInfo = this.bundle.files[normalizedPath];
        if (!fileInfo) {
            throw new Error(`[FXDisk] File not found: ${normalizedPath}`);
        }

        // Reconstruct file from chunks
        const chunks: Buffer[] = [];
        for (const chunkHash of fileInfo.chunks) {
            const chunk = this.bundle.chunks[chunkHash];
            if (!chunk) {
                throw new Error(`[FXDisk] Chunk not found: ${chunkHash}`);
            }
            chunks.push(Buffer.from(chunk.data, 'base64'));
        }

        const content = Buffer.concat(chunks).toString('utf-8');

        // Cache for future reads
        this.cache.set(filePath, content);

        return content;
    }

    /**
     * Check if file exists
     */
    exists(filePath: string): boolean {
        if (!this.bundle) return false;
        const normalizedPath = filePath.replace(/\\/g, '/');
        return normalizedPath in this.bundle.files;
    }

    /**
     * List all files
     */
    list(): string[] {
        if (!this.bundle) return [];
        return Object.keys(this.bundle.files);
    }

    /**
     * Get bundle metadata
     */
    getMetadata() {
        return this.bundle?.metadata;
    }
}

/**
 * Global VFS instance
 */
let vfs: SimpleFXDiskVFS | null = null;

/**
 * Initialize FX Disk VFS
 */
export async function initFXDisk(bundlePath: string): Promise<void> {
    if (vfs) {
        console.warn('[FXDisk] Already initialized');
        return;
    }

    vfs = new SimpleFXDiskVFS();
    await vfs.init(bundlePath);
}

/**
 * Load a module from VFS
 */
export function load(modulePath: string): any {
    if (!vfs) {
        throw new Error('[FXDisk] VFS not initialized. Call initFXDisk() first.');
    }

    const code = vfs.read(modulePath);

    // Create module wrapper
    const exports = {};
    const module = { exports };

    try {
        // Execute the module code
        const fn = new Function('exports', 'module', 'require', code);
        fn(exports, module, (path: string) => {
            // Simple require implementation
            if (path.startsWith('./') || path.startsWith('../')) {
                // Relative import - resolve relative to current module
                const resolved = resolvePath(modulePath, path);
                return load(resolved);
            }
            // Node module - return empty object (Three.js will be loaded separately)
            return {};
        });

        return module.exports;
    } catch (error) {
        console.error(`[FXDisk] Error loading module ${modulePath}:`, error);
        throw error;
    }
}

/**
 * Read raw file content
 */
export function read(filePath: string): string {
    if (!vfs) {
        throw new Error('[FXDisk] VFS not initialized');
    }
    return vfs.read(filePath);
}

/**
 * Check if file exists
 */
export function exists(filePath: string): boolean {
    if (!vfs) return false;
    return vfs.exists(filePath);
}

/**
 * List all files
 */
export function list(): string[] {
    if (!vfs) return [];
    return vfs.list();
}

/**
 * Get VFS metadata
 */
export function getMetadata() {
    if (!vfs) return null;
    return vfs.getMetadata();
}

/**
 * Resolve relative module path
 */
function resolvePath(from: string, to: string): string {
    const fromParts = from.split('/');
    fromParts.pop(); // Remove filename

    const toParts = to.split('/');

    for (const part of toParts) {
        if (part === '..') {
            fromParts.pop();
        } else if (part !== '.') {
            fromParts.push(part);
        }
    }

    let resolved = fromParts.join('/');

    // Add .js extension if not present
    if (!resolved.endsWith('.js')) {
        resolved += '.js';
    }

    return resolved;
}
