/**
 * Selection Box - For drag-selecting grid blocks
 */

import * as THREE from 'three';

export class SelectionBox {
    private startPoint: THREE.Vector2 | null = null;
    private endPoint: THREE.Vector2 | null = null;
    private selectionMesh: THREE.Mesh | null = null;
    private isSelecting: boolean = false;

    private scene: THREE.Scene;
    private camera: THREE.Camera;

    constructor(scene: THREE.Scene, camera: THREE.Camera) {
        this.scene = scene;
        this.camera = camera;
    }

    /**
     * Start selection
     */
    startSelection(screenX: number, screenY: number, canvas: HTMLCanvasElement): void {
        const rect = canvas.getBoundingClientRect();
        this.startPoint = new THREE.Vector2(
            ((screenX - rect.left) / rect.width) * 2 - 1,
            -((screenY - rect.top) / rect.height) * 2 + 1
        );
        this.isSelecting = true;
        this.createSelectionBox();
    }

    /**
     * Update selection
     */
    updateSelection(screenX: number, screenY: number, canvas: HTMLCanvasElement): void {
        if (!this.isSelecting || !this.startPoint) return;

        const rect = canvas.getBoundingClientRect();
        this.endPoint = new THREE.Vector2(
            ((screenX - rect.left) / rect.width) * 2 - 1,
            -((screenY - rect.top) / rect.height) * 2 + 1
        );

        this.updateSelectionBox();
    }

    /**
     * End selection and return selected objects
     */
    endSelection(objects: THREE.Object3D[]): THREE.Object3D[] {
        if (!this.isSelecting || !this.startPoint || !this.endPoint) {
            this.clearSelection();
            return [];
        }

        const selected: THREE.Object3D[] = [];
        const frustum = this.getFrustumFromPoints();

        for (const obj of objects) {
            if (frustum.containsPoint(obj.position)) {
                selected.push(obj);
            }
        }

        this.clearSelection();
        return selected;
    }

    /**
     * Create selection box mesh
     */
    private createSelectionBox(): void {
        const geometry = new THREE.PlaneGeometry(1, 1);
        const material = new THREE.MeshBasicMaterial({
            color: 0x3b82f6,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide
        });

        this.selectionMesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.selectionMesh);
    }

    /**
     * Update selection box visual
     */
    private updateSelectionBox(): void {
        if (!this.selectionMesh || !this.startPoint || !this.endPoint) return;

        // Update box dimensions and position
        const minX = Math.min(this.startPoint.x, this.endPoint.x);
        const maxX = Math.max(this.startPoint.x, this.endPoint.x);
        const minY = Math.min(this.startPoint.y, this.endPoint.y);
        const maxY = Math.max(this.startPoint.y, this.endPoint.y);

        const width = maxX - minX;
        const height = maxY - minY;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        // Scale the mesh
        this.selectionMesh.scale.set(width, height, 1);

        // Position in screen space (needs conversion to world space)
        // For simplicity, place at camera position
        this.selectionMesh.position.set(centerX * 500, centerY * 500, -100);
    }

    /**
     * Get frustum from selection points
     */
    private getFrustumFromPoints(): THREE.Frustum {
        if (!this.startPoint || !this.endPoint) {
            return new THREE.Frustum();
        }

        const minX = Math.min(this.startPoint.x, this.endPoint.x);
        const maxX = Math.max(this.startPoint.x, this.endPoint.x);
        const minY = Math.min(this.startPoint.y, this.endPoint.y);
        const maxY = Math.max(this.startPoint.y, this.endPoint.y);

        // Create frustum from screen-space rectangle
        const frustum = new THREE.Frustum();
        const matrix = new THREE.Matrix4().multiplyMatrices(
            (this.camera as THREE.PerspectiveCamera).projectionMatrix,
            (this.camera as THREE.PerspectiveCamera).matrixWorldInverse
        );
        frustum.setFromProjectionMatrix(matrix);

        return frustum;
    }

    /**
     * Clear selection
     */
    clearSelection(): void {
        if (this.selectionMesh) {
            this.scene.remove(this.selectionMesh);
            this.selectionMesh.geometry.dispose();
            if (this.selectionMesh.material instanceof THREE.Material) {
                this.selectionMesh.material.dispose();
            }
            this.selectionMesh = null;
        }

        this.startPoint = null;
        this.endPoint = null;
        this.isSelecting = false;
    }

    /**
     * Check if currently selecting
     */
    isActive(): boolean {
        return this.isSelecting;
    }
}
