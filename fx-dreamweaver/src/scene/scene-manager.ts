/**
 * Scene Manager - WebGL 3D scene management
 */

import * as THREE from 'three';

export type ViewMode = '2d' | '3d' | 'hybrid';

export interface SceneConfig {
    backgroundColor?: number;
    antialias?: boolean;
    enableShadows?: boolean;
}

export class SceneManager {
    private container: HTMLElement;
    private canvas: HTMLCanvasElement;
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private raycaster: THREE.Raycaster;
    private mouse: THREE.Vector2;

    private viewMode: ViewMode = '2d';
    private zoom: number = 1;
    private targetZoom: number = 1;
    private panOffset: THREE.Vector2 = new THREE.Vector2(0, 0);

    private hoveredObject: THREE.Object3D | null = null;
    private selectedObjects: Set<THREE.Object3D> = new Set();

    private gridHelper: THREE.GridHelper | null = null;
    private ambientLight: THREE.AmbientLight;
    private directionalLight: THREE.DirectionalLight;

    constructor(container: HTMLElement, config: SceneConfig = {}) {
        this.container = container;

        // Create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
        `;
        this.container.appendChild(this.canvas);

        // Initialize renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: config.antialias ?? true,
            alpha: true
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(config.backgroundColor ?? 0x0f172a, 1);

        if (config.enableShadows) {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }

        // Initialize scene
        this.scene = new THREE.Scene();

        // Initialize camera
        const aspect = container.clientWidth / container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 10000);
        this.camera.position.set(0, 0, 1000);
        this.camera.lookAt(0, 0, 0);

        // Initialize raycaster
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Initialize lights
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(this.ambientLight);

        this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        this.directionalLight.position.set(500, 500, 500);
        this.scene.add(this.directionalLight);

        // Handle resize
        window.addEventListener('resize', () => this.handleResize());
        this.handleResize();
    }

    /**
     * Initialize scene
     */
    async init(): Promise<void> {
        // Create grid
        this.createGrid();

        console.log('[SceneManager] Initialized');
    }

    /**
     * Create grid helper
     */
    private createGrid(): void {
        this.gridHelper = new THREE.GridHelper(2000, 40, 0x334155, 0x1e293b);
        this.gridHelper.rotation.x = Math.PI / 2;
        this.gridHelper.position.z = -10;
        this.scene.add(this.gridHelper);
    }

    /**
     * Handle window resize
     */
    private handleResize(): void {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);
    }

    /**
     * Update scene
     */
    update(): void {
        // Smooth zoom
        this.zoom += (this.targetZoom - this.zoom) * 0.1;
        this.camera.position.z = 1000 / this.zoom;

        // Render
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Get canvas element
     */
    getCanvas(): HTMLCanvasElement {
        return this.canvas;
    }

    /**
     * Get the THREE.js scene
     */
    getScene(): THREE.Scene {
        return this.scene;
    }

    /**
     * Get the camera
     */
    getCamera(): THREE.PerspectiveCamera {
        return this.camera;
    }

    /**
     * Set view mode
     */
    setViewMode(mode: ViewMode): void {
        this.viewMode = mode;

        switch (mode) {
            case '2d':
                // Top-down view
                this.camera.position.set(this.panOffset.x, this.panOffset.y, 1000 / this.zoom);
                this.camera.rotation.set(0, 0, 0);
                if (this.gridHelper) this.gridHelper.rotation.x = Math.PI / 2;
                break;

            case '3d':
                // Perspective view
                this.camera.position.set(
                    this.panOffset.x + 500,
                    this.panOffset.y + 500,
                    500 / this.zoom
                );
                this.camera.lookAt(this.panOffset.x, this.panOffset.y, 0);
                if (this.gridHelper) this.gridHelper.rotation.x = 0;
                break;

            case 'hybrid':
                // Slight angle
                this.camera.position.set(
                    this.panOffset.x + 200,
                    this.panOffset.y + 200,
                    800 / this.zoom
                );
                this.camera.lookAt(this.panOffset.x, this.panOffset.y, 0);
                if (this.gridHelper) this.gridHelper.rotation.x = Math.PI / 4;
                break;
        }

        console.log('[SceneManager] View mode:', mode);
    }

    /**
     * Zoom in
     */
    zoomIn(): void {
        this.targetZoom = Math.min(this.targetZoom * 1.2, 5);
    }

    /**
     * Zoom out
     */
    zoomOut(): void {
        this.targetZoom = Math.max(this.targetZoom / 1.2, 0.2);
    }

    /**
     * Reset zoom
     */
    zoomReset(): void {
        this.targetZoom = 1;
        this.panOffset.set(0, 0);
        this.setViewMode(this.viewMode);
    }

    /**
     * Pan the camera
     */
    pan(dx: number, dy: number): void {
        const scale = 1000 / this.zoom / 500;
        this.panOffset.x += dx * scale;
        this.panOffset.y += dy * scale;
        this.setViewMode(this.viewMode);
    }

    /**
     * Raycast from screen position
     */
    raycast(x: number, y: number): THREE.Intersection | null {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((x - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((y - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        return intersects.length > 0 ? intersects[0] : null;
    }

    /**
     * Set hovered object
     */
    setHoveredObject(object: THREE.Object3D | null): void {
        if (this.hoveredObject === object) return;

        // Remove hover effect from previous
        if (this.hoveredObject) {
            this.setObjectHover(this.hoveredObject, false);
        }

        // Add hover effect to new
        if (object) {
            this.setObjectHover(object, true);
        }

        this.hoveredObject = object;
    }

    /**
     * Add object to scene
     */
    add(object: THREE.Object3D): void {
        this.scene.add(object);
    }

    /**
     * Remove object from scene
     */
    remove(object: THREE.Object3D): void {
        this.scene.remove(object);
    }

    /**
     * Get object by name
     */
    getObjectByName(name: string): THREE.Object3D | undefined {
        return this.scene.getObjectByName(name);
    }

    /**
     * Select object
     */
    selectObject(object: THREE.Object3D): void {
        this.selectedObjects.add(object);
        this.setObjectSelected(object, true);
    }

    /**
     * Deselect object
     */
    deselectObject(object: THREE.Object3D): void {
        this.selectedObjects.delete(object);
        this.setObjectSelected(object, false);
    }

    /**
     * Deselect all
     */
    deselectAll(): void {
        for (const obj of this.selectedObjects) {
            this.setObjectSelected(obj, false);
        }
        this.selectedObjects.clear();
    }

    /**
     * Set object hover state
     */
    private setObjectHover(object: THREE.Object3D, hovered: boolean): void {
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshBasicMaterial) {
            if (hovered) {
                object.material.opacity = 0.9;
            } else {
                object.material.opacity = 1;
            }
        }
    }

    /**
     * Set object selected state
     */
    private setObjectSelected(object: THREE.Object3D, selected: boolean): void {
        // Add/remove selection outline
        const outlineName = `${object.name}-outline`;
        const existing = this.scene.getObjectByName(outlineName);

        if (selected && !existing && object instanceof THREE.Mesh) {
            const outline = new THREE.Mesh(
                object.geometry.clone(),
                new THREE.MeshBasicMaterial({
                    color: 0x3b82f6,
                    side: THREE.BackSide,
                    transparent: true,
                    opacity: 0.5
                })
            );
            outline.name = outlineName;
            outline.scale.multiplyScalar(1.02);
            outline.position.copy(object.position);
            outline.rotation.copy(object.rotation);
            this.scene.add(outline);
        } else if (!selected && existing) {
            this.scene.remove(existing);
        }
    }

    /**
     * Focus on position
     */
    focusOn(position: THREE.Vector3): void {
        this.panOffset.set(position.x, position.y);
        this.setViewMode(this.viewMode);
    }

    /**
     * Get current view mode
     */
    getViewMode(): ViewMode {
        return this.viewMode;
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.renderer.dispose();
        this.scene.clear();
    }
}
