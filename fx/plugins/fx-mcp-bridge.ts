// /plugins/fx-mcp-bridge.ts
/**
 * @fx-plugin fx-mcp-bridge
 * @fx-global $mcp
 * @fx-description MCP (Model Context Protocol) server integration for AI agents
 * @fx-dependencies fx-safe
 * @fx-provides $mcp
 * @fx-version 1.0.0
 *
 * FX MCP Bridge Plugin - Exposes FX nodes, files, and tools over MCP protocol
 * for AI agent integration. Enforces permissions and provides secure access.
 */

import type { FXCore, FXNodeProxy } from '../fx.v4';

// Get FXSuspend from global
const FXSuspend = (globalThis as any).FXSuspend;

// ============================================================================
// Types & Interfaces
// ============================================================================

export type MCPRole = 'observer' | 'builder' | 'dbAdmin' | 'marketplace' | 'owner';

export interface MCPAgent {
    id: string;
    name: string;
    provider: string; // 'anthropic', 'openai', etc.
    role: MCPRole;
    permissions: MCPPermissions;
    session: MCPSession;
    keyHash?: string;
}

export interface MCPPermissions {
    read: boolean;
    write: boolean;
    execute: boolean;
    pty: boolean;
    db: boolean;
    dbWrite: boolean;
    install: boolean;
    nodeUpdate: boolean;
    sceneCapture: boolean;
}

export interface MCPSession {
    id: string;
    startTime: number;
    lastActivity: number;
    tokenBudget: number;
    tokensUsed: number;
    actions: MCPAction[];
    status: 'active' | 'paused' | 'ended';
}

export interface MCPAction {
    id: string;
    timestamp: number;
    tool: string;
    args: Record<string, any>;
    result: any;
    status: 'pending' | 'success' | 'error' | 'denied';
    error?: string;
    snapshotId?: string; // for rollback
}

export interface MCPTool {
    name: string;
    description: string;
    parameters: Record<string, MCPToolParameter>;
    requiredPermissions: (keyof MCPPermissions)[];
    handler: (args: any, agent: MCPAgent, ctx: MCPContext) => any;
}

export interface MCPToolParameter {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description: string;
    required?: boolean;
    default?: any;
}

export interface MCPContext {
    fx: FXCore;
    agent: MCPAgent;
    session: MCPSession;
    emit: (event: string, data: any) => void;
    log: (message: string, data?: any) => void;
}

export interface MCPRequest {
    tool: string;
    args: Record<string, any>;
    traceId?: string;
}

export interface MCPResponse {
    success: boolean;
    data?: any;
    error?: string;
    actionId: string;
}

export interface MCPBridgeConfig {
    maxTokenBudget?: number;
    sessionTimeout?: number; // ms
    allowedProviders?: string[];
    dryRunMode?: boolean;
    logActions?: boolean;
    enableSnapshots?: boolean;
}

// ============================================================================
// Permission Presets
// ============================================================================

const ROLE_PERMISSIONS: Record<MCPRole, MCPPermissions> = {
    observer: {
        read: true,
        write: false,
        execute: false,
        pty: false,
        db: true,
        dbWrite: false,
        install: false,
        nodeUpdate: false,
        sceneCapture: true
    },
    builder: {
        read: true,
        write: true,
        execute: true,
        pty: true,
        db: true,
        dbWrite: false,
        install: false,
        nodeUpdate: true,
        sceneCapture: true
    },
    dbAdmin: {
        read: true,
        write: true,
        execute: true,
        pty: true,
        db: true,
        dbWrite: true,
        install: false,
        nodeUpdate: true,
        sceneCapture: true
    },
    marketplace: {
        read: true,
        write: false,
        execute: false,
        pty: false,
        db: false,
        dbWrite: false,
        install: true,
        nodeUpdate: false,
        sceneCapture: false
    },
    owner: {
        read: true,
        write: true,
        execute: true,
        pty: true,
        db: true,
        dbWrite: true,
        install: true,
        nodeUpdate: true,
        sceneCapture: true
    }
};

// ============================================================================
// Logger
// ============================================================================

class MCPLogger {
    private static logs: Array<{ level: string; message: string; data?: any; timestamp: number }> = [];

    static log(level: string, message: string, data?: any): void {
        const entry = { level, message, data, timestamp: Date.now() };
        this.logs.push(entry);
        console.log(`[FX-MCP:${level.toUpperCase()}]`, message, data ?? '');
    }

    static info(message: string, data?: any): void { this.log('info', message, data); }
    static warn(message: string, data?: any): void { this.log('warn', message, data); }
    static error(message: string, data?: any): void { this.log('error', message, data); }
    static debug(message: string, data?: any): void { this.log('debug', message, data); }

    static getLogs(): typeof MCPLogger.logs { return [...this.logs]; }
}

// ============================================================================
// MCP Bridge Plugin Class
// ============================================================================

export class FXMCPBridge {
    public readonly name = 'mcp-bridge';
    public readonly version = '1.0.0';
    public readonly description = 'MCP server integration for AI agents';

    private fx: FXCore;
    private config: MCPBridgeConfig;

    private agents = new Map<string, MCPAgent>();
    private sessions = new Map<string, MCPSession>();
    private tools = new Map<string, MCPTool>();
    private eventListeners = new Map<string, Set<Function>>();

    // Plugin dependencies
    private hasSafe = false;
    private hasTimeTravel = false;

    constructor(fx: FXCore, config: MCPBridgeConfig = {}) {
        this.fx = fx;
        this.config = {
            maxTokenBudget: 100000,
            sessionTimeout: 30 * 60 * 1000, // 30 minutes
            allowedProviders: ['anthropic', 'openai'],
            dryRunMode: false,
            logActions: true,
            enableSnapshots: true,
            ...config
        };

        // Initialize
        this.initNodes();
        this.registerBuiltinTools();
        this.detectDependencies();

        MCPLogger.info('FX MCP Bridge initialized');
    }

    // ========================================================================
    // Initialization
    // ========================================================================

    private initNodes(): void {
        const $$ = this.fx.proxy();

        $$('ai.sessions').val({});
        $$('ai.agents').val({});
        $$('ai.tools').val({});
        $$('ai.stats').val({
            activeSessions: 0,
            totalActions: 0,
            successfulActions: 0,
            deniedActions: 0
        });
    }

    private detectDependencies(): void {
        try {
            const $$ = this.fx.proxy();
            // Check if fx-safe is loaded
            this.hasSafe = !!$$('plugins.safe').val();
            // Check if fx-time-travel is loaded
            this.hasTimeTravel = !!$$('plugins.time-travel').val();
        } catch {
            // Dependencies not available
        }
    }

    private registerBuiltinTools(): void {
        // FS Tools
        this.registerTool({
            name: 'fs.read',
            description: 'Read file contents',
            parameters: {
                path: { type: 'string', description: 'File path', required: true }
            },
            requiredPermissions: ['read'],
            handler: (args, agent, ctx) => this.handleFsRead(args, ctx)
        });

        this.registerTool({
            name: 'fs.write',
            description: 'Write file contents',
            parameters: {
                path: { type: 'string', description: 'File path', required: true },
                content: { type: 'string', description: 'File content', required: true }
            },
            requiredPermissions: ['write'],
            handler: (args, agent, ctx) => this.handleFsWrite(args, ctx)
        });

        this.registerTool({
            name: 'fs.diff',
            description: 'Get diff between two file versions',
            parameters: {
                path: { type: 'string', description: 'File path', required: true },
                oldContent: { type: 'string', description: 'Old content', required: true },
                newContent: { type: 'string', description: 'New content', required: true }
            },
            requiredPermissions: ['read'],
            handler: (args, agent, ctx) => this.handleFsDiff(args, ctx)
        });

        // FX Node Tools
        this.registerTool({
            name: 'fx.node.inspect',
            description: 'Inspect FX node at path',
            parameters: {
                path: { type: 'string', description: 'Node path', required: true },
                depth: { type: 'number', description: 'Inspection depth', default: 2 }
            },
            requiredPermissions: ['read'],
            handler: (args, agent, ctx) => this.handleNodeInspect(args, ctx)
        });

        this.registerTool({
            name: 'fx.node.update',
            description: 'Update FX node value',
            parameters: {
                path: { type: 'string', description: 'Node path', required: true },
                value: { type: 'object', description: 'New value', required: true }
            },
            requiredPermissions: ['nodeUpdate'],
            handler: (args, agent, ctx) => this.handleNodeUpdate(args, ctx)
        });

        this.registerTool({
            name: 'fx.node.watch',
            description: 'Watch FX node for changes',
            parameters: {
                path: { type: 'string', description: 'Node path', required: true }
            },
            requiredPermissions: ['read'],
            handler: (args, agent, ctx) => this.handleNodeWatch(args, ctx)
        });

        // Scene Tools
        this.registerTool({
            name: 'scene.capture',
            description: 'Capture current scene/layout state',
            parameters: {
                includeNodes: { type: 'boolean', description: 'Include node data', default: true },
                includeFiles: { type: 'boolean', description: 'Include open files', default: false }
            },
            requiredPermissions: ['sceneCapture'],
            handler: (args, agent, ctx) => this.handleSceneCapture(args, ctx)
        });

        // PTY Tools
        this.registerTool({
            name: 'pty.exec',
            description: 'Execute command in PTY',
            parameters: {
                command: { type: 'string', description: 'Command to execute', required: true },
                cwd: { type: 'string', description: 'Working directory' },
                timeout: { type: 'number', description: 'Timeout in ms', default: 30000 }
            },
            requiredPermissions: ['pty', 'execute'],
            handler: (args, agent, ctx) => this.handlePtyExec(args, ctx)
        });

        // DB Tools
        this.registerTool({
            name: 'db.query',
            description: 'Execute database query',
            parameters: {
                connection: { type: 'string', description: 'Connection ID', required: true },
                query: { type: 'string', description: 'SQL query', required: true },
                params: { type: 'array', description: 'Query parameters' }
            },
            requiredPermissions: ['db'],
            handler: (args, agent, ctx) => this.handleDbQuery(args, ctx)
        });

        this.registerTool({
            name: 'db.schema',
            description: 'Get database schema',
            parameters: {
                connection: { type: 'string', description: 'Connection ID', required: true }
            },
            requiredPermissions: ['db'],
            handler: (args, agent, ctx) => this.handleDbSchema(args, ctx)
        });

        // Update tools in FX node
        const $$ = this.fx.proxy();
        const toolList: Record<string, any> = {};
        for (const [name, tool] of this.tools) {
            toolList[name] = {
                description: tool.description,
                parameters: tool.parameters,
                permissions: tool.requiredPermissions
            };
        }
        $$('ai.tools').val(toolList);
    }

    // ========================================================================
    // Agent Management
    // ========================================================================

    /**
     * Register a new AI agent
     */
    registerAgent(config: {
        id: string;
        name: string;
        provider: string;
        role?: MCPRole;
        keyHash?: string;
    }): MCPAgent {
        if (!this.config.allowedProviders?.includes(config.provider)) {
            throw new Error(`Provider not allowed: ${config.provider}`);
        }

        const role = config.role || 'builder';
        const agent: MCPAgent = {
            id: config.id,
            name: config.name,
            provider: config.provider,
            role,
            permissions: { ...ROLE_PERMISSIONS[role] },
            keyHash: config.keyHash,
            session: this.createSession(config.id)
        };

        this.agents.set(config.id, agent);

        const $$ = this.fx.proxy();
        $$(`ai.agents.${config.id}`).val({
            id: agent.id,
            name: agent.name,
            provider: agent.provider,
            role: agent.role,
            sessionId: agent.session.id
        });

        MCPLogger.info(`Agent registered: ${config.name}`, { id: config.id, role });

        return agent;
    }

    /**
     * Get agent by ID
     */
    getAgent(id: string): MCPAgent | undefined {
        return this.agents.get(id);
    }

    /**
     * Update agent permissions
     */
    updatePermissions(agentId: string, permissions: Partial<MCPPermissions>): void {
        const agent = this.agents.get(agentId);
        if (agent) {
            Object.assign(agent.permissions, permissions);
            MCPLogger.info(`Permissions updated for agent: ${agentId}`, permissions);
        }
    }

    /**
     * Remove agent
     */
    removeAgent(id: string): void {
        const agent = this.agents.get(id);
        if (agent) {
            this.endSession(agent.session.id);
            this.agents.delete(id);

            const $$ = this.fx.proxy();
            $$(`ai.agents.${id}`).val(undefined);

            MCPLogger.info(`Agent removed: ${id}`);
        }
    }

    // ========================================================================
    // Session Management
    // ========================================================================

    private createSession(agentId: string): MCPSession {
        const session: MCPSession = {
            id: `session-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            startTime: Date.now(),
            lastActivity: Date.now(),
            tokenBudget: this.config.maxTokenBudget!,
            tokensUsed: 0,
            actions: [],
            status: 'active'
        };

        this.sessions.set(session.id, session);

        const $$ = this.fx.proxy();
        $$(`ai.sessions.${session.id}`).val({
            id: session.id,
            agentId,
            startTime: session.startTime,
            status: session.status,
            timeline: []
        });

        this.updateStats();

        return session;
    }

    /**
     * Get session by ID
     */
    getSession(id: string): MCPSession | undefined {
        return this.sessions.get(id);
    }

    /**
     * End a session
     */
    endSession(id: string): void {
        const session = this.sessions.get(id);
        if (session) {
            session.status = 'ended';

            const $$ = this.fx.proxy();
            $$(`ai.sessions.${id}.status`).val('ended');

            this.updateStats();
            MCPLogger.info(`Session ended: ${id}`);
        }
    }

    /**
     * Pause a session
     */
    pauseSession(id: string): void {
        const session = this.sessions.get(id);
        if (session) {
            session.status = 'paused';

            const $$ = this.fx.proxy();
            $$(`ai.sessions.${id}.status`).val('paused');

            MCPLogger.info(`Session paused: ${id}`);
        }
    }

    /**
     * Resume a session
     */
    resumeSession(id: string): void {
        const session = this.sessions.get(id);
        if (session && session.status === 'paused') {
            session.status = 'active';
            session.lastActivity = Date.now();

            const $$ = this.fx.proxy();
            $$(`ai.sessions.${id}.status`).val('active');

            MCPLogger.info(`Session resumed: ${id}`);
        }
    }

    // ========================================================================
    // Tool Registration & Execution
    // ========================================================================

    /**
     * Register a custom tool
     */
    registerTool(tool: MCPTool): void {
        this.tools.set(tool.name, tool);
        MCPLogger.debug(`Tool registered: ${tool.name}`);
    }

    /**
     * Execute a tool
     */
    executeTool(agentId: string, request: MCPRequest): MCPResponse {
        const agent = this.agents.get(agentId);
        if (!agent) {
            return { success: false, error: 'Agent not found', actionId: '' };
        }

        if (agent.session.status !== 'active') {
            return { success: false, error: 'Session not active', actionId: '' };
        }

        const tool = this.tools.get(request.tool);
        if (!tool) {
            return { success: false, error: `Tool not found: ${request.tool}`, actionId: '' };
        }

        // Check permissions
        for (const permission of tool.requiredPermissions) {
            if (!agent.permissions[permission]) {
                const action = this.logAction(agent, request.tool, request.args, null, 'denied', 'Permission denied');
                this.updateStats();
                return { success: false, error: `Permission denied: ${permission}`, actionId: action.id };
            }
        }

        // Create snapshot before action if enabled
        let snapshotId: string | undefined;
        if (this.config.enableSnapshots && this.hasTimeTravel) {
            snapshotId = this.createSnapshot(`Before ${request.tool}`);
        }

        // Create context
        const ctx: MCPContext = {
            fx: this.fx,
            agent,
            session: agent.session,
            emit: (event, data) => this.emit(event, data),
            log: (msg, data) => MCPLogger.info(msg, data)
        };

        try {
            // Dry run mode
            if (this.config.dryRunMode && tool.requiredPermissions.includes('write')) {
                const action = this.logAction(agent, request.tool, request.args, null, 'pending', 'Dry run mode');
                return {
                    success: true,
                    data: { dryRun: true, wouldExecute: request },
                    actionId: action.id
                };
            }

            // Execute tool
            const result = tool.handler(request.args, agent, ctx);

            // Log action
            const action = this.logAction(agent, request.tool, request.args, result, 'success', undefined, snapshotId);

            // Update session
            agent.session.lastActivity = Date.now();
            this.updateStats();

            return { success: true, data: result, actionId: action.id };

        } catch (e: any) {
            const action = this.logAction(agent, request.tool, request.args, null, 'error', e.message, snapshotId);
            MCPLogger.error(`Tool execution failed: ${request.tool}`, e);
            return { success: false, error: e.message, actionId: action.id };
        }
    }

    private logAction(
        agent: MCPAgent,
        tool: string,
        args: Record<string, any>,
        result: any,
        status: MCPAction['status'],
        error?: string,
        snapshotId?: string
    ): MCPAction {
        const action: MCPAction = {
            id: `action-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            timestamp: Date.now(),
            tool,
            args,
            result,
            status,
            error,
            snapshotId
        };

        agent.session.actions.push(action);

        if (this.config.logActions) {
            const $$ = this.fx.proxy();
            const timeline = $$(`ai.sessions.${agent.session.id}.timeline`).val() || [];
            timeline.push({
                id: action.id,
                timestamp: action.timestamp,
                tool: action.tool,
                status: action.status,
                error: action.error
            });
            $$(`ai.sessions.${agent.session.id}.timeline`).val(timeline);
        }

        return action;
    }

    // ========================================================================
    // Built-in Tool Handlers
    // ========================================================================

    private handleFsRead(args: { path: string }, ctx: MCPContext): any {
        // Validate path is within workspace
        if (this.hasSafe) {
            const $$ = this.fx.proxy();
            const safe = $$('plugins.safe').val();
            if (safe && !safe.isPathAllowed(args.path)) {
                throw new Error('Path not allowed');
            }
        }

        const $$ = this.fx.proxy();
        const fileNode = $$(`workspace.files.${this.pathToKey(args.path)}`);
        const content = fileNode.val()?.content;

        if (content === undefined) {
            throw new Error('File not found');
        }

        return { path: args.path, content };
    }

    private handleFsWrite(args: { path: string; content: string }, ctx: MCPContext): any {
        if (this.hasSafe) {
            const $$ = this.fx.proxy();
            const safe = $$('plugins.safe').val();
            if (safe && !safe.isPathAllowed(args.path)) {
                throw new Error('Path not allowed');
            }
        }

        const $$ = this.fx.proxy();
        const key = this.pathToKey(args.path);

        $$(`workspace.files.${key}`).val({
            path: args.path,
            content: args.content,
            lastEdit: Date.now(),
            agentLocks: [{ agent: ctx.agent.id, expires: Date.now() + 60000 }]
        });

        ctx.emit('file:write', { path: args.path, agent: ctx.agent.id });

        return { path: args.path, written: true };
    }

    private handleFsDiff(args: { path: string; oldContent: string; newContent: string }, ctx: MCPContext): any {
        // Simple line-based diff
        const oldLines = args.oldContent.split('\n');
        const newLines = args.newContent.split('\n');
        const changes: Array<{ type: 'add' | 'remove' | 'same'; line: number; content: string }> = [];

        let i = 0, j = 0;
        while (i < oldLines.length || j < newLines.length) {
            if (i >= oldLines.length) {
                changes.push({ type: 'add', line: j + 1, content: newLines[j] });
                j++;
            } else if (j >= newLines.length) {
                changes.push({ type: 'remove', line: i + 1, content: oldLines[i] });
                i++;
            } else if (oldLines[i] === newLines[j]) {
                changes.push({ type: 'same', line: i + 1, content: oldLines[i] });
                i++;
                j++;
            } else {
                changes.push({ type: 'remove', line: i + 1, content: oldLines[i] });
                changes.push({ type: 'add', line: j + 1, content: newLines[j] });
                i++;
                j++;
            }
        }

        return { path: args.path, changes };
    }

    private handleNodeInspect(args: { path: string; depth?: number }, ctx: MCPContext): any {
        const $$ = this.fx.proxy();
        const node = $$(args.path);
        const value = node.val();

        const inspect = (val: any, currentDepth: number): any => {
            if (currentDepth > (args.depth || 2)) return '[...]';
            if (val === null) return null;
            if (val === undefined) return undefined;
            if (typeof val !== 'object') return val;
            if (Array.isArray(val)) {
                return val.map(v => inspect(v, currentDepth + 1));
            }
            const result: Record<string, any> = {};
            for (const [k, v] of Object.entries(val)) {
                result[k] = inspect(v, currentDepth + 1);
            }
            return result;
        };

        return {
            path: args.path,
            value: inspect(value, 0),
            type: node.type()
        };
    }

    private handleNodeUpdate(args: { path: string; value: any }, ctx: MCPContext): any {
        const $$ = this.fx.proxy();
        $$(args.path).val(args.value);

        ctx.emit('node:update', { path: args.path, agent: ctx.agent.id });

        return { path: args.path, updated: true };
    }

    private handleNodeWatch(args: { path: string }, ctx: MCPContext): any {
        const $$ = this.fx.proxy();
        const watchId = `watch-${Date.now()}`;

        // Set up watch - this would need to be async/streaming in practice
        const unwatch = $$(args.path).watch((newVal, oldVal) => {
            ctx.emit(`node:change:${args.path}`, { path: args.path, newVal, oldVal });
        });

        return { path: args.path, watchId, watching: true };
    }

    private handleSceneCapture(args: { includeNodes?: boolean; includeFiles?: boolean }, ctx: MCPContext): any {
        const $$ = this.fx.proxy();
        const capture: Record<string, any> = {
            timestamp: Date.now(),
            agent: ctx.agent.id
        };

        if (args.includeNodes) {
            capture.panels = $$('ui.panels').val() || {};
            capture.layout = $$('ui.layout').val() || {};
        }

        if (args.includeFiles) {
            const files = $$('workspace.files').val() || {};
            capture.files = Object.keys(files).map(k => ({
                path: files[k].path,
                language: files[k].language,
                dirty: files[k].dirty
            }));
        }

        return capture;
    }

    private handlePtyExec(args: { command: string; cwd?: string; timeout?: number }, ctx: MCPContext): any {
        // This would integrate with actual PTY in Electron environment
        // For now, return a placeholder
        ctx.log(`PTY exec requested: ${args.command}`);

        const $$ = this.fx.proxy();
        const ptyNode = $$(`tools.pty.sessions.${ctx.session.id}`);

        ptyNode.val({
            command: args.command,
            cwd: args.cwd,
            status: 'pending',
            output: '',
            startTime: Date.now()
        });

        // In real implementation, this would spawn PTY process
        return {
            sessionId: ctx.session.id,
            command: args.command,
            status: 'queued'
        };
    }

    private handleDbQuery(args: { connection: string; query: string; params?: any[] }, ctx: MCPContext): any {
        // Check if write operation and permissions
        const isWriteQuery = /^\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)/i.test(args.query);
        if (isWriteQuery && !ctx.agent.permissions.dbWrite) {
            throw new Error('DB write permission required');
        }

        const $$ = this.fx.proxy();
        const dbPlugin = $$('plugins.orm').val();

        if (!dbPlugin) {
            throw new Error('ORM plugin not available');
        }

        // Execute query through ORM plugin
        // This is a simplified interface
        return {
            connection: args.connection,
            query: args.query,
            status: 'executed',
            // Results would come from actual DB
            results: []
        };
    }

    private handleDbSchema(args: { connection: string }, ctx: MCPContext): any {
        const $$ = this.fx.proxy();

        // Would integrate with actual DB connection
        return {
            connection: args.connection,
            tables: [],
            views: [],
            status: 'retrieved'
        };
    }

    // ========================================================================
    // Event System
    // ========================================================================

    /**
     * Subscribe to events
     */
    on(event: string, callback: Function): () => void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event)!.add(callback);

        return () => this.off(event, callback);
    }

    /**
     * Unsubscribe from events
     */
    off(event: string, callback: Function): void {
        this.eventListeners.get(event)?.delete(callback);
    }

    /**
     * Emit event
     */
    emit(event: string, data: any): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            for (const listener of listeners) {
                try {
                    listener(data);
                } catch (e) {
                    MCPLogger.error(`Event listener error: ${event}`, e);
                }
            }
        }
    }

    // ========================================================================
    // Rollback & Snapshots
    // ========================================================================

    private createSnapshot(label: string): string | undefined {
        if (!this.hasTimeTravel) return undefined;

        try {
            const $$ = this.fx.proxy();
            const timeTravel = $$('plugins.time-travel').val();
            if (timeTravel?.snapshot) {
                return timeTravel.snapshot(label);
            }
        } catch {
            return undefined;
        }
    }

    /**
     * Rollback an action
     */
    rollbackAction(actionId: string): boolean {
        // Find action
        for (const session of this.sessions.values()) {
            const action = session.actions.find(a => a.id === actionId);
            if (action && action.snapshotId && this.hasTimeTravel) {
                try {
                    const $$ = this.fx.proxy();
                    const timeTravel = $$('plugins.time-travel').val();
                    if (timeTravel?.restore) {
                        timeTravel.restore(action.snapshotId);
                        MCPLogger.info(`Rolled back action: ${actionId}`);
                        return true;
                    }
                } catch (e) {
                    MCPLogger.error(`Rollback failed: ${actionId}`, e);
                }
            }
        }
        return false;
    }

    // ========================================================================
    // Utilities
    // ========================================================================

    private pathToKey(path: string): string {
        return path.replace(/[\/\\.]/g, '_');
    }

    private updateStats(): void {
        const $$ = this.fx.proxy();
        let totalActions = 0;
        let successfulActions = 0;
        let deniedActions = 0;

        for (const session of this.sessions.values()) {
            totalActions += session.actions.length;
            successfulActions += session.actions.filter(a => a.status === 'success').length;
            deniedActions += session.actions.filter(a => a.status === 'denied').length;
        }

        $$('ai.stats').val({
            activeSessions: Array.from(this.sessions.values()).filter(s => s.status === 'active').length,
            totalActions,
            successfulActions,
            deniedActions
        });
    }

    /**
     * Get list of available tools
     */
    getTools(): Array<{ name: string; description: string; permissions: string[] }> {
        return Array.from(this.tools.values()).map(t => ({
            name: t.name,
            description: t.description,
            permissions: t.requiredPermissions
        }));
    }

    /**
     * Get all active sessions
     */
    getActiveSessions(): MCPSession[] {
        return Array.from(this.sessions.values()).filter(s => s.status === 'active');
    }

    /**
     * Enable dry run mode
     */
    setDryRunMode(enabled: boolean): void {
        this.config.dryRunMode = enabled;
        MCPLogger.info(`Dry run mode: ${enabled}`);
    }

    /**
     * Clean up expired sessions
     */
    cleanupSessions(): number {
        const now = Date.now();
        const timeout = this.config.sessionTimeout!;
        let cleaned = 0;

        for (const [id, session] of this.sessions) {
            if (session.status === 'active' && now - session.lastActivity > timeout) {
                this.endSession(id);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            MCPLogger.info(`Cleaned up ${cleaned} expired sessions`);
        }

        return cleaned;
    }
}

// ============================================================================
// Plugin Export
// ============================================================================

export default function(fx: FXCore, config: MCPBridgeConfig = {}): FXMCPBridge {
    return new FXMCPBridge(fx, config);
}
