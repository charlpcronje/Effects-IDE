/**
 * @file fx-filesystem.js
 * @description FX Filesystem Plugin - Mirror FX Nodes to RamDisk (Server Only)
 * 
 * Features:
 * - Creates folder structure mirroring FX nodes
 * - Each property becomes a file with value as content
 * - Enables inter-process FX node sharing
 * - Real-time synchronization
 * - Server-only operation
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

// Promisified fs methods
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);
const rmdir = promisify(fs.rmdir);
const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);

/**
 * @class FXFilesystemPlugin
 * @description Plugin for mirroring FX nodes to filesystem (Server only)
 */
class FXFilesystemPlugin {
    constructor(fx, options = {}) {
        // Only works on server
        if (typeof window !== 'undefined') {
            throw new Error('FX[Filesystem]: This plugin only works on the server');
        }

        this.fx = fx;
        this.options = {
            baseDir: '/tmp/fx-nodes',  // RamDisk location
            autoSync: true,
            watchChanges: true,
            fileExtension: '.fxval',
            metadataFile: '.fxmeta',
            syncInterval: 1000,  // 1 second
            ...options
        };

        this.name = 'filesystem';
        this.version = '1.0.0';
        this.description = 'Mirror FX nodes to filesystem for inter-process sharing';

        this.syncActive = false;
        this.syncQueue = new Set();
        this.fileWatchers = new Map();
        this.nodePathMap = new Map(); // nodeId -> filesystem path

        // Override core methods to intercept node creation and updates
        this.originalCreateNode = this.fx.createNode.bind(this.fx);
        this.originalSet = this.fx.set.bind(this.fx);

        this.fx.createNode = this.interceptCreateNode.bind(this);
        this.fx.set = this.interceptSet.bind(this);

        this.initialize();

        console.log('FX[Filesystem]: Plugin initialized');
    }

    /**
     * @method initialize
     * @description Initialize the filesystem plugin
     */
    async initialize() {
        try {
            // Ensure base directory exists
            await this.ensureDirectory(this.options.baseDir);

            // Start sync if auto-sync enabled
            if (this.options.autoSync) {
                this.startSync();
            }

            // Start file watching if enabled
            if (this.options.watchChanges) {
                this.startFileWatching();
            }

            // Mirror existing root node
            await this.mirrorNodeToFilesystem(this.fx.root, this.options.baseDir);

        } catch (error) {
            console.error('FX[Filesystem]: Initialization failed:', error);
            throw error;
        }
    }

    /**
     * @method interceptCreateNode
     * @description Intercept node creation to mirror to filesystem
     * @param {string} parentId - Parent node ID
     * @returns {Object} Created node
     */
    interceptCreateNode(parentId) {
        const node = this.originalCreateNode(parentId);

        // Queue node for filesystem mirroring
        if (this.options.autoSync) {
            this.queueNodeForSync(node);
        }

        return node;
    }

    /**
     * @method interceptSet
     * @description Intercept value setting to mirror to filesystem
     * @param {Object} node - Target node
     * @param {*} value - Value to set
     */
    interceptSet(node, value) {
        // Call original set method
        this.originalSet(node, value);

        // Queue node for filesystem update
        if (this.options.autoSync) {
            this.queueNodeForSync(node);
        }
    }

    /**
     * @method queueNodeForSync
     * @description Queue a node for filesystem synchronization
     * @param {Object} node - Node to queue
     */
    queueNodeForSync(node) {
        this.syncQueue.add(node.__id);

        // Process queue on next tick
        process.nextTick(() => {
            this.processSyncQueue();
        });
    }

    /**
     * @method processSyncQueue
     * @description Process the synchronization queue
     */
    async processSyncQueue() {
        if (this.syncActive || this.syncQueue.size === 0) {
            return;
        }

        this.syncActive = true;

        try {
            const nodeIds = Array.from(this.syncQueue);
            this.syncQueue.clear();

            for (const nodeId of nodeIds) {
                const node = this.findNodeById(nodeId);
                if (node) {
                    await this.syncNodeToFilesystem(node);
                }
            }
        } catch (error) {
            console.error('FX[Filesystem]: Sync queue processing failed:', error);
        } finally {
            this.syncActive = false;
        }
    }

    /**
     * @method mirrorNodeToFilesystem
     * @description Mirror a node and its children to filesystem
     * @param {Object} node - Node to mirror
     * @param {string} basePath - Base filesystem path
     * @param {string} nodePath - Current node path
     */
    async mirrorNodeToFilesystem(node, basePath, nodePath = '') {
        const nodeDir = path.join(basePath, nodePath);

        // Ensure directory exists
        await this.ensureDirectory(nodeDir);

        // Store path mapping
        this.nodePathMap.set(node.__id, nodeDir);

        // Write node metadata
        await this.writeNodeMetadata(node, nodeDir);

        // Write node value if it exists
        if (node.__type && node.__value && node.__value[node.__type] !== undefined) {
            await this.writeNodeValue(node, nodeDir);
        }

        // Write instance data if it exists
        if (node.__instances && node.__instances.size > 0) {
            await this.writeNodeInstances(node, nodeDir);
        }

        // Recursively mirror child nodes
        if (node.__nodes) {
            for (const [key, childNode] of Object.entries(node.__nodes)) {
                const childPath = nodePath ? `${nodePath}/${key}` : key;
                await this.mirrorNodeToFilesystem(childNode, basePath, childPath);
            }
        }

        console.log(`FX[Filesystem]: Mirrored node to ${nodeDir}`);
    }

    /**
     * @method syncNodeToFilesystem
     * @description Sync a single node to filesystem
     * @param {Object} node - Node to sync
     */
    async syncNodeToFilesystem(node) {
        const nodeDir = this.nodePathMap.get(node.__id);

        if (!nodeDir) {
            // Node not yet mirrored, determine its path
            const nodePath = this.getNodePath(node);
            const fullPath = path.join(this.options.baseDir, nodePath);
            await this.mirrorNodeToFilesystem(node, this.options.baseDir, nodePath);
            return;
        }

        try {
            // Update metadata
            await this.writeNodeMetadata(node, nodeDir);

            // Update value
            if (node.__type && node.__value && node.__value[node.__type] !== undefined) {
                await this.writeNodeValue(node, nodeDir);
            }

            // Update instances
            if (node.__instances && node.__instances.size > 0) {
                await this.writeNodeInstances(node, nodeDir);
            }

        } catch (error) {
            console.error(`FX[Filesystem]: Failed to sync node ${node.__id}:`, error);
        }
    }

    /**
     * @method writeNodeMetadata
     * @description Write node metadata to filesystem
     * @param {Object} node - Node to write
     * @param {string} nodeDir - Directory path
     */
    async writeNodeMetadata(node, nodeDir) {
        const metadata = {
            __id: node.__id,
            __parent_id: node.__parent_id,
            __type: node.__type,
            __proto: node.__proto || [],
            __timestamp: Date.now(),
            __fx_version: this.version
        };

        const metadataPath = path.join(nodeDir, this.options.metadataFile);
        await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    }

    /**
     * @method writeNodeValue
     * @description Write node value to filesystem
     * @param {Object} node - Node to write
     * @param {string} nodeDir - Directory path
     */
    async writeNodeValue(node, nodeDir) {
        const value = node.__value[node.__type];
        const valueFile = path.join(nodeDir, `value${this.options.fileExtension}`);

        let content;
        if (typeof value === 'string') {
            content = value;
        } else if (typeof value === 'object') {
            content = JSON.stringify(value, null, 2);
        } else {
            content = String(value);
        }

        await writeFile(valueFile, content, 'utf8');

        // Also write type information
        const typeFile = path.join(nodeDir, `type${this.options.fileExtension}`);
        await writeFile(typeFile, node.__type, 'utf8');
    }

    /**
     * @method writeNodeInstances
     * @description Write node instances to filesystem
     * @param {Object} node - Node to write
     * @param {string} nodeDir - Directory path
     */
    async writeNodeInstances(node, nodeDir) {
        const instancesDir = path.join(nodeDir, 'instances');
        await this.ensureDirectory(instancesDir);

        for (const [className, instance] of node.__instances.entries()) {
            const instanceFile = path.join(instancesDir, `${className}${this.options.fileExtension}`);

            // Serialize instance properties
            const instanceData = {};
            for (const key in instance) {
                if (instance.hasOwnProperty(key) && typeof instance[key] !== 'function') {
                    instanceData[key] = instance[key];
                }
            }

            await writeFile(instanceFile, JSON.stringify(instanceData, null, 2), 'utf8');
        }
    }

    /**
     * @method loadNodeFromFilesystem
     * @description Load a node from filesystem
     * @param {string} nodeDir - Directory path
     * @returns {Object} Loaded node data
     */
    async loadNodeFromFilesystem(nodeDir) {
        try {
            // Load metadata
            const metadataPath = path.join(nodeDir, this.options.metadataFile);
            const metadataContent = await readFile(metadataPath, 'utf8');
            const metadata = JSON.parse(metadataContent);

            // Load value if exists
            const valueFile = path.join(nodeDir, `value${this.options.fileExtension}`);
            const typeFile = path.join(nodeDir, `type${this.options.fileExtension}`);

            let value, type;
            try {
                const valueContent = await readFile(valueFile, 'utf8');
                const typeContent = await readFile(typeFile, 'utf8');

                type = typeContent.trim();

                if (type === 'json') {
                    value = JSON.parse(valueContent);
                } else if (type === 'num') {
                    value = parseFloat(valueContent);
                } else if (type === 'bool') {
                    value = valueContent.trim() === 'true';
                } else {
                    value = valueContent;
                }
            } catch (e) {
                // Value files don't exist
            }

            // Load instances if they exist
            const instancesDir = path.join(nodeDir, 'instances');
            const instances = new Map();

            try {
                const instanceFiles = await readdir(instancesDir);
                for (const file of instanceFiles) {
                    if (file.endsWith(this.options.fileExtension)) {
                        const className = file.replace(this.options.fileExtension, '');
                        const instancePath = path.join(instancesDir, file);
                        const instanceContent = await readFile(instancePath, 'utf8');
                        const instanceData = JSON.parse(instanceContent);
                        instances.set(className, instanceData);
                    }
                }
            } catch (e) {
                // Instances directory doesn't exist
            }

            return {
                metadata,
                value,
                type,
                instances
            };

        } catch (error) {
            console.error(`FX[Filesystem]: Failed to load node from ${nodeDir}:`, error);
            return null;
        }
    }

    /**
     * @method startFileWatching
     * @description Start watching filesystem for changes
     */
    startFileWatching() {
        if (typeof fs.watch !== 'function') {
            console.warn('FX[Filesystem]: File watching not supported');
            return;
        }

        try {
            const watcher = fs.watch(this.options.baseDir, { recursive: true }, (eventType, filename) => {
                if (filename && filename.endsWith(this.options.fileExtension)) {
                    this.handleFileChange(eventType, filename);
                }
            });

            this.fileWatchers.set('root', watcher);
            console.log('FX[Filesystem]: File watching started');

        } catch (error) {
            console.error('FX[Filesystem]: Failed to start file watching:', error);
        }
    }

    /**
     * @method handleFileChange
     * @description Handle filesystem changes
     * @param {string} eventType - Type of change (rename, change)
     * @param {string} filename - Changed filename
     */
    handleFileChange(eventType, filename) {
        console.log(`FX[Filesystem]: File ${eventType}: ${filename}`);

        // Debounce file changes
        setTimeout(() => {
            this.syncFileToNode(filename);
        }, 100);
    }

    /**
     * @method syncFileToNode
     * @description Sync filesystem changes back to FX nodes
     * @param {string} filename - Changed filename
     */
    async syncFileToNode(filename) {
        try {
            const fullPath = path.join(this.options.baseDir, filename);
            const nodeDir = path.dirname(fullPath);

            // Find corresponding node
            const nodeId = Array.from(this.nodePathMap.entries())
                .find(([id, dir]) => dir === nodeDir)?.[0];

            if (!nodeId) {
                console.warn(`FX[Filesystem]: No node found for path ${nodeDir}`);
                return;
            }

            const node = this.findNodeById(nodeId);
            if (!node) {
                console.warn(`FX[Filesystem]: Node ${nodeId} not found`);
                return;
            }

            // Load updated data from filesystem
            const nodeData = await this.loadNodeFromFilesystem(nodeDir);
            if (!nodeData) return;

            // Update node with filesystem data
            if (nodeData.type && nodeData.value !== undefined) {
                // Temporarily disable our set interceptor to avoid infinite loop
                this.originalSet(node, nodeData.value);
            }

            console.log(`FX[Filesystem]: Synced file changes to node ${nodeId}`);

        } catch (error) {
            console.error('FX[Filesystem]: Failed to sync file to node:', error);
        }
    }

    /**
     * @method ensureDirectory
     * @description Ensure directory exists
     * @param {string} dir - Directory path
     */
    async ensureDirectory(dir) {
        try {
            await stat(dir);
        } catch (error) {
            if (error.code === 'ENOENT') {
                await mkdir(dir, { recursive: true });
            } else {
                throw error;
            }
        }
    }

    /**
     * @method getNodePath
     * @description Get filesystem path for a node
     * @param {Object} node - Node to get path for
     * @returns {string} Filesystem path
     */
    getNodePath(node) {
        const pathParts = [];
        let current = node;

        while (current && current.__parent_id) {
            // Find parent node
            const parent = this.findNodeById(current.__parent_id);
            if (parent && parent.__nodes) {
                // Find the key for this node in parent's nodes
                for (const [key, childNode] of Object.entries(parent.__nodes)) {
                    if (childNode.__id === current.__id) {
                        pathParts.unshift(key);
                        break;
                    }
                }
            }
            current = parent;
        }

        return pathParts.join('/');
    }

    /**
     * @method findNodeById
     * @description Find a node by ID
     * @param {string} nodeId - Node ID
     * @param {Object} startNode - Starting node for search
     * @returns {Object|null} Found node
     */
    findNodeById(nodeId, startNode = this.fx.root) {
        if (startNode.__id === nodeId) {
            return startNode;
        }

        if (startNode.__nodes) {
            for (const childNode of Object.values(startNode.__nodes)) {
                const found = this.findNodeById(nodeId, childNode);
                if (found) return found;
            }
        }

        return null;
    }

    /**
     * @method startSync
     * @description Start periodic synchronization
     */
    startSync() {
        this.syncTimer = setInterval(() => {
            this.processSyncQueue();
        }, this.options.syncInterval);

        console.log('FX[Filesystem]: Periodic sync started');
    }

    /**
     * @method stopSync
     * @description Stop periodic synchronization
     */
    stopSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }
    }

    /**
     * @method stats
     * @description Get filesystem plugin statistics
     * @returns {Object} Statistics
     */
    stats() {
        return {
            baseDir: this.options.baseDir,
            autoSync: this.options.autoSync,
            watchChanges: this.options.watchChanges,
            syncQueueSize: this.syncQueue.size,
            nodePathMappings: this.nodePathMap.size,
            fileWatchers: this.fileWatchers.size
        };
    }

    /**
     * @method destroy
     * @description Clean up the plugin
     */
    destroy() {
        // Stop sync
        this.stopSync();

        // Close file watchers
        for (const watcher of this.fileWatchers.values()) {
            watcher.close();
        }
        this.fileWatchers.clear();

        // Restore original methods
        this.fx.createNode = this.originalCreateNode;
        this.fx.set = this.originalSet;

        console.log('FX[Filesystem]: Plugin destroyed');
    }
}

// Export as function that creates instance
export default function (fx, options) {
    return new FXFilesystemPlugin(fx, options);
}