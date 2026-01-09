/**
 * Panel Controls - Advanced panel manipulation (rotation, scaling, etc.)
 */

import * as THREE from 'three';
import { Panel } from './panel';

export interface PanelTransform {
    position: THREE.Vector3;
    rotation: THREE.Euler;
    scale: THREE.Vector3;
}

export class PanelControls {
    private panel: Panel;
    private rotation: THREE.Euler = new THREE.Euler(0, 0, 0);
    private scale: number = 1;
    private targetScale: number = 1;

    private rotationSpeed: number = 0.05; // radians per wheel tick
    private scaleMin: number = 0.5;
    private scaleMax: number = 3.0;
    private scaleStep: number = 0.2;

    constructor(panel: Panel) {
        this.panel = panel;
    }

    /**
     * Rotate panel around Z axis
     */
    rotateZ(delta: number): void {
        this.rotation.z += delta;
        this.applyTransform();
    }

    /**
     * Rotate panel around X axis (tilt)
     */
    rotateX(delta: number): void {
        this.rotation.x += delta;
        this.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotation.x));
        this.applyTransform();
    }

    /**
     * Rotate panel around Y axis (spin)
     */
    rotateY(delta: number): void {
        this.rotation.y += delta;
        this.applyTransform();
    }

    /**
     * Set scale
     */
    setScale(newScale: number): void {
        this.targetScale = Math.max(this.scaleMin, Math.min(this.scaleMax, newScale));
    }

    /**
     * Zoom in (enlarge)
     */
    zoomIn(): void {
        this.setScale(this.targetScale + this.scaleStep);
    }

    /**
     * Zoom out (shrink)
     */
    zoomOut(): void {
        this.setScale(this.targetScale - this.scaleStep);
    }

    /**
     * Reset zoom
     */
    resetZoom(): void {
        this.targetScale = 1.0;
    }

    /**
     * Reset rotation
     */
    resetRotation(): void {
        this.rotation.set(0, 0, 0);
        this.applyTransform();
    }

    /**
     * Reset all transforms
     */
    reset(): void {
        this.rotation.set(0, 0, 0);
        this.targetScale = 1.0;
        this.scale = 1.0;
        this.applyTransform();
    }

    /**
     * Get current transform
     */
    getTransform(): PanelTransform {
        const pos = this.panel.getPosition();
        return {
            position: pos,
            rotation: this.rotation.clone(),
            scale: new THREE.Vector3(this.scale, this.scale, this.scale)
        };
    }

    /**
     * Set transform
     */
    setTransform(transform: PanelTransform): void {
        this.rotation.copy(transform.rotation);
        this.scale = transform.scale.x;
        this.targetScale = this.scale;
        this.applyTransform();
    }

    /**
     * Update (smooth animations)
     */
    update(): void {
        // Smooth scale transition
        if (Math.abs(this.targetScale - this.scale) > 0.01) {
            this.scale += (this.targetScale - this.scale) * 0.15;
            this.applyTransform();
        }
    }

    /**
     * Apply transform to panel
     */
    private applyTransform(): void {
        const htmlElement = (this.panel as any).htmlElement;
        if (htmlElement) {
            // Apply CSS transform
            const rotX = (this.rotation.x * 180 / Math.PI);
            const rotY = (this.rotation.y * 180 / Math.PI);
            const rotZ = (this.rotation.z * 180 / Math.PI);

            htmlElement.style.transform = `
                scale(${this.scale})
                rotateX(${rotX}deg)
                rotateY(${rotY}deg)
                rotateZ(${rotZ}deg)
            `;
            htmlElement.style.transformOrigin = 'center center';
        }
    }

    /**
     * Serialize for saving
     */
    serialize(): any {
        return {
            rotation: {
                x: this.rotation.x,
                y: this.rotation.y,
                z: this.rotation.z
            },
            scale: this.scale
        };
    }

    /**
     * Deserialize from saved data
     */
    deserialize(data: any): void {
        if (data.rotation) {
            this.rotation.set(data.rotation.x, data.rotation.y, data.rotation.z);
        }
        if (data.scale !== undefined) {
            this.scale = data.scale;
            this.targetScale = data.scale;
        }
        this.applyTransform();
    }
}
