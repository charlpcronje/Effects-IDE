/**
 * Preload Script - Secure bridge between main and renderer
 */

import { contextBridge, ipcRenderer } from 'electron';

// Expose safe APIs to renderer
contextBridge.exposeInMainWorld('dreamweaver', {
    // File System
    fs: {
        read: (path: string) => ipcRenderer.invoke('fs:read', path),
        write: (path: string, content: string) => ipcRenderer.invoke('fs:write', path, content),
        readdir: (path: string) => ipcRenderer.invoke('fs:readdir', path),
        stat: (path: string) => ipcRenderer.invoke('fs:stat', path),
        mkdir: (path: string) => ipcRenderer.invoke('fs:mkdir', path),
        delete: (path: string) => ipcRenderer.invoke('fs:delete', path),
        rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:rename', oldPath, newPath)
    },

    // PTY Terminal
    pty: {
        spawn: (options?: { cwd?: string; shell?: string }) => ipcRenderer.invoke('pty:spawn', options || {}),
        write: (sessionId: string, data: string) => ipcRenderer.invoke('pty:write', sessionId, data),
        resize: (sessionId: string, cols: number, rows: number) => ipcRenderer.invoke('pty:resize', sessionId, cols, rows),
        kill: (sessionId: string) => ipcRenderer.invoke('pty:kill', sessionId),
        onData: (sessionId: string, callback: (data: string) => void) => {
            const handler = (_event: any, data: string) => callback(data);
            ipcRenderer.on(`pty:data:${sessionId}`, handler);
            return () => ipcRenderer.removeListener(`pty:data:${sessionId}`, handler);
        },
        onExit: (sessionId: string, callback: (code: number | null) => void) => {
            const handler = (_event: any, code: number | null) => callback(code);
            ipcRenderer.once(`pty:exit:${sessionId}`, handler);
        }
    },

    // Dialogs
    dialog: {
        open: (options: any) => ipcRenderer.invoke('dialog:open', options),
        save: (options: any) => ipcRenderer.invoke('dialog:save', options),
        message: (options: any) => ipcRenderer.invoke('dialog:message', options)
    },

    // Shell
    shell: {
        openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
        showItemInFolder: (path: string) => ipcRenderer.invoke('shell:showItemInFolder', path)
    },

    // Window
    window: {
        minimize: () => ipcRenderer.invoke('window:minimize'),
        maximize: () => ipcRenderer.invoke('window:maximize'),
        close: () => ipcRenderer.invoke('window:close')
    },

    // App
    app: {
        getPath: (name: string) => ipcRenderer.invoke('app:getPath', name),
        getVersion: () => ipcRenderer.invoke('app:getVersion')
    },

    // Menu events
    on: (channel: string, callback: (...args: any[]) => void) => {
        const validChannels = [
            'menu:new-project', 'menu:open-project', 'menu:save', 'menu:save-all',
            'menu:export-workspace', 'menu:import-workspace',
            'menu:find', 'menu:find-in-files', 'menu:replace',
            'menu:command-palette', 'menu:view-2d', 'menu:view-3d', 'menu:view-hybrid',
            'menu:zoom-in', 'menu:zoom-out', 'menu:zoom-reset',
            'menu:panel-explorer', 'menu:panel-editor', 'menu:panel-terminal',
            'menu:panel-ai', 'menu:panel-node-graph', 'menu:panel-database',
            'menu:panel-api', 'menu:panel-git', 'menu:panel-theme-lab',
            'menu:panel-marketplace',
            'menu:ai-new-chat', 'menu:ai-clear-context', 'menu:ai-model',
            'menu:ai-permissions', 'menu:ai-mcp-status',
            'menu:build', 'menu:run', 'menu:run-tests', 'menu:lint', 'menu:format',
            'menu:voice-commands',
            'menu:help-docs', 'menu:help-shortcuts', 'menu:help-report', 'menu:help-about',
            'menu:preferences'
        ];

        if (validChannels.includes(channel)) {
            const handler = (_event: any, ...args: any[]) => callback(...args);
            ipcRenderer.on(channel, handler);
            return () => ipcRenderer.removeListener(channel, handler);
        }
        return () => {};
    }
});

// Type declarations for renderer
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
    }
}
