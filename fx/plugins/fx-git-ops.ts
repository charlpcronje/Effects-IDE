// /plugins/fx-git-ops.ts
/**
 * @fx-plugin fx-git-ops
 * @fx-global $git
 * @fx-description Git command abstraction, history view, and branch management
 * @fx-dependencies
 * @fx-provides $git
 * @fx-version 1.0.0
 *
 * FX Git Operations Plugin - Provides Git command abstraction, credential handling,
 * history visualization, and branch management for the FX IDE.
 */

import type { FXCore, FXNodeProxy } from '../fx.v4';

// Get FXSuspend from global
const FXSuspend = (globalThis as any).FXSuspend;

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface GitStatus {
    branch: string;
    ahead: number;
    behind: number;
    staged: FileChange[];
    unstaged: FileChange[];
    untracked: string[];
    conflicted: string[];
    clean: boolean;
}

export interface FileChange {
    path: string;
    status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied';
    oldPath?: string; // for renames
    staged: boolean;
}

export interface Commit {
    hash: string;
    shortHash: string;
    author: string;
    email: string;
    date: number;
    message: string;
    body?: string;
    parents: string[];
    refs: string[];
}

export interface Branch {
    name: string;
    current: boolean;
    remote?: string;
    upstream?: string;
    ahead: number;
    behind: number;
    lastCommit?: string;
}

export interface Remote {
    name: string;
    fetchUrl: string;
    pushUrl: string;
}

export interface DiffHunk {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    content: string[];
}

export interface FileDiff {
    path: string;
    oldPath?: string;
    hunks: DiffHunk[];
    additions: number;
    deletions: number;
    binary: boolean;
}

export interface MergeResult {
    success: boolean;
    conflicts: string[];
    message?: string;
}

export interface StashEntry {
    index: number;
    message: string;
    branch: string;
    date: number;
}

export interface GitOpsConfig {
    workDir?: string;
    autoFetch?: boolean;
    fetchInterval?: number; // ms
    signCommits?: boolean;
    defaultRemote?: string;
}

// ============================================================================
// Logger
// ============================================================================

class GitLogger {
    static log(level: string, message: string, data?: any): void {
        console.log(`[FX-GIT:${level.toUpperCase()}]`, message, data ?? '');
    }
    static info(message: string, data?: any): void { this.log('info', message, data); }
    static warn(message: string, data?: any): void { this.log('warn', message, data); }
    static error(message: string, data?: any): void { this.log('error', message, data); }
    static debug(message: string, data?: any): void { this.log('debug', message, data); }
}

// ============================================================================
// Command Queue for batching operations
// ============================================================================

interface CommandResult {
    success: boolean;
    output: string;
    error?: string;
    code: number;
}

class CommandQueue {
    private queue: Array<{
        command: string;
        args: string[];
        resolve: (result: CommandResult) => void;
        reject: (error: Error) => void;
    }> = [];
    private processing = false;
    private workDir: string;

    constructor(workDir: string) {
        this.workDir = workDir;
    }

    async execute(command: string, args: string[]): Promise<CommandResult> {
        return new Promise((resolve, reject) => {
            this.queue.push({ command, args, resolve, reject });
            this.process();
        });
    }

    private async process(): Promise<void> {
        if (this.processing || this.queue.length === 0) return;

        this.processing = true;

        while (this.queue.length > 0) {
            const item = this.queue.shift()!;

            try {
                const result = await this.runCommand(item.command, item.args);
                item.resolve(result);
            } catch (e: any) {
                item.reject(e);
            }
        }

        this.processing = false;
    }

    private async runCommand(command: string, args: string[]): Promise<CommandResult> {
        // In Deno/Node environment, use child_process
        // In browser, this would need to communicate with backend
        const isDeno = typeof (globalThis as any).Deno !== 'undefined';
        const isNode = typeof (globalThis as any).process !== 'undefined';

        if (isDeno) {
            return this.runDeno(command, args);
        } else if (isNode) {
            return this.runNode(command, args);
        } else {
            // Browser - would need WebSocket/HTTP to backend
            return this.runBrowser(command, args);
        }
    }

    private async runDeno(command: string, args: string[]): Promise<CommandResult> {
        const Deno = (globalThis as any).Deno;
        try {
            const cmd = new Deno.Command(command, {
                args,
                cwd: this.workDir,
                stdout: 'piped',
                stderr: 'piped'
            });

            const output = await cmd.output();
            const decoder = new TextDecoder();

            return {
                success: output.success,
                output: decoder.decode(output.stdout),
                error: decoder.decode(output.stderr),
                code: output.code
            };
        } catch (e: any) {
            return {
                success: false,
                output: '',
                error: e.message,
                code: -1
            };
        }
    }

    private async runNode(command: string, args: string[]): Promise<CommandResult> {
        return new Promise((resolve) => {
            const { spawn } = require('child_process');
            const proc = spawn(command, args, {
                cwd: this.workDir,
                shell: true
            });

            let stdout = '';
            let stderr = '';

            proc.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
            proc.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

            proc.on('close', (code: number) => {
                resolve({
                    success: code === 0,
                    output: stdout,
                    error: stderr,
                    code
                });
            });

            proc.on('error', (err: Error) => {
                resolve({
                    success: false,
                    output: '',
                    error: err.message,
                    code: -1
                });
            });
        });
    }

    private async runBrowser(command: string, args: string[]): Promise<CommandResult> {
        // Placeholder for browser implementation
        // Would need to communicate with backend service
        GitLogger.warn('Git commands not available in browser without backend');
        return {
            success: false,
            output: '',
            error: 'Git commands require backend service in browser',
            code: -1
        };
    }
}

// ============================================================================
// Git Operations Plugin Class
// ============================================================================

export class FXGitOps {
    public readonly name = 'git-ops';
    public readonly version = '1.0.0';
    public readonly description = 'Git command abstraction and branch management';

    private fx: FXCore;
    private config: GitOpsConfig;
    private commandQueue: CommandQueue;
    private fetchInterval: NodeJS.Timeout | number | null = null;

    constructor(fx: FXCore, config: GitOpsConfig = {}) {
        this.fx = fx;
        this.config = {
            workDir: config.workDir || '.',
            autoFetch: config.autoFetch ?? false,
            fetchInterval: config.fetchInterval ?? 60000,
            signCommits: config.signCommits ?? false,
            defaultRemote: config.defaultRemote ?? 'origin'
        };

        this.commandQueue = new CommandQueue(this.config.workDir!);
        this.initNodes();

        if (this.config.autoFetch) {
            this.startAutoFetch();
        }

        GitLogger.info('FX Git Ops initialized', { workDir: this.config.workDir });
    }

    // ========================================================================
    // Initialization
    // ========================================================================

    private initNodes(): void {
        const $$ = this.fx.proxy();

        $$('tools.git.status').val(null);
        $$('tools.git.branches').val([]);
        $$('tools.git.remotes').val([]);
        $$('tools.git.history').val([]);
        $$('tools.git.stash').val([]);
        $$('tools.git.config').val(this.config);
    }

    private startAutoFetch(): void {
        this.fetchInterval = setInterval(() => {
            this.fetch().catch(e => GitLogger.error('Auto-fetch failed', e));
        }, this.config.fetchInterval!);
    }

    // ========================================================================
    // Status Operations
    // ========================================================================

    /**
     * Get current Git status
     */
    async status(): Promise<GitStatus> {
        const result = await this.git('status', '--porcelain=v2', '--branch');

        if (!result.success) {
            throw new Error(`Git status failed: ${result.error}`);
        }

        const status = this.parseStatus(result.output);

        const $$ = this.fx.proxy();
        $$('tools.git.status').val(status);

        return status;
    }

    private parseStatus(output: string): GitStatus {
        const lines = output.split('\n').filter(l => l);
        const status: GitStatus = {
            branch: 'unknown',
            ahead: 0,
            behind: 0,
            staged: [],
            unstaged: [],
            untracked: [],
            conflicted: [],
            clean: true
        };

        for (const line of lines) {
            if (line.startsWith('# branch.head')) {
                status.branch = line.split(' ')[2] || 'unknown';
            } else if (line.startsWith('# branch.ab')) {
                const match = line.match(/\+(\d+) -(\d+)/);
                if (match) {
                    status.ahead = parseInt(match[1]);
                    status.behind = parseInt(match[2]);
                }
            } else if (line.startsWith('1') || line.startsWith('2')) {
                // Changed entries
                const parts = line.split(' ');
                const xy = parts[1];
                const path = parts[parts.length - 1];

                const change: FileChange = {
                    path,
                    status: this.parseChangeStatus(xy[0]),
                    staged: xy[0] !== '.'
                };

                if (xy[0] !== '.') {
                    status.staged.push({ ...change, staged: true });
                }
                if (xy[1] !== '.') {
                    status.unstaged.push({ ...change, staged: false, status: this.parseChangeStatus(xy[1]) });
                }

                status.clean = false;
            } else if (line.startsWith('?')) {
                // Untracked
                const path = line.substring(2);
                status.untracked.push(path);
                status.clean = false;
            } else if (line.startsWith('u')) {
                // Conflicted
                const parts = line.split(' ');
                status.conflicted.push(parts[parts.length - 1]);
                status.clean = false;
            }
        }

        return status;
    }

    private parseChangeStatus(code: string): FileChange['status'] {
        switch (code) {
            case 'A': return 'added';
            case 'M': return 'modified';
            case 'D': return 'deleted';
            case 'R': return 'renamed';
            case 'C': return 'copied';
            default: return 'modified';
        }
    }

    // ========================================================================
    // Branch Operations
    // ========================================================================

    /**
     * Get list of branches
     */
    async branches(): Promise<Branch[]> {
        const result = await this.git('branch', '-vv', '--format=%(refname:short)|%(upstream:short)|%(upstream:track)|%(objectname:short)');

        if (!result.success) {
            throw new Error(`Git branch failed: ${result.error}`);
        }

        const branches = this.parseBranches(result.output);

        const $$ = this.fx.proxy();
        $$('tools.git.branches').val(branches);

        return branches;
    }

    private parseBranches(output: string): Branch[] {
        const lines = output.split('\n').filter(l => l);
        return lines.map(line => {
            const [name, upstream, track, commit] = line.split('|');
            const aheadMatch = track?.match(/ahead (\d+)/);
            const behindMatch = track?.match(/behind (\d+)/);

            return {
                name: name.replace(/^\* /, ''),
                current: line.startsWith('* '),
                upstream: upstream || undefined,
                ahead: aheadMatch ? parseInt(aheadMatch[1]) : 0,
                behind: behindMatch ? parseInt(behindMatch[1]) : 0,
                lastCommit: commit
            };
        });
    }

    /**
     * Create a new branch
     */
    async createBranch(name: string, startPoint?: string): Promise<void> {
        const args = ['checkout', '-b', name];
        if (startPoint) args.push(startPoint);

        const result = await this.git(...args);
        if (!result.success) {
            throw new Error(`Failed to create branch: ${result.error}`);
        }

        GitLogger.info(`Created branch: ${name}`);
        await this.branches();
    }

    /**
     * Switch to a branch
     */
    async checkout(ref: string): Promise<void> {
        const result = await this.git('checkout', ref);
        if (!result.success) {
            throw new Error(`Checkout failed: ${result.error}`);
        }

        GitLogger.info(`Checked out: ${ref}`);
        await this.status();
    }

    /**
     * Delete a branch
     */
    async deleteBranch(name: string, force: boolean = false): Promise<void> {
        const flag = force ? '-D' : '-d';
        const result = await this.git('branch', flag, name);

        if (!result.success) {
            throw new Error(`Failed to delete branch: ${result.error}`);
        }

        GitLogger.info(`Deleted branch: ${name}`);
        await this.branches();
    }

    /**
     * Merge a branch
     */
    async merge(branch: string, noFastForward: boolean = false): Promise<MergeResult> {
        const args = ['merge', branch];
        if (noFastForward) args.push('--no-ff');

        const result = await this.git(...args);

        if (!result.success) {
            // Check for conflicts
            const status = await this.status();
            if (status.conflicted.length > 0) {
                return {
                    success: false,
                    conflicts: status.conflicted,
                    message: 'Merge conflicts detected'
                };
            }
            throw new Error(`Merge failed: ${result.error}`);
        }

        await this.status();
        return { success: true, conflicts: [] };
    }

    // ========================================================================
    // Commit Operations
    // ========================================================================

    /**
     * Get commit history
     */
    async log(limit: number = 50, branch?: string): Promise<Commit[]> {
        const args = [
            'log',
            `--max-count=${limit}`,
            '--format=%H|%h|%an|%ae|%at|%s|%P|%D',
            branch || 'HEAD'
        ];

        const result = await this.git(...args);
        if (!result.success) {
            throw new Error(`Git log failed: ${result.error}`);
        }

        const commits = this.parseLog(result.output);

        const $$ = this.fx.proxy();
        $$('tools.git.history').val(commits);

        return commits;
    }

    private parseLog(output: string): Commit[] {
        const lines = output.split('\n').filter(l => l);
        return lines.map(line => {
            const [hash, shortHash, author, email, timestamp, message, parents, refs] = line.split('|');
            return {
                hash,
                shortHash,
                author,
                email,
                date: parseInt(timestamp) * 1000,
                message,
                parents: parents ? parents.split(' ') : [],
                refs: refs ? refs.split(', ').filter(r => r) : []
            };
        });
    }

    /**
     * Stage files
     */
    async add(paths: string | string[]): Promise<void> {
        const pathList = Array.isArray(paths) ? paths : [paths];
        const result = await this.git('add', ...pathList);

        if (!result.success) {
            throw new Error(`Git add failed: ${result.error}`);
        }

        GitLogger.info(`Staged: ${pathList.join(', ')}`);
        await this.status();
    }

    /**
     * Unstage files
     */
    async unstage(paths: string | string[]): Promise<void> {
        const pathList = Array.isArray(paths) ? paths : [paths];
        const result = await this.git('reset', 'HEAD', '--', ...pathList);

        if (!result.success) {
            throw new Error(`Git unstage failed: ${result.error}`);
        }

        GitLogger.info(`Unstaged: ${pathList.join(', ')}`);
        await this.status();
    }

    /**
     * Create a commit
     */
    async commit(message: string, options?: {
        amend?: boolean;
        allowEmpty?: boolean;
        author?: string;
    }): Promise<Commit> {
        const args = ['commit', '-m', message];

        if (options?.amend) args.push('--amend');
        if (options?.allowEmpty) args.push('--allow-empty');
        if (options?.author) args.push('--author', options.author);
        if (this.config.signCommits) args.push('-S');

        const result = await this.git(...args);
        if (!result.success) {
            throw new Error(`Commit failed: ${result.error}`);
        }

        GitLogger.info(`Committed: ${message}`);

        // Get the new commit
        const log = await this.log(1);
        await this.status();

        return log[0];
    }

    /**
     * Discard changes in working directory
     */
    async discard(paths: string | string[]): Promise<void> {
        const pathList = Array.isArray(paths) ? paths : [paths];
        const result = await this.git('checkout', '--', ...pathList);

        if (!result.success) {
            throw new Error(`Discard failed: ${result.error}`);
        }

        GitLogger.info(`Discarded: ${pathList.join(', ')}`);
        await this.status();
    }

    // ========================================================================
    // Remote Operations
    // ========================================================================

    /**
     * Get remotes
     */
    async remotes(): Promise<Remote[]> {
        const result = await this.git('remote', '-v');

        if (!result.success) {
            throw new Error(`Git remote failed: ${result.error}`);
        }

        const remotes = this.parseRemotes(result.output);

        const $$ = this.fx.proxy();
        $$('tools.git.remotes').val(remotes);

        return remotes;
    }

    private parseRemotes(output: string): Remote[] {
        const lines = output.split('\n').filter(l => l);
        const remoteMap = new Map<string, Remote>();

        for (const line of lines) {
            const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
            if (match) {
                const [, name, url, type] = match;
                if (!remoteMap.has(name)) {
                    remoteMap.set(name, { name, fetchUrl: '', pushUrl: '' });
                }
                const remote = remoteMap.get(name)!;
                if (type === 'fetch') remote.fetchUrl = url;
                if (type === 'push') remote.pushUrl = url;
            }
        }

        return Array.from(remoteMap.values());
    }

    /**
     * Fetch from remote
     */
    async fetch(remote?: string, prune: boolean = true): Promise<void> {
        const args = ['fetch', remote || this.config.defaultRemote!];
        if (prune) args.push('--prune');

        const result = await this.git(...args);
        if (!result.success) {
            throw new Error(`Fetch failed: ${result.error}`);
        }

        GitLogger.info(`Fetched from ${remote || this.config.defaultRemote}`);
        await this.status();
    }

    /**
     * Pull from remote
     */
    async pull(remote?: string, branch?: string): Promise<void> {
        const args = ['pull'];
        if (remote) args.push(remote);
        if (branch) args.push(branch);

        const result = await this.git(...args);
        if (!result.success) {
            throw new Error(`Pull failed: ${result.error}`);
        }

        GitLogger.info('Pulled latest changes');
        await this.status();
        await this.log();
    }

    /**
     * Push to remote
     */
    async push(remote?: string, branch?: string, options?: {
        force?: boolean;
        setUpstream?: boolean;
        tags?: boolean;
    }): Promise<void> {
        const args = ['push'];

        if (options?.force) args.push('--force-with-lease');
        if (options?.setUpstream) args.push('-u');
        if (options?.tags) args.push('--tags');

        args.push(remote || this.config.defaultRemote!);
        if (branch) args.push(branch);

        const result = await this.git(...args);
        if (!result.success) {
            throw new Error(`Push failed: ${result.error}`);
        }

        GitLogger.info('Pushed to remote');
        await this.status();
    }

    // ========================================================================
    // Diff Operations
    // ========================================================================

    /**
     * Get diff for a file
     */
    async diff(path?: string, staged: boolean = false): Promise<FileDiff[]> {
        const args = ['diff'];
        if (staged) args.push('--cached');
        if (path) args.push('--', path);

        const result = await this.git(...args);
        if (!result.success) {
            throw new Error(`Diff failed: ${result.error}`);
        }

        return this.parseDiff(result.output);
    }

    private parseDiff(output: string): FileDiff[] {
        const diffs: FileDiff[] = [];
        const fileChunks = output.split(/^diff --git/m).filter(c => c);

        for (const chunk of fileChunks) {
            const lines = chunk.split('\n');
            const pathMatch = lines[0]?.match(/a\/(.+?) b\/(.+)/);

            if (!pathMatch) continue;

            const diff: FileDiff = {
                path: pathMatch[2],
                oldPath: pathMatch[1] !== pathMatch[2] ? pathMatch[1] : undefined,
                hunks: [],
                additions: 0,
                deletions: 0,
                binary: chunk.includes('Binary files')
            };

            if (!diff.binary) {
                const hunkMatches = chunk.matchAll(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/g);
                let lastEnd = 0;

                for (const match of hunkMatches) {
                    const hunkStart = chunk.indexOf(match[0], lastEnd);
                    const nextHunk = chunk.indexOf('@@', hunkStart + match[0].length);
                    const hunkEnd = nextHunk === -1 ? chunk.length : nextHunk;

                    const content = chunk.substring(hunkStart + match[0].length, hunkEnd)
                        .split('\n')
                        .filter(l => l);

                    diff.hunks.push({
                        oldStart: parseInt(match[1]),
                        oldLines: parseInt(match[2]) || 1,
                        newStart: parseInt(match[3]),
                        newLines: parseInt(match[4]) || 1,
                        content
                    });

                    // Count additions/deletions
                    for (const line of content) {
                        if (line.startsWith('+')) diff.additions++;
                        if (line.startsWith('-')) diff.deletions++;
                    }

                    lastEnd = hunkEnd;
                }
            }

            diffs.push(diff);
        }

        return diffs;
    }

    // ========================================================================
    // Stash Operations
    // ========================================================================

    /**
     * List stash entries
     */
    async stashList(): Promise<StashEntry[]> {
        const result = await this.git('stash', 'list', '--format=%gd|%gs|%at');

        if (!result.success) {
            return [];
        }

        const entries = this.parseStashList(result.output);

        const $$ = this.fx.proxy();
        $$('tools.git.stash').val(entries);

        return entries;
    }

    private parseStashList(output: string): StashEntry[] {
        const lines = output.split('\n').filter(l => l);
        return lines.map((line, index) => {
            const [ref, message, timestamp] = line.split('|');
            const branchMatch = message?.match(/On (\S+):/);

            return {
                index,
                message: message || '',
                branch: branchMatch?.[1] || 'unknown',
                date: parseInt(timestamp) * 1000
            };
        });
    }

    /**
     * Create a stash
     */
    async stash(message?: string, includeUntracked: boolean = true): Promise<void> {
        const args = ['stash', 'push'];
        if (message) args.push('-m', message);
        if (includeUntracked) args.push('-u');

        const result = await this.git(...args);
        if (!result.success) {
            throw new Error(`Stash failed: ${result.error}`);
        }

        GitLogger.info('Created stash');
        await this.stashList();
        await this.status();
    }

    /**
     * Apply a stash
     */
    async stashApply(index: number = 0, drop: boolean = false): Promise<void> {
        const command = drop ? 'pop' : 'apply';
        const result = await this.git('stash', command, `stash@{${index}}`);

        if (!result.success) {
            throw new Error(`Stash ${command} failed: ${result.error}`);
        }

        GitLogger.info(`Applied stash ${index}`);
        await this.stashList();
        await this.status();
    }

    /**
     * Drop a stash
     */
    async stashDrop(index: number = 0): Promise<void> {
        const result = await this.git('stash', 'drop', `stash@{${index}}`);

        if (!result.success) {
            throw new Error(`Stash drop failed: ${result.error}`);
        }

        GitLogger.info(`Dropped stash ${index}`);
        await this.stashList();
    }

    // ========================================================================
    // Utilities
    // ========================================================================

    /**
     * Execute a git command
     */
    private async git(...args: string[]): Promise<CommandResult> {
        return this.commandQueue.execute('git', args);
    }

    /**
     * Get the current branch name
     */
    async currentBranch(): Promise<string> {
        const result = await this.git('rev-parse', '--abbrev-ref', 'HEAD');
        return result.success ? result.output.trim() : 'unknown';
    }

    /**
     * Check if path is in a git repository
     */
    async isRepo(): Promise<boolean> {
        const result = await this.git('rev-parse', '--is-inside-work-tree');
        return result.success && result.output.trim() === 'true';
    }

    /**
     * Get repository root
     */
    async repoRoot(): Promise<string> {
        const result = await this.git('rev-parse', '--show-toplevel');
        return result.success ? result.output.trim() : '';
    }

    /**
     * Clean up resources
     */
    dispose(): void {
        if (this.fetchInterval) {
            clearInterval(this.fetchInterval as number);
            this.fetchInterval = null;
        }
        GitLogger.info('FX Git Ops disposed');
    }
}

// ============================================================================
// Plugin Export
// ============================================================================

export default function(fx: FXCore, config: GitOpsConfig = {}): FXGitOps {
    return new FXGitOps(fx, config);
}
