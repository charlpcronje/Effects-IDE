/**
 * Shared Types for FX Dreamweaver
 */

// Panel types
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

export interface PanelState {
    id: string;
    type: PanelType;
    title: string;
    position: Vector3;
    size: Size2D;
    visible: boolean;
    minimized: boolean;
    maximized: boolean;
    selected: boolean;
    focused: boolean;
}

// Geometry types
export interface Vector2 {
    x: number;
    y: number;
}

export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

export interface Size2D {
    width: number;
    height: number;
}

export interface Bounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

// File types
export interface FileEntry {
    name: string;
    path: string;
    isDirectory: boolean;
    size?: number;
    mtime?: string;
}

export interface FileBuffer {
    path: string;
    content: string;
    language: string;
    dirty: boolean;
    lastEdit: number;
}

// AI types
export interface AIMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    pending?: boolean;
}

export interface AISession {
    id: string;
    model: string;
    messages: AIMessage[];
    created: number;
}

export interface AIProvider {
    id: string;
    name: string;
    models: string[];
}

// Terminal types
export interface TerminalSession {
    id: string;
    cwd: string;
    history: string[];
    running: boolean;
}

// Theme types
export interface ThemeColors {
    background: string;
    surface: string;
    surfaceHover: string;
    primary: string;
    primaryDark: string;
    secondary: string;
    text: string;
    textSecondary: string;
    border: string;
    success: string;
    warning: string;
    error: string;
}

export interface ThemeFonts {
    ui: string;
    code: string;
}

export interface Theme {
    id: string;
    name: string;
    colors: ThemeColors;
    fonts: ThemeFonts;
}

// Event types
export interface DreamweaverEvent {
    type: string;
    timestamp: number;
    data: any;
}

export interface MenuEvent extends DreamweaverEvent {
    type: 'menu';
    action: string;
}

export interface PanelEvent extends DreamweaverEvent {
    type: 'panel';
    panelId: string;
    action: 'create' | 'close' | 'focus' | 'select' | 'move' | 'resize';
}

export interface FileEvent extends DreamweaverEvent {
    type: 'file';
    path: string;
    action: 'open' | 'save' | 'close' | 'change';
}

// Settings types
export interface Settings {
    viewMode: '2d' | '3d' | 'hybrid';
    theme: string;
    fontSize: number;
    tabSize: number;
    wordWrap: boolean;
    minimap: boolean;
    autoSave: boolean;
    autoSaveDelay: number;
    gridSize: number;
    snapToGrid: boolean;
    ai: {
        model: string;
        temperature: number;
        maxTokens: number;
    };
}

// Workspace types
export interface Workspace {
    projectPath: string | null;
    openFiles: string[];
    activeFile: string | null;
    panels: PanelState[];
    settings: Settings;
}

// MCP types
export interface MCPTool {
    name: string;
    description: string;
    parameters: Record<string, any>;
}

export interface MCPToolCall {
    tool: string;
    arguments: Record<string, any>;
    result?: any;
    error?: string;
}

// Observability types
export interface MetricData {
    name: string;
    value: number;
    timestamp: number;
    labels?: Record<string, string>;
}

export interface LogEntry {
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    timestamp: number;
    context?: Record<string, any>;
}

// Git types
export interface GitStatus {
    branch: string;
    ahead: number;
    behind: number;
    staged: string[];
    unstaged: string[];
    untracked: string[];
}

export interface GitCommit {
    hash: string;
    message: string;
    author: string;
    date: string;
}

// Database types
export interface DBConnection {
    id: string;
    name: string;
    type: 'sqlite' | 'mysql' | 'postgres';
    host?: string;
    port?: number;
    database: string;
    connected: boolean;
}

export interface DBTable {
    name: string;
    columns: DBColumn[];
    rowCount: number;
}

export interface DBColumn {
    name: string;
    type: string;
    nullable: boolean;
    primaryKey: boolean;
}

export interface DBQueryResult {
    columns: string[];
    rows: any[][];
    rowCount: number;
    time: number;
}
