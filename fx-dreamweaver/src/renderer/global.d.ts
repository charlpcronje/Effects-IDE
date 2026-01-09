/**
 * Global type declarations for Dreamweaver renderer
 */

import type { Intersection, Object3D } from 'three';

declare global {
    interface Window {
        dreamweaver: {
            fs: {
                read: (path: string) => Promise<string>;
                write: (path: string, content: string) => Promise<void>;
                readdir: (path: string) => Promise<any[]>;
                stat: (path: string) => Promise<any>;
                mkdir: (path: string) => Promise<void>;
                delete: (path: string) => Promise<void>;
                rename: (oldPath: string, newPath: string) => Promise<void>;
            };
            pty: {
                spawn: (options?: { cwd?: string; shell?: string }) => Promise<string>;
                write: (sessionId: string, data: string) => Promise<void>;
                resize: (sessionId: string, cols: number, rows: number) => Promise<void>;
                kill: (sessionId: string) => Promise<void>;
                onData: (sessionId: string, callback: (data: string) => void) => () => void;
                onExit: (sessionId: string, callback: (code: number | null) => void) => void;
            };
            dialog: {
                open: (options: any) => Promise<any>;
                save: (options: any) => Promise<any>;
                message: (options: any) => Promise<any>;
            };
            shell: {
                openExternal: (url: string) => Promise<void>;
                showItemInFolder: (path: string) => Promise<void>;
            };
            window: {
                minimize: () => Promise<void>;
                maximize: () => Promise<void>;
                close: () => Promise<void>;
            };
            app: {
                getPath: (name: string) => Promise<string>;
                getVersion: () => Promise<string>;
            };
            on: (channel: string, callback: (...args: any[]) => void) => () => void;
        };
        dreamweaverApp?: any;
    }
}

// Extend Three.js types
declare module 'three' {
    interface Object3D {
        userData: {
            panelId?: string;
            panelType?: string;
            [key: string]: any;
        };
    }

    interface Intersection {
        userData?: {
            panelId?: string;
            panelType?: string;
            [key: string]: any;
        };
    }
}

export {};
