/**
 * Camera Controller - Free camera movement (WASD, mouse drag, zoom)
 */

import * as THREE from 'three';

export class CameraController {
    private camera: THREE.PerspectiveCamera;
    private position: THREE.Vector3;
    private rotation: THREE.Euler;
    private targetPosition: THREE.Vector3;
    private targetRotation: THREE.Euler;

    private moveSpeed: number = 10;
    private rotateSpeed: number = 0.003;
    private zoomSpeed: number = 100;

    private keys: Set<string> = new Set();
    private isRotating: boolean = false;
    private lastMousePos: { x: number; y: number } = { x: 0, y: 0 };

    constructor(camera: THREE.PerspectiveCamera) {
        this.camera = camera;
        this.position = camera.position.clone();
        this.rotation = new THREE.Euler(0, 0, 0);
        this.targetPosition = this.position.clone();
        this.targetRotation = this.rotation.clone();

        this.setupKeyboard();
    }

    /**
     * Setup keyboard listeners
     */
    private setupKeyboard(): void {
        window.addEventListener('keydown', (e) => {
            // Don't capture if typing in input
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            this.keys.add(e.key.toLowerCase());
        });

        window.addEventListener('keyup', (e) => {
            this.keys.delete(e.key.toLowerCase());
        });
    }

    /**
     * Start rotation (right-click drag)
     */
    startRotation(x: number, y: number): void {
        this.isRotating = true;
        this.lastMousePos = { x, y };
    }

    /**
     * Update rotation
     */
    updateRotation(x: number, y: number): void {
        if (!this.isRotating) return;

        const dx = x - this.lastMousePos.x;
        const dy = y - this.lastMousePos.y;

        this.targetRotation.y -= dx * this.rotateSpeed;
        this.targetRotation.x -= dy * this.rotateSpeed;

        // Clamp vertical rotation
        this.targetRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.targetRotation.x));

        this.lastMousePos = { x, y };
    }

    /**
     * Stop rotation
     */
    stopRotation(): void {
        this.isRotating = false;
    }

    /**
     * Zoom
     */
    zoom(delta: number): void {
        const forward = this.getForwardVector();
        this.targetPosition.addScaledVector(forward, delta * this.zoomSpeed);
    }

    /**
     * Update camera (call every frame)
     */
    update(delta: number): void {
        // Process keyboard movement
        this.processMovement(delta);

        // Smooth interpolation
        this.position.lerp(this.targetPosition, 0.1);
        this.rotation.x += (this.targetRotation.x - this.rotation.x) * 0.1;
        this.rotation.y += (this.targetRotation.y - this.rotation.y) * 0.1;

        // Apply to camera
        this.camera.position.copy(this.position);
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.set(this.rotation.x, this.rotation.y, this.rotation.z);
    }

    /**
     * Process keyboard movement
     */
    private processMovement(delta: number): void {
        const moveAmount = this.moveSpeed * delta * 60; // Scale by 60 FPS

        const forward = this.getForwardVector();
        const right = this.getRightVector();
        const up = new THREE.Vector3(0, 0, 1);

        if (this.keys.has('w')) {
            this.targetPosition.addScaledVector(forward, moveAmount);
        }
        if (this.keys.has('s')) {
            this.targetPosition.addScaledVector(forward, -moveAmount);
        }
        if (this.keys.has('a')) {
            this.targetPosition.addScaledVector(right, -moveAmount);
        }
        if (this.keys.has('d')) {
            this.targetPosition.addScaledVector(right, moveAmount);
        }
        if (this.keys.has('e')) {
            this.targetPosition.addScaledVector(up, moveAmount);
        }
        if (this.keys.has('q')) {
            this.targetPosition.addScaledVector(up, -moveAmount);
        }
    }

    /**
     * Get forward vector from camera rotation
     */
    private getForwardVector(): THREE.Vector3 {
        const forward = new THREE.Vector3(0, 1, 0);
        forward.applyEuler(this.rotation);
        forward.z = 0; // Keep movement on XY plane
        forward.normalize();
        return forward;
    }

    /**
     * Get right vector from camera rotation
     */
    private getRightVector(): THREE.Vector3 {
        const right = new THREE.Vector3(1, 0, 0);
        right.applyEuler(this.rotation);
        right.z = 0; // Keep movement on XY plane
        right.normalize();
        return right;
    }

    /**
     * Set camera position
     */
    setPosition(x: number, y: number, z: number): void {
        this.position.set(x, y, z);
        this.targetPosition.copy(this.position);
    }

    /**
     * Set camera rotation
     */
    setRotation(x: number, y: number, z: number): void {
        this.rotation.set(x, y, z);
        this.targetRotation.copy(this.rotation);
    }

    /**
     * Focus on position
     */
    focusOn(target: THREE.Vector3, distance: number = 500): void {
        // Calculate position behind and above target
        const offset = new THREE.Vector3(0, -distance, distance * 0.5);
        offset.applyEuler(this.rotation);

        this.targetPosition.copy(target).add(offset);

        // Look at target
        const lookDirection = new THREE.Vector3().subVectors(target, this.targetPosition);
        this.targetRotation.y = Math.atan2(lookDirection.x, lookDirection.y);
        this.targetRotation.x = Math.atan2(lookDirection.z, Math.sqrt(lookDirection.x ** 2 + lookDirection.y ** 2));
    }

    /**
     * Reset to default position
     */
    reset(): void {
        this.setPosition(0, 0, 1000);
        this.setRotation(0, 0, 0);
    }

    /**
     * Set move speed
     */
    setMoveSpeed(speed: number): void {
        this.moveSpeed = speed;
    }

    /**
     * Set rotate speed
     */
    setRotateSpeed(speed: number): void {
        this.rotateSpeed = speed;
    }

    /**
     * Get position
     */
    getPosition(): THREE.Vector3 {
        return this.position.clone();
    }

    /**
     * Get rotation
     */
    getRotation(): THREE.Euler {
        return this.rotation.clone();
    }

    /**
     * Check if rotating
     */
    isRotatingCamera(): boolean {
        return this.isRotating;
    }
}
