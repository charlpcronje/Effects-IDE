/**
 * Build FX Bundle for Dreamweaver IDE
 *
 * Creates a compressed bundle of all compiled modules for FX Disk VFS
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuration
const DIST_DIR = path.join(__dirname, '../dist');
const BUNDLE_OUTPUT = path.join(DIST_DIR, 'fx-bundle.bin');
const CHUNK_SIZE = 4096; // 4KB chunks

// Just scan the entire dist/renderer directory since TypeScript outputs everything there
const INCLUDE_DIRS = [
    path.join(DIST_DIR, 'renderer')
];

/**
 * Recursively collect all files from directories
 */
function collectFiles(dir, baseDir = dir) {
    const files = [];

    if (!fs.existsSync(dir)) {
        console.warn(`Directory not found: ${dir}`);
        return files;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            files.push(...collectFiles(fullPath, baseDir));
        } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.html'))) {
            const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
            files.push({
                path: relativePath,
                fullPath: fullPath,
                size: fs.statSync(fullPath).size
            });
        }
    }

    return files;
}

/**
 * Create chunks from content
 */
function createChunks(content, chunkSize = CHUNK_SIZE) {
    const chunks = [];
    const buffer = Buffer.from(content);

    for (let i = 0; i < buffer.length; i += chunkSize) {
        const chunk = buffer.slice(i, Math.min(i + chunkSize, buffer.length));
        const hash = crypto.createHash('sha256').update(chunk).digest('hex').substring(0, 16);
        chunks.push({
            hash,
            data: chunk.toString('base64'),
            size: chunk.length
        });
    }

    return chunks;
}

/**
 * Build the bundle
 */
function buildBundle() {
    console.log('[Bundle] Starting bundle build...\n');

    // Collect all files
    let allFiles = [];
    for (const dir of INCLUDE_DIRS) {
        const dirName = path.basename(dir);
        console.log(`[Bundle] Scanning ${dirName}/...`);
        const files = collectFiles(dir, DIST_DIR);
        console.log(`[Bundle]   Found ${files.length} files`);
        allFiles = allFiles.concat(files);
    }

    console.log(`\n[Bundle] Total files: ${allFiles.length}`);

    // Create bundle structure
    const bundle = {
        version: '1.0.0',
        created: new Date().toISOString(),
        files: {},
        chunks: {},
        metadata: {
            totalFiles: allFiles.length,
            totalSize: 0,
            chunkSize: CHUNK_SIZE
        }
    };

    // Process each file
    let totalSize = 0;
    const chunkDedup = new Map(); // For deduplication

    console.log('\n[Bundle] Processing files...');

    for (const file of allFiles) {
        const content = fs.readFileSync(file.fullPath, 'utf-8');
        const chunks = createChunks(content, CHUNK_SIZE);

        // Deduplicate chunks
        const fileChunks = [];
        for (const chunk of chunks) {
            if (!chunkDedup.has(chunk.hash)) {
                chunkDedup.set(chunk.hash, chunk);
                bundle.chunks[chunk.hash] = {
                    data: chunk.data,
                    size: chunk.size
                };
            }
            fileChunks.push(chunk.hash);
        }

        bundle.files[file.path] = {
            size: file.size,
            chunks: fileChunks,
            mtime: fs.statSync(file.fullPath).mtime.toISOString()
        };

        totalSize += file.size;

        if (allFiles.indexOf(file) % 10 === 0 || allFiles.indexOf(file) === allFiles.length - 1) {
            process.stdout.write(`\r[Bundle]   Processed ${allFiles.indexOf(file) + 1}/${allFiles.length} files`);
        }
    }

    console.log('\n');

    bundle.metadata.totalSize = totalSize;
    bundle.metadata.totalChunks = Object.keys(bundle.chunks).length;
    bundle.metadata.compressionRatio = (totalSize / JSON.stringify(bundle).length * 100).toFixed(2) + '%';

    // Write bundle
    console.log('[Bundle] Writing bundle...');
    const bundleJson = JSON.stringify(bundle);
    fs.writeFileSync(BUNDLE_OUTPUT, bundleJson);

    // Statistics
    const bundleSize = fs.statSync(BUNDLE_OUTPUT).size;
    console.log('\n[Bundle] Bundle created successfully!\n');
    console.log('Statistics:');
    console.log(`  Files:         ${bundle.metadata.totalFiles}`);
    console.log(`  Total size:    ${(totalSize / 1024).toFixed(2)} KB`);
    console.log(`  Unique chunks: ${bundle.metadata.totalChunks}`);
    console.log(`  Bundle size:   ${(bundleSize / 1024).toFixed(2)} KB`);
    console.log(`  Compression:   ${((1 - bundleSize / totalSize) * 100).toFixed(2)}% reduction`);
    console.log(`  Output:        ${BUNDLE_OUTPUT}`);
    console.log('');
}

// Run builder
try {
    buildBundle();
    process.exit(0);
} catch (error) {
    console.error('\n[Bundle] Error:', error.message);
    console.error(error.stack);
    process.exit(1);
}
