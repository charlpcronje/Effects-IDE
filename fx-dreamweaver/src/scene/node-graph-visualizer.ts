/**
 * Node Graph Visualizer - Visualizes FX node tree on the 3D grid
 */

import * as THREE from 'three';
import { SceneManager } from './scene-manager';
import { FXBridge, FXNode } from '../renderer/fx-bridge';
import { ConnectionManager } from './connection-manager';

export interface VisualNode {
    id: string;
    path: string;
    node: FXNode;
    position: THREE.Vector3;
    mesh: THREE.Mesh;
    label: THREE.Sprite;
    children: VisualNode[];
}

export interface NodeGraphConfig {
    nodeSize: number;
    nodeHeight: number;
    nodeSpacing: number;
    levelSpacing: number;
    baseColor: number;
    valueColor: number;
    behaviorColor: number;
    selectedColor: number;
}

export class NodeGraphVisualizer {
    private sceneManager: SceneManager;
    private fxBridge: FXBridge;
    private connectionManager: ConnectionManager;
    private config: NodeGraphConfig;

    private visualNodes: Map<string, VisualNode> = new Map();
    private selectedNodePath: string | null = null;
    private rootPosition: THREE.Vector3 = new THREE.Vector3(-800, 400, 0);

    private isVisible: boolean = false;

    constructor(
        sceneManager: SceneManager,
        fxBridge: FXBridge,
        connectionManager: ConnectionManager,
        config?: Partial<NodeGraphConfig>
    ) {
        this.sceneManager = sceneManager;
        this.fxBridge = fxBridge;
        this.connectionManager = connectionManager;

        this.config = {
            nodeSize: 80,
            nodeHeight: 30,
            nodeSpacing: 120,
            levelSpacing: 150,
            baseColor: 0x1e293b,
            valueColor: 0x3b82f6,
            behaviorColor: 0x8b5cf6,
            selectedColor: 0x10b981,
            ...config
        };
    }

    /**
     * Initialize node graph
     */
    init(): void {
        console.log('[NodeGraph] Initialized');
    }

    /**
     * Show the node graph
     */
    show(): void {
        if (this.isVisible) return;

        this.isVisible = true;
        this.buildGraph();

        console.log('[NodeGraph] Showing graph');
    }

    /**
     * Hide the node graph
     */
    hide(): void {
        if (!this.isVisible) return;

        this.isVisible = false;
        this.clearGraph();

        console.log('[NodeGraph] Hiding graph');
    }

    /**
     * Toggle visibility
     */
    toggle(): void {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Build the visual graph from FX node tree
     */
    private buildGraph(): void {
        const rootNode = this.fxBridge.getRoot();
        this.visualNodes.clear();

        // Build visual tree
        this.buildVisualTree(rootNode, '', this.rootPosition, 0);

        console.log(`[NodeGraph] Built graph with ${this.visualNodes.size} nodes`);
    }

    /**
     * Build visual tree recursively
     */
    private buildVisualTree(
        node: FXNode,
        path: string,
        position: THREE.Vector3,
        level: number
    ): VisualNode | null {
        // Skip if too deep
        if (level > 5) return null;

        // Determine node color
        let color = this.config.baseColor;
        if (node.__value !== undefined) {
            color = this.config.valueColor;
        }
        if (node.__behaviors && node.__behaviors.size > 0) {
            color = this.config.behaviorColor;
        }

        // Create node mesh
        const geometry = new THREE.BoxGeometry(
            this.config.nodeSize,
            this.config.nodeSize,
            this.config.nodeHeight
        );

        const material = new THREE.MeshPhongMaterial({
            color,
            transparent: true,
            opacity: 0.85,
            emissive: color,
            emissiveIntensity: 0.2
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        mesh.userData = {
            type: 'fx-node',
            nodePath: path,
            nodeId: node.__id
        };
        mesh.castShadow = true;

        this.sceneManager.add(mesh);

        // Create label
        const label = this.createLabel(node.__id || 'root', position);
        this.sceneManager.add(label);

        // Create visual node
        const visualNode: VisualNode = {
            id: node.__id,
            path,
            node,
            position: position.clone(),
            mesh,
            label,
            children: []
        };

        this.visualNodes.set(path, visualNode);

        // Process children
        const childKeys = Object.keys(node.__nodes);
        if (childKeys.length > 0) {
            const childStartX = position.x - ((childKeys.length - 1) * this.config.nodeSpacing) / 2;

            for (let i = 0; i < childKeys.length; i++) {
                const childKey = childKeys[i];
                const childNode = node.__nodes[childKey];
                const childPath = path ? `${path}.${childKey}` : childKey;

                const childPosition = new THREE.Vector3(
                    childStartX + i * this.config.nodeSpacing,
                    position.y - this.config.levelSpacing,
                    position.z
                );

                const childVisual = this.buildVisualTree(childNode, childPath, childPosition, level + 1);

                if (childVisual) {
                    visualNode.children.push(childVisual);

                    // Create connection line
                    const connId = `node-${path}-${childPath}`;
                    this.connectionManager.createConnection(
                        connId,
                        position,
                        childPosition,
                        0x60a5fa
                    );
                }
            }
        }

        return visualNode;
    }

    /**
     * Create label sprite for node
     */
    private createLabel(text: string, position: THREE.Vector3): THREE.Sprite {
        // Create canvas for text
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.width = 256;
        canvas.height = 64;

        // Background
        context.fillStyle = '#1e293b';
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Text
        context.font = 'bold 24px monospace';
        context.fillStyle = '#f1f5f9';
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        // Truncate long text
        const displayText = text.length > 12 ? text.substring(0, 10) + '...' : text;
        context.fillText(displayText, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 0.9
        });

        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(60, 15, 1);
        sprite.position.set(position.x, position.y, position.z + this.config.nodeHeight / 2 + 15);

        return sprite;
    }

    /**
     * Clear the graph
     */
    private clearGraph(): void {
        for (const visualNode of this.visualNodes.values()) {
            this.sceneManager.remove(visualNode.mesh);
            this.sceneManager.remove(visualNode.label);

            visualNode.mesh.geometry.dispose();
            if (visualNode.mesh.material instanceof THREE.Material) {
                visualNode.mesh.material.dispose();
            }

            visualNode.label.material.dispose();
            if (visualNode.label.material.map) {
                visualNode.label.material.map.dispose();
            }

            // Remove connection
            const connId = `node-${visualNode.path}`;
            this.connectionManager.removeConnection(connId);
        }

        this.visualNodes.clear();
    }

    /**
     * Handle node click
     */
    handleNodeClick(nodePath: string, ctrlKey: boolean = false): void {
        console.log(`[NodeGraph] Node clicked: ${nodePath}, ctrl: ${ctrlKey}`);

        if (ctrlKey) {
            // Ctrl+click - jump to code (emit event)
            this.fxBridge.emit('node.jumpToCode', { nodePath });
            console.log(`[NodeGraph] Jumping to code for: ${nodePath}`);

            // Try to find the file that defines this node
            // For now, just log - in full implementation, this would open the file in editor
            const node = this.fxBridge.get(nodePath);
            if (node !== undefined) {
                console.log(`[NodeGraph] Node value:`, node);
            }
        } else {
            // Regular click - select node
            this.selectNode(nodePath);
        }
    }

    /**
     * Select a node
     */
    selectNode(nodePath: string): void {
        // Deselect previous
        if (this.selectedNodePath) {
            const prev = this.visualNodes.get(this.selectedNodePath);
            if (prev) {
                (prev.mesh.material as THREE.MeshPhongMaterial).emissive.setHex(
                    (prev.mesh.material as THREE.MeshPhongMaterial).color.getHex()
                );
                (prev.mesh.material as THREE.MeshPhongMaterial).emissiveIntensity = 0.2;
            }
        }

        // Select new
        const visualNode = this.visualNodes.get(nodePath);
        if (visualNode) {
            (visualNode.mesh.material as THREE.MeshPhongMaterial).emissive.setHex(this.config.selectedColor);
            (visualNode.mesh.material as THREE.MeshPhongMaterial).emissiveIntensity = 0.6;
            this.selectedNodePath = nodePath;

            // Focus camera on node
            this.sceneManager.focusOn(visualNode.position);
        }
    }

    /**
     * Refresh the graph
     */
    refresh(): void {
        if (!this.isVisible) return;

        this.clearGraph();
        this.buildGraph();
    }

    /**
     * Update (animate nodes)
     */
    update(): void {
        if (!this.isVisible) return;

        const time = Date.now() * 0.001;
        const camera = this.sceneManager.getCamera();

        // Make labels face camera
        for (const visualNode of this.visualNodes.values()) {
            visualNode.label.quaternion.copy(camera.quaternion);

            // Gentle float animation
            const float = Math.sin(time + visualNode.position.x * 0.01) * 2;
            visualNode.label.position.z = visualNode.position.z + this.config.nodeHeight / 2 + 15 + float;
        }

        // Pulse selected node
        if (this.selectedNodePath) {
            const selected = this.visualNodes.get(this.selectedNodePath);
            if (selected) {
                const pulse = Math.sin(time * 3) * 0.5 + 0.5;
                (selected.mesh.material as THREE.MeshPhongMaterial).emissiveIntensity = 0.4 + pulse * 0.3;
            }
        }
    }

    /**
     * Get visual node by path
     */
    getVisualNode(path: string): VisualNode | undefined {
        return this.visualNodes.get(path);
    }

    /**
     * Check if graph is visible
     */
    isGraphVisible(): boolean {
        return this.isVisible;
    }

    /**
     * Dispose
     */
    dispose(): void {
        this.clearGraph();
    }
}
