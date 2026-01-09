/**
 * Panel - Base class for 3D panels
 */

import * as THREE from 'three';
import { SceneManager } from '../scene/scene-manager';
import { FXBridge } from '../renderer/fx-bridge';

export type PanelType =
    | 'explorer'
    | 'editor'
    | 'terminal'
    | 'ai'
    | 'node-graph'
    | 'database'
    | 'api'
    | 'git'
    | 'theme-lab'
    | 'marketplace';

export interface PanelConfig {
    id: string;
    type: PanelType;
    title: string;
    position: { x: number; y: number; z: number };
    size: { width: number; height: number };
    visible: boolean;
    minimized: boolean;
    maximized: boolean;
}

/**
 * Base Panel class
 */
export class Panel {
    protected config: PanelConfig;
    protected sceneManager: SceneManager;
    protected fxBridge: FXBridge;

    protected mesh: THREE.Mesh;
    protected contentGroup: THREE.Group;
    protected htmlElement: HTMLDivElement | null = null;
    protected cssObject: any = null;

    protected isSelected: boolean = false;
    protected isFocused: boolean = false;

    constructor(config: PanelConfig, sceneManager: SceneManager, fxBridge: FXBridge) {
        this.config = config;
        this.sceneManager = sceneManager;
        this.fxBridge = fxBridge;

        // Create panel mesh
        const geometry = new THREE.PlaneGeometry(config.size.width, config.size.height);
        const material = new THREE.MeshBasicMaterial({
            color: 0x1e293b,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.95
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(config.position.x, config.position.y, config.position.z);
        this.mesh.name = config.id;
        this.mesh.userData = {
            panelId: config.id,
            panelType: config.type
        };

        // Create content group
        this.contentGroup = new THREE.Group();
        this.contentGroup.position.copy(this.mesh.position);
    }

    /**
     * Initialize the panel
     */
    async init(): Promise<void> {
        // Add to scene
        this.sceneManager.add(this.mesh);
        this.sceneManager.add(this.contentGroup);

        // Create border
        this.createBorder();

        // Create title bar
        this.createTitleBar();

        // Create HTML overlay
        this.createHTMLOverlay();
    }

    /**
     * Create panel border
     */
    protected createBorder(): void {
        const edges = new THREE.EdgesGeometry(this.mesh.geometry);
        const line = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color: 0x334155 })
        );
        line.position.copy(this.mesh.position);
        line.position.z += 0.1;
        this.contentGroup.add(line);
    }

    /**
     * Create title bar
     */
    protected createTitleBar(): void {
        const titleBarGeometry = new THREE.PlaneGeometry(
            this.config.size.width,
            30
        );
        const titleBarMaterial = new THREE.MeshBasicMaterial({
            color: 0x0f172a
        });

        const titleBar = new THREE.Mesh(titleBarGeometry, titleBarMaterial);
        titleBar.position.set(
            0,
            this.config.size.height / 2 - 15,
            0.5
        );
        this.contentGroup.add(titleBar);
    }

    /**
     * Create HTML overlay for content
     */
    protected createHTMLOverlay(): void {
        // Create DOM element for panel content
        this.htmlElement = document.createElement('div');
        this.htmlElement.className = `panel panel-${this.config.type}`;
        this.htmlElement.id = `panel-${this.config.id}`;
        this.htmlElement.style.cssText = `
            position: absolute;
            width: ${this.config.size.width}px;
            height: ${this.config.size.height}px;
            background: var(--surface, #1e293b);
            border: 1px solid var(--border, #334155);
            border-radius: 8px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            pointer-events: auto;
        `;

        // Title bar (make it draggable!)
        const titleBar = document.createElement('div');
        titleBar.className = 'panel-title-bar';
        titleBar.style.cssText = `
            height: 32px;
            background: var(--background, #0f172a);
            border-bottom: 1px solid var(--border, #334155);
            display: flex;
            align-items: center;
            padding: 0 12px;
            gap: 8px;
            cursor: grab;
            pointer-events: auto;
        `;

        // Make title bar draggable
        let isDragging = false;
        let dragStart = { x: 0, y: 0 };

        titleBar.addEventListener('mousedown', (e) => {
            isDragging = true;
            titleBar.style.cursor = 'grabbing';
            dragStart = {
                x: e.clientX - this.config.position.x,
                y: e.clientY - this.config.position.y
            };
            e.stopPropagation();
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const newX = e.clientX - dragStart.x;
                const newY = e.clientY - dragStart.y;
                this.setPosition(newX, newY, this.config.position.z);

                // Update FX state
                this.fxBridge.updatePanel(this.config.id, {
                    position: { x: newX, y: newY, z: this.config.position.z }
                });
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                titleBar.style.cursor = 'grab';
            }
        });

        // Title
        const title = document.createElement('span');
        title.className = 'panel-title';
        title.textContent = this.config.title;
        title.style.cssText = `
            flex: 1;
            font-size: 12px;
            font-weight: 500;
            color: var(--text, #f1f5f9);
        `;

        // Window controls
        const controls = document.createElement('div');
        controls.className = 'panel-controls';
        controls.style.cssText = `
            display: flex;
            gap: 6px;
        `;

        const minimizeBtn = this.createControlButton('minimize', 'var(--yellow, #fbbf24)');
        const maximizeBtn = this.createControlButton('maximize', 'var(--green, #10b981)');
        const closeBtn = this.createControlButton('close', 'var(--red, #ef4444)');

        controls.appendChild(minimizeBtn);
        controls.appendChild(maximizeBtn);
        controls.appendChild(closeBtn);

        titleBar.appendChild(title);
        titleBar.appendChild(controls);
        this.htmlElement.appendChild(titleBar);

        // Content area
        const content = document.createElement('div');
        content.className = 'panel-content';
        content.style.cssText = `
            flex: 1;
            overflow: auto;
            padding: 8px;
        `;
        this.htmlElement.appendChild(content);

        // Add to document
        const container = document.getElementById('panel-container');
        if (container) {
            container.appendChild(this.htmlElement);
        } else {
            document.body.appendChild(this.htmlElement);
        }

        // Update position
        this.updateHTMLPosition();
    }

    /**
     * Create control button
     */
    private createControlButton(type: string, color: string): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.className = `panel-control-${type}`;
        btn.style.cssText = `
            width: 12px;
            height: 12px;
            border-radius: 50%;
            border: none;
            background: ${color};
            cursor: pointer;
            opacity: 0.8;
        `;
        btn.addEventListener('mouseenter', () => btn.style.opacity = '1');
        btn.addEventListener('mouseleave', () => btn.style.opacity = '0.8');

        // Add functionality
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (type === 'close') {
                this.dispose();
            } else if (type === 'minimize') {
                this.toggleMinimize();
            } else if (type === 'maximize') {
                this.toggleMaximize();
            }
        });

        return btn;
    }

    /**
     * Toggle minimize
     */
    private toggleMinimize(): void {
        this.config.minimized = !this.config.minimized;
        const content = this.getContentElement();
        if (content && this.htmlElement) {
            if (this.config.minimized) {
                this.htmlElement.style.height = '32px';
                content.style.display = 'none';
            } else {
                this.htmlElement.style.height = `${this.config.size.height}px`;
                content.style.display = 'flex';
            }
        }
    }

    /**
     * Toggle maximize
     */
    private toggleMaximize(): void {
        this.config.maximized = !this.config.maximized;
        // TODO: Implement maximize to fullscreen
        console.log('[Panel] Maximize toggled:', this.config.maximized);
    }

    /**
     * Update HTML element position
     */
    protected updateHTMLPosition(): void {
        if (!this.htmlElement) return;

        // Convert 3D position to screen position
        const camera = this.sceneManager.getCamera();
        const canvas = this.sceneManager.getCanvas();

        const vector = new THREE.Vector3(
            this.config.position.x,
            this.config.position.y,
            this.config.position.z
        );
        vector.project(camera);

        const x = (vector.x * 0.5 + 0.5) * canvas.clientWidth;
        const y = (-(vector.y * 0.5) + 0.5) * canvas.clientHeight;

        this.htmlElement.style.left = `${x - this.config.size.width / 2}px`;
        this.htmlElement.style.top = `${y - this.config.size.height / 2}px`;
    }

    /**
     * Get panel ID
     */
    getId(): string {
        return this.config.id;
    }

    /**
     * Get panel type
     */
    getType(): PanelType {
        return this.config.type;
    }

    /**
     * Get position
     */
    getPosition(): THREE.Vector3 {
        return this.mesh.position.clone();
    }

    /**
     * Set position
     */
    setPosition(x: number, y: number, z: number): void {
        this.config.position = { x, y, z };
        this.mesh.position.set(x, y, z);
        this.contentGroup.position.set(x, y, z);
        this.updateHTMLPosition();
    }

    /**
     * Move panel
     */
    move(dx: number, dy: number): void {
        this.config.position.x += dx;
        this.config.position.y += dy;
        this.mesh.position.x += dx;
        this.mesh.position.y += dy;
        this.contentGroup.position.x += dx;
        this.contentGroup.position.y += dy;
        this.updateHTMLPosition();
    }

    /**
     * Set selected state
     */
    setSelected(selected: boolean): void {
        this.isSelected = selected;

        if (this.htmlElement) {
            this.htmlElement.style.borderColor = selected
                ? 'var(--primary, #3b82f6)'
                : 'var(--border, #334155)';
        }
    }

    /**
     * Set focused state
     */
    setFocused(focused: boolean): void {
        this.isFocused = focused;

        if (this.htmlElement) {
            this.htmlElement.style.boxShadow = focused
                ? '0 0 0 2px var(--primary, #3b82f6)'
                : 'none';
        }
    }

    /**
     * Get content element
     */
    getContentElement(): HTMLElement | null {
        return this.htmlElement?.querySelector('.panel-content') || null;
    }

    /**
     * Handle events
     */
    handleEvent(event: string, data: any): void {
        // Override in subclasses
    }

    /**
     * Update panel
     */
    update(): void {
        this.updateHTMLPosition();
    }

    /**
     * Dispose panel
     */
    dispose(): void {
        this.sceneManager.remove(this.mesh);
        this.sceneManager.remove(this.contentGroup);

        if (this.htmlElement && this.htmlElement.parentNode) {
            this.htmlElement.parentNode.removeChild(this.htmlElement);
        }

        this.mesh.geometry.dispose();
        if (this.mesh.material instanceof THREE.Material) {
            this.mesh.material.dispose();
        }
    }
}
