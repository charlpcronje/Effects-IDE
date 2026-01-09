/**
 * Connection Manager - Manages glowing lines connecting panels and nodes
 */

import * as THREE from 'three';
import { SceneManager } from './scene-manager';

export interface Connection {
    id: string;
    from: THREE.Vector3;
    to: THREE.Vector3;
    color: number;
    opacity: number;
    line: THREE.Line;
    glowLine: THREE.Line;
}

export interface ConnectionConfig {
    defaultColor: number;
    defaultGlowColor: number;
    defaultOpacity: number;
    glowIntensity: number;
    animationSpeed: number;
}

export class ConnectionManager {
    private sceneManager: SceneManager;
    private config: ConnectionConfig;
    private connections: Map<string, Connection> = new Map();
    private animationTime: number = 0;

    constructor(sceneManager: SceneManager, config?: Partial<ConnectionConfig>) {
        this.sceneManager = sceneManager;
        this.config = {
            defaultColor: 0x3b82f6,
            defaultGlowColor: 0x60a5fa,
            defaultOpacity: 0.6,
            glowIntensity: 0.4,
            animationSpeed: 0.001,
            ...config
        };
    }

    /**
     * Create a connection between two points
     */
    createConnection(
        id: string,
        from: THREE.Vector3,
        to: THREE.Vector3,
        color?: number
    ): Connection {
        // Remove existing if it exists
        if (this.connections.has(id)) {
            this.removeConnection(id);
        }

        const lineColor = color || this.config.defaultColor;

        // Create curve for smooth bezier line
        const midPoint = new THREE.Vector3();
        midPoint.lerpVectors(from, to, 0.5);
        midPoint.z += 50; // Add curve height

        const curve = new THREE.QuadraticBezierCurve3(from, midPoint, to);
        const points = curve.getPoints(50);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        // Main line
        const lineMaterial = new THREE.LineBasicMaterial({
            color: lineColor,
            opacity: this.config.defaultOpacity,
            transparent: true,
            linewidth: 2
        });
        const line = new THREE.Line(geometry, lineMaterial);

        // Glow line (thicker, brighter)
        const glowMaterial = new THREE.LineBasicMaterial({
            color: this.config.defaultGlowColor,
            opacity: this.config.glowIntensity,
            transparent: true,
            linewidth: 4
        });
        const glowLine = new THREE.Line(geometry.clone(), glowMaterial);

        // Add to scene
        this.sceneManager.add(glowLine);
        this.sceneManager.add(line);

        // Store connection
        const connection: Connection = {
            id,
            from: from.clone(),
            to: to.clone(),
            color: lineColor,
            opacity: this.config.defaultOpacity,
            line,
            glowLine
        };

        this.connections.set(id, connection);
        return connection;
    }

    /**
     * Update connection endpoints
     */
    updateConnection(id: string, from?: THREE.Vector3, to?: THREE.Vector3): void {
        const connection = this.connections.get(id);
        if (!connection) return;

        if (from) connection.from.copy(from);
        if (to) connection.to.copy(to);

        // Recalculate curve
        const midPoint = new THREE.Vector3();
        midPoint.lerpVectors(connection.from, connection.to, 0.5);
        midPoint.z += 50;

        const curve = new THREE.QuadraticBezierCurve3(connection.from, midPoint, connection.to);
        const points = curve.getPoints(50);

        // Update geometries
        connection.line.geometry.dispose();
        connection.line.geometry = new THREE.BufferGeometry().setFromPoints(points);

        connection.glowLine.geometry.dispose();
        connection.glowLine.geometry = new THREE.BufferGeometry().setFromPoints(points);
    }

    /**
     * Remove a connection
     */
    removeConnection(id: string): void {
        const connection = this.connections.get(id);
        if (!connection) return;

        this.sceneManager.remove(connection.line);
        this.sceneManager.remove(connection.glowLine);

        connection.line.geometry.dispose();
        if (connection.line.material instanceof THREE.Material) {
            connection.line.material.dispose();
        }

        connection.glowLine.geometry.dispose();
        if (connection.glowLine.material instanceof THREE.Material) {
            connection.glowLine.material.dispose();
        }

        this.connections.delete(id);
    }

    /**
     * Connect two panels
     */
    connectPanels(panelId1: string, panelId2: string): void {
        const id = `panel-${panelId1}-${panelId2}`;
        // Will be updated dynamically in update()
        this.createConnection(id, new THREE.Vector3(), new THREE.Vector3());
    }

    /**
     * Disconnect panels
     */
    disconnectPanels(panelId1: string, panelId2: string): void {
        const id = `panel-${panelId1}-${panelId2}`;
        this.removeConnection(id);
    }

    /**
     * Create connection from panel to grid position
     */
    connectPanelToGrid(panelId: string, gridX: number, gridY: number, gridZ: number = 0): void {
        const id = `panel-${panelId}-grid-${gridX}-${gridY}`;
        this.createConnection(
            id,
            new THREE.Vector3(),
            new THREE.Vector3(gridX, gridY, gridZ)
        );
    }

    /**
     * Update all connections (animate)
     */
    update(delta: number = 0.016): void {
        this.animationTime += delta * this.config.animationSpeed;

        for (const connection of this.connections.values()) {
            // Animate glow intensity
            const pulse = Math.sin(this.animationTime * 2) * 0.5 + 0.5;
            const glowMat = connection.glowLine.material as THREE.LineBasicMaterial;
            glowMat.opacity = this.config.glowIntensity * (0.5 + pulse * 0.5);

            // Animate flow effect (could add dash animation here)
        }
    }

    /**
     * Get all connections
     */
    getAllConnections(): Connection[] {
        return Array.from(this.connections.values());
    }

    /**
     * Clear all connections
     */
    clear(): void {
        for (const id of Array.from(this.connections.keys())) {
            this.removeConnection(id);
        }
    }

    /**
     * Set connection color
     */
    setConnectionColor(id: string, color: number): void {
        const connection = this.connections.get(id);
        if (!connection) return;

        connection.color = color;
        (connection.line.material as THREE.LineBasicMaterial).color.setHex(color);
    }

    /**
     * Set connection opacity
     */
    setConnectionOpacity(id: string, opacity: number): void {
        const connection = this.connections.get(id);
        if (!connection) return;

        connection.opacity = opacity;
        (connection.line.material as THREE.LineBasicMaterial).opacity = opacity;
    }

    /**
     * Serialize connections
     */
    serialize(): any {
        const data: any[] = [];

        for (const connection of this.connections.values()) {
            data.push({
                id: connection.id,
                from: { x: connection.from.x, y: connection.from.y, z: connection.from.z },
                to: { x: connection.to.x, y: connection.to.y, z: connection.to.z },
                color: connection.color,
                opacity: connection.opacity
            });
        }

        return data;
    }

    /**
     * Deserialize connections
     */
    deserialize(data: any[]): void {
        this.clear();

        for (const item of data) {
            const from = new THREE.Vector3(item.from.x, item.from.y, item.from.z);
            const to = new THREE.Vector3(item.to.x, item.to.y, item.to.z);
            this.createConnection(item.id, from, to, item.color);
        }
    }

    /**
     * Dispose all connections
     */
    dispose(): void {
        this.clear();
    }
}
