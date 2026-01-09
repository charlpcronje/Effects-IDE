/**
 * Surface Snapper - Snaps panels and icons to block surfaces
 */

import * as THREE from 'three';
import { GridManager, GridBlock } from './grid-manager';

export interface SnapSurface {
    block: GridBlock;
    face: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right';
    position: THREE.Vector3;
    normal: THREE.Vector3;
    distance: number;
}

export class SurfaceSnapper {
    private gridManager: GridManager;
    private snapDistance: number = 100;
    private snapEnabled: boolean = true;

    private readonly CELL_SIZE = 50;

    constructor(gridManager: GridManager) {
        this.gridManager = gridManager;
    }

    /**
     * Find nearest surface to a position
     */
    findNearestSurface(position: THREE.Vector3): SnapSurface | null {
        const blocks = this.gridManager.getAllBlocks();
        if (blocks.length === 0) return null;

        let nearest: SnapSurface | null = null;

        for (const block of blocks) {
            const faces: Array<'top' | 'bottom' | 'front' | 'back' | 'left' | 'right'> = [
                'top', 'front', 'back', 'left', 'right', 'bottom'
            ];

            for (const face of faces) {
                const surfacePos = this.getSurfacePosition(block, face);
                const surfaceNormal = this.getSurfaceNormal(face);
                const distance = position.distanceTo(surfacePos);

                if ((!nearest || distance < nearest.distance) && distance < this.snapDistance) {
                    nearest = {
                        block,
                        face,
                        position: surfacePos,
                        normal: surfaceNormal,
                        distance
                    };
                }
            }
        }

        return nearest;
    }

    /**
     * Get surface position for a block face
     */
    private getSurfacePosition(block: GridBlock, face: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right'): THREE.Vector3 {
        const pos = block.mesh.position.clone();
        const halfSize = this.CELL_SIZE / 2;

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
     * Get surface normal for a face
     */
    private getSurfaceNormal(face: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right'): THREE.Vector3 {
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
     * Get rotation to align with surface normal
     */
    getRotationForSurface(face: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right'): THREE.Euler {
        const rotations = {
            'top': new THREE.Euler(0, 0, 0),
            'bottom': new THREE.Euler(Math.PI, 0, 0),
            'front': new THREE.Euler(-Math.PI / 2, 0, 0),
            'back': new THREE.Euler(Math.PI / 2, 0, 0),
            'left': new THREE.Euler(0, 0, Math.PI / 2),
            'right': new THREE.Euler(0, 0, -Math.PI / 2)
        };
        return rotations[face];
    }

    /**
     * Snap position to nearest surface
     */
    snapToSurface(position: THREE.Vector3): SnapSurface | null {
        if (!this.snapEnabled) return null;

        const surface = this.findNearestSurface(position);
        if (surface) {
            // Offset position slightly away from surface
            const offset = surface.normal.clone().multiplyScalar(5);
            surface.position.add(offset);
        }

        return surface;
    }

    /**
     * Check if position is near a surface
     */
    isNearSurface(position: THREE.Vector3): boolean {
        const surface = this.findNearestSurface(position);
        return surface !== null && surface.distance < this.snapDistance;
    }

    /**
     * Enable/disable snapping
     */
    setEnabled(enabled: boolean): void {
        this.snapEnabled = enabled;
    }

    /**
     * Set snap distance threshold
     */
    setSnapDistance(distance: number): void {
        this.snapDistance = distance;
    }

    /**
     * Get snap distance
     */
    getSnapDistance(): number {
        return this.snapDistance;
    }

    /**
     * Check if snapping is enabled
     */
    isEnabled(): boolean {
        return this.snapEnabled;
    }
}
