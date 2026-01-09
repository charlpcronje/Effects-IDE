/**
 * Grid Manager - Manages the interactive 3D grid with extrudable blocks
 */

import * as THREE from 'three';
import { SceneManager } from './scene-manager';

export interface GridBlock {
    id: string;
    gridX: number;
    gridY: number;
    height: number;
    mesh: THREE.Mesh;
    outline: THREE.LineSegments;
}

export interface GridConfig {
    size: number;
    divisions: number;
    cellSize: number;
    maxHeight: number;
    defaultColor: number;
    hoverColor: number;
    selectedColor: number;
}

export class GridManager {
    private sceneManager: SceneManager;
    private config: GridConfig;
    private blocks: Map<string, GridBlock> = new Map();
    private gridHelper: THREE.GridHelper;
    private hoveredCell: { x: number; y: number } | null = null;
    private selectedBlocks: Set<string> = new Set();

    private readonly GRID_PLANE_Y = 0;

    constructor(sceneManager: SceneManager, config?: Partial<GridConfig>) {
        this.sceneManager = sceneManager;
        this.config = {
            size: 2000,
            divisions: 40,
            cellSize: 50,
            maxHeight: 500,
            defaultColor: 0x1e293b,
            hoverColor: 0x3b82f6,
            selectedColor: 0x8b5cf6,
            ...config
        };

        // Create grid
        this.gridHelper = new THREE.GridHelper(
            this.config.size,
            this.config.divisions,
            0x334155,  // Center line
            0x1e293b   // Grid lines
        );
        this.gridHelper.rotation.x = Math.PI / 2;
        this.gridHelper.position.z = this.GRID_PLANE_Y;
    }

    /**
     * Initialize grid
     */
    init(): void {
        this.sceneManager.add(this.gridHelper);
        console.log('[GridManager] Initialized');
    }

    /**
     * Get grid cell from world position
     */
    getGridCell(x: number, y: number): { x: number; y: number } {
        const cellX = Math.floor(x / this.config.cellSize);
        const cellY = Math.floor(y / this.config.cellSize);
        return { x: cellX, y: cellY };
    }

    /**
     * Get world position from grid cell
     */
    getCellWorldPosition(cellX: number, cellY: number): { x: number; y: number } {
        return {
            x: cellX * this.config.cellSize + this.config.cellSize / 2,
            y: cellY * this.config.cellSize + this.config.cellSize / 2
        };
    }

    /**
     * Get block ID from grid coordinates
     */
    private getBlockId(cellX: number, cellY: number): string {
        return `block-${cellX}-${cellY}`;
    }

    /**
     * Check if block exists at cell
     */
    hasBlock(cellX: number, cellY: number): boolean {
        return this.blocks.has(this.getBlockId(cellX, cellY));
    }

    /**
     * Get block at cell
     */
    getBlock(cellX: number, cellY: number): GridBlock | undefined {
        return this.blocks.get(this.getBlockId(cellX, cellY));
    }

    /**
     * Extrude a block at grid cell
     */
    extrudeBlock(cellX: number, cellY: number, height: number = this.config.cellSize): GridBlock {
        const id = this.getBlockId(cellX, cellY);

        // If block exists, increase height
        const existing = this.blocks.get(id);
        if (existing) {
            const newHeight = Math.min(existing.height + height, this.config.maxHeight);
            this.setBlockHeight(cellX, cellY, newHeight);
            return existing;
        }

        // Create new block
        const worldPos = this.getCellWorldPosition(cellX, cellY);

        const geometry = new THREE.BoxGeometry(
            this.config.cellSize - 2,
            this.config.cellSize - 2,
            height
        );

        const material = new THREE.MeshPhongMaterial({
            color: this.config.defaultColor,
            transparent: true,
            opacity: 0.9,
            shininess: 30,
            emissive: 0x0f172a,
            emissiveIntensity: 0.2
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(worldPos.x, worldPos.y, height / 2);
        mesh.userData = {
            type: 'grid-block',
            gridX: cellX,
            gridY: cellY,
            blockId: id
        };
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Create outline
        const edges = new THREE.EdgesGeometry(geometry);
        const outline = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color: 0x3b82f6, opacity: 0.5, transparent: true })
        );
        outline.position.copy(mesh.position);

        // Add to scene
        this.sceneManager.add(mesh);
        this.sceneManager.add(outline);

        // Store block
        const block: GridBlock = {
            id,
            gridX: cellX,
            gridY: cellY,
            height,
            mesh,
            outline
        };
        this.blocks.set(id, block);

        console.log(`[GridManager] Extruded block at (${cellX}, ${cellY}) height: ${height}`);
        return block;
    }

    /**
     * Set block height
     */
    setBlockHeight(cellX: number, cellY: number, newHeight: number): void {
        const block = this.getBlock(cellX, cellY);
        if (!block) return;

        newHeight = Math.max(0, Math.min(newHeight, this.config.maxHeight));

        // Update geometry
        const geometry = new THREE.BoxGeometry(
            this.config.cellSize - 2,
            this.config.cellSize - 2,
            newHeight
        );

        block.mesh.geometry.dispose();
        block.mesh.geometry = geometry;
        block.mesh.position.z = newHeight / 2;

        // Update outline
        const edges = new THREE.EdgesGeometry(geometry);
        block.outline.geometry.dispose();
        block.outline.geometry = edges;
        block.outline.position.copy(block.mesh.position);

        block.height = newHeight;

        // If height is 0, remove the block
        if (newHeight <= 0) {
            this.removeBlock(cellX, cellY);
        }
    }

    /**
     * Remove a block
     */
    removeBlock(cellX: number, cellY: number): void {
        const id = this.getBlockId(cellX, cellY);
        const block = this.blocks.get(id);
        if (!block) return;

        this.sceneManager.remove(block.mesh);
        this.sceneManager.remove(block.outline);

        block.mesh.geometry.dispose();
        if (block.mesh.material instanceof THREE.Material) {
            block.mesh.material.dispose();
        }
        block.outline.geometry.dispose();
        if (block.outline.material instanceof THREE.Material) {
            block.outline.material.dispose();
        }

        this.blocks.delete(id);
        this.selectedBlocks.delete(id);
    }

    /**
     * Handle grid click
     */
    handleGridClick(worldX: number, worldY: number, isShiftClick: boolean = false): void {
        const cell = this.getGridCell(worldX, worldY);

        if (isShiftClick) {
            // Shift+click lowers or removes block
            const block = this.getBlock(cell.x, cell.y);
            if (block) {
                const newHeight = block.height - this.config.cellSize;
                if (newHeight <= 0) {
                    this.removeBlock(cell.x, cell.y);
                } else {
                    this.setBlockHeight(cell.x, cell.y, newHeight);
                }
            }
        } else {
            // Regular click extrudes
            this.extrudeBlock(cell.x, cell.y, this.config.cellSize);
        }
    }

    /**
     * Extrude block from side (horizontal extrusion)
     */
    extrudeFromSide(
        sourceX: number,
        sourceY: number,
        direction: 'north' | 'south' | 'east' | 'west'
    ): GridBlock | null {
        // Check if source block exists
        const sourceBlock = this.getBlock(sourceX, sourceY);
        if (!sourceBlock) {
            console.warn('[GridManager] Source block not found for side extrusion');
            return null;
        }

        // Calculate target cell
        let targetX = sourceX;
        let targetY = sourceY;

        switch (direction) {
            case 'north':
                targetY += 1;
                break;
            case 'south':
                targetY -= 1;
                break;
            case 'east':
                targetX += 1;
                break;
            case 'west':
                targetX -= 1;
                break;
        }

        // Create or extend target block to match source height
        const targetBlock = this.extrudeBlock(targetX, targetY, 0);
        this.setBlockHeight(targetX, targetY, sourceBlock.height);

        console.log(`[GridManager] Extruded ${direction} from (${sourceX},${sourceY}) to (${targetX},${targetY})`);
        return targetBlock;
    }

    /**
     * Handle grid hover
     */
    handleGridHover(worldX: number, worldY: number): void {
        const cell = this.getGridCell(worldX, worldY);

        // Update hovered cell
        if (!this.hoveredCell || this.hoveredCell.x !== cell.x || this.hoveredCell.y !== cell.y) {
            this.hoveredCell = cell;

            // Highlight cell (create temporary visual feedback)
            const block = this.getBlock(cell.x, cell.y);
            if (block) {
                (block.mesh.material as THREE.MeshPhongMaterial).emissive.setHex(0x3b82f6);
                (block.mesh.material as THREE.MeshPhongMaterial).emissiveIntensity = 0.4;
            }
        }
    }

    /**
     * Clear hover state
     */
    clearHover(): void {
        // Reset all blocks to default emissive
        for (const block of this.blocks.values()) {
            (block.mesh.material as THREE.MeshPhongMaterial).emissive.setHex(0x0f172a);
            (block.mesh.material as THREE.MeshPhongMaterial).emissiveIntensity = 0.2;
        }
        this.hoveredCell = null;
    }

    /**
     * Select a block
     */
    selectBlock(cellX: number, cellY: number): void {
        const id = this.getBlockId(cellX, cellY);
        const block = this.getBlock(cellX, cellY);
        if (!block) return;

        this.selectedBlocks.add(id);
        (block.mesh.material as THREE.MeshPhongMaterial).color.setHex(this.config.selectedColor);
    }

    /**
     * Deselect a block
     */
    deselectBlock(cellX: number, cellY: number): void {
        const id = this.getBlockId(cellX, cellY);
        const block = this.getBlock(cellX, cellY);
        if (!block) return;

        this.selectedBlocks.delete(id);
        (block.mesh.material as THREE.MeshPhongMaterial).color.setHex(this.config.defaultColor);
    }

    /**
     * Deselect all blocks
     */
    deselectAllBlocks(): void {
        for (const id of this.selectedBlocks) {
            const block = this.blocks.get(id);
            if (block) {
                (block.mesh.material as THREE.MeshPhongMaterial).color.setHex(this.config.defaultColor);
            }
        }
        this.selectedBlocks.clear();
    }

    /**
     * Get all blocks
     */
    getAllBlocks(): GridBlock[] {
        return Array.from(this.blocks.values());
    }

    /**
     * Get surface normal for a block face
     */
    getSurfaceNormal(block: GridBlock, face: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right'): THREE.Vector3 {
        const normals = {
            'top': new THREE.Vector3(0, 0, 1),
            'bottom': new THREE.Vector3(0, 0, -1),
            'front': new THREE.Vector3(0, 1, 0),
            'back': new THREE.Vector3(0, -1, 0),
            'left': new THREE.Vector3(-1, 0, 0),
            'right': new THREE.Vector3(1, 0, 0)
        };
        return normals[face];
    }

    /**
     * Get surface position for a block face
     */
    getSurfacePosition(block: GridBlock, face: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right'): THREE.Vector3 {
        const pos = block.mesh.position.clone();
        const halfSize = this.config.cellSize / 2;

        switch (face) {
            case 'top':
                pos.z += block.height / 2;
                break;
            case 'bottom':
                pos.z -= block.height / 2;
                break;
            case 'front':
                pos.y += halfSize;
                break;
            case 'back':
                pos.y -= halfSize;
                break;
            case 'left':
                pos.x -= halfSize;
                break;
            case 'right':
                pos.x += halfSize;
                break;
        }

        return pos;
    }

    /**
     * Find nearest surface for position
     */
    findNearestSurface(position: THREE.Vector3): { block: GridBlock; face: string; position: THREE.Vector3 } | null {
        let nearest: { block: GridBlock; face: string; distance: number; position: THREE.Vector3 } | null = null;

        for (const block of this.blocks.values()) {
            const faces: Array<'top' | 'bottom' | 'front' | 'back' | 'left' | 'right'> =
                ['top', 'bottom', 'front', 'back', 'left', 'right'];

            for (const face of faces) {
                const surfacePos = this.getSurfacePosition(block, face);
                const distance = position.distanceTo(surfacePos);

                if (!nearest || distance < nearest.distance) {
                    nearest = { block, face, distance, position: surfacePos };
                }
            }
        }

        return nearest;
    }

    /**
     * Save grid state
     */
    serialize(): any {
        const data: any = {
            blocks: []
        };

        for (const block of this.blocks.values()) {
            data.blocks.push({
                gridX: block.gridX,
                gridY: block.gridY,
                height: block.height
            });
        }

        return data;
    }

    /**
     * Load grid state
     */
    deserialize(data: any): void {
        // Clear existing blocks
        for (const block of this.blocks.values()) {
            this.removeBlock(block.gridX, block.gridY);
        }

        // Restore blocks
        if (data.blocks) {
            for (const blockData of data.blocks) {
                this.extrudeBlock(blockData.gridX, blockData.gridY, blockData.height);
            }
        }
    }

    /**
     * Update grid (called every frame)
     */
    update(): void {
        // Animate selected blocks
        const time = Date.now() * 0.001;
        for (const id of this.selectedBlocks) {
            const block = this.blocks.get(id);
            if (block) {
                const pulse = Math.sin(time * 2) * 0.5 + 0.5;
                (block.mesh.material as THREE.MeshPhongMaterial).emissiveIntensity = 0.2 + pulse * 0.3;
            }
        }
    }

    /**
     * Dispose grid
     */
    dispose(): void {
        for (const block of this.blocks.values()) {
            this.removeBlock(block.gridX, block.gridY);
        }
        this.sceneManager.remove(this.gridHelper);
        this.gridHelper.geometry.dispose();
        if (this.gridHelper.material instanceof THREE.Material) {
            this.gridHelper.material.dispose();
        }
    }
}
