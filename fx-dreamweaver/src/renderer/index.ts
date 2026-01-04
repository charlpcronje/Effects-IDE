/**
 * FX Dreamweaver 3D IDE - Renderer Entry Point
 *
 * Initializes the WebGL scene, FX integration, and panel system
 */

import { DreamweaverApp } from './app';

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Dreamweaver] Initializing renderer...');

    try {
        const app = new DreamweaverApp();
        await app.init();

        // Expose to window for debugging
        (window as any).dreamweaverApp = app;

        console.log('[Dreamweaver] Renderer initialized');
    } catch (error) {
        console.error('[Dreamweaver] Failed to initialize:', error);
    }
});
