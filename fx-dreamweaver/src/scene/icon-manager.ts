/**
 * Icon Manager - Manages floating icons on the grid
 */

import * as THREE from 'three';
import { SceneManager } from './scene-manager';

export interface GridIcon {
    id: string;
    type: string;
    label: string;
    position: THREE.Vector3;
    color: number;
    mesh: THREE.Mesh;
    sprite: THREE.Sprite;
    action?: () => void;
}

export interface IconConfig {
    size: number;
    hoverScale: number;
    defaultColor: number;
    hoverColor: number;
}

export class IconManager {
    private sceneManager: SceneManager;
    private config: IconConfig;
    private icons: Map<string, GridIcon> = new Map();
    private hoveredIcon: string | null = null;

    private iconTextures: Map<string, THREE.Texture> = new Map();

    constructor(sceneManager: SceneManager, config?: Partial<IconConfig>) {
        this.sceneManager = sceneManager;
        this.config = {
            size: 40,
            hoverScale: 1.3,
            defaultColor: 0x3b82f6,
            hoverColor: 0x60a5fa,
            ...config
        };

        this.createIconTextures();
    }

    /**
     * Create icon textures
     */
    private createIconTextures(): void {
        const icons = [
            { name: 'file', symbol: '📄', color: '#3b82f6' },
            { name: 'folder', symbol: '📁', color: '#fbbf24' },
            { name: 'terminal', symbol: '💻', color: '#10b981' },
            { name: 'git', symbol: '🔀', color: '#f97316' },
            { name: 'database', symbol: '🗄️', color: '#8b5cf6' },
            { name: 'api', symbol: '🔌', color: '#ec4899' },
            { name: 'settings', symbol: '⚙️', color: '#64748b' },
            { name: 'search', symbol: '🔍', color: '#06b6d4' },
            { name: 'ai', symbol: '🤖', color: '#a855f7' },
            { name: 'code', symbol: '{ }', color: '#3b82f6' },
            { name: 'run', symbol: '▶', color: '#10b981' },
            { name: 'debug', symbol: '🐛', color: '#ef4444' }
        ];

        for (const icon of icons) {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext('2d')!;

            // Background circle
            ctx.fillStyle = icon.color;
            ctx.beginPath();
            ctx.arc(64, 64, 60, 0, Math.PI * 2);
            ctx.fill();

            // Symbol
            ctx.font = 'bold 64px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(icon.symbol, 64, 64);

            const texture = new THREE.CanvasTexture(canvas);
            this.iconTextures.set(icon.name, texture);
        }
    }

    /**
     * Create an icon at grid position
     */
    createIcon(
        id: string,
        type: string,
        gridX: number,
        gridY: number,
        gridZ: number = 10,
        label?: string,
        action?: () => void
    ): GridIcon {
        // Remove existing if present
        if (this.icons.has(id)) {
            this.removeIcon(id);
        }

        const texture = this.iconTextures.get(type) || this.createDefaultTexture();

        // Create sprite
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 0.95
        });

        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(this.config.size, this.config.size, 1);
        sprite.position.set(gridX, gridY, gridZ);
        sprite.userData = {
            type: 'grid-icon',
            iconId: id,
            iconType: type
        };

        // Create invisible hitbox (larger for easier clicking)
        const hitboxGeometry = new THREE.PlaneGeometry(
            this.config.size * 1.5,
            this.config.size * 1.5
        );
        const hitboxMaterial = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide
        });
        const hitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterial);
        hitbox.position.copy(sprite.position);
        hitbox.userData = sprite.userData;

        // Add to scene
        this.sceneManager.add(sprite);
        this.sceneManager.add(hitbox);

        // Store icon
        const icon: GridIcon = {
            id,
            type,
            label: label || type,
            position: new THREE.Vector3(gridX, gridY, gridZ),
            color: this.config.defaultColor,
            mesh: hitbox,
            sprite,
            action
        };

        this.icons.set(id, icon);
        return icon;
    }

    /**
     * Create default texture
     */
    private createDefaultTexture(): THREE.Texture {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d')!;

        // Default icon
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(64, 64, 60, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', 64, 64);

        return new THREE.CanvasTexture(canvas);
    }

    /**
     * Remove an icon
     */
    removeIcon(id: string): void {
        const icon = this.icons.get(id);
        if (!icon) return;

        this.sceneManager.remove(icon.sprite);
        this.sceneManager.remove(icon.mesh);

        icon.sprite.material.dispose();
        icon.mesh.geometry.dispose();
        if (icon.mesh.material instanceof THREE.Material) {
            icon.mesh.material.dispose();
        }

        this.icons.delete(id);
    }

    /**
     * Handle icon click
     */
    handleIconClick(iconId: string): void {
        const icon = this.icons.get(iconId);
        if (icon && icon.action) {
            console.log('[IconManager] Icon clicked:', icon.label);
            icon.action();
        }
    }

    /**
     * Handle icon hover
     */
    handleIconHover(iconId: string | null): void {
        // Reset previous hover
        if (this.hoveredIcon && this.hoveredIcon !== iconId) {
            const prevIcon = this.icons.get(this.hoveredIcon);
            if (prevIcon) {
                prevIcon.sprite.scale.set(this.config.size, this.config.size, 1);
                prevIcon.sprite.material.opacity = 0.95;
            }
        }

        // Apply new hover
        if (iconId) {
            const icon = this.icons.get(iconId);
            if (icon) {
                icon.sprite.scale.set(
                    this.config.size * this.config.hoverScale,
                    this.config.size * this.config.hoverScale,
                    1
                );
                icon.sprite.material.opacity = 1;
            }
        }

        this.hoveredIcon = iconId;
    }

    /**
     * Get icon
     */
    getIcon(id: string): GridIcon | undefined {
        return this.icons.get(id);
    }

    /**
     * Get all icons
     */
    getAllIcons(): GridIcon[] {
        return Array.from(this.icons.values());
    }

    /**
     * Update icons (animations, billboarding)
     */
    update(): void {
        const camera = this.sceneManager.getCamera();

        // Make sprites always face camera
        for (const icon of this.icons.values()) {
            // Billboarding - sprite always faces camera
            icon.sprite.quaternion.copy(camera.quaternion);

            // Floating animation
            const time = Date.now() * 0.001;
            const bounce = Math.sin(time * 2 + icon.position.x * 0.1) * 5;
            icon.sprite.position.z = icon.position.z + bounce;
            icon.mesh.position.z = icon.sprite.position.z;
        }
    }

    /**
     * Clear all icons
     */
    clear(): void {
        for (const id of Array.from(this.icons.keys())) {
            this.removeIcon(id);
        }
    }

    /**
     * Serialize icons
     */
    serialize(): any {
        const data: any[] = [];

        for (const icon of this.icons.values()) {
            data.push({
                id: icon.id,
                type: icon.type,
                label: icon.label,
                position: { x: icon.position.x, y: icon.position.y, z: icon.position.z }
            });
        }

        return data;
    }

    /**
     * Deserialize icons
     */
    deserialize(data: any[]): void {
        this.clear();

        for (const item of data) {
            this.createIcon(
                item.id,
                item.type,
                item.position.x,
                item.position.y,
                item.position.z,
                item.label
            );
        }
    }

    /**
     * Dispose all icons
     */
    dispose(): void {
        this.clear();

        for (const texture of this.iconTextures.values()) {
            texture.dispose();
        }
        this.iconTextures.clear();
    }
}
