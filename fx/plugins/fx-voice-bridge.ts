// /plugins/fx-voice-bridge.ts
/**
 * @fx-plugin fx-voice-bridge
 * @fx-global $voice
 * @fx-description Voice command processing and speech recognition
 * @fx-dependencies
 * @fx-provides $voice
 * @fx-version 1.0.0
 *
 * FX Voice Bridge Plugin - Provides voice command recognition, speech synthesis,
 * and accessibility features for hands-free IDE interaction.
 */

import type { FXCore, FXNodeProxy } from '../fx.v4';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface VoiceCommand {
    id: string;
    patterns: string[]; // Regex patterns
    action: string; // Action identifier
    description: string;
    category: string;
    enabled: boolean;
}

export interface RecognitionResult {
    transcript: string;
    confidence: number;
    isFinal: boolean;
    timestamp: number;
}

export interface CommandMatch {
    command: VoiceCommand;
    transcript: string;
    confidence: number;
    parameters: Record<string, string>;
}

export interface SpeechOptions {
    voice?: string;
    rate?: number;
    pitch?: number;
    volume?: number;
    language?: string;
}

export interface VoiceBridgeConfig {
    language?: string;
    continuous?: boolean;
    interimResults?: boolean;
    wakeWord?: string;
    commandTimeout?: number;
    minConfidence?: number;
    enableSpeech?: boolean;
}

export type VoiceEventType =
    | 'start'
    | 'end'
    | 'result'
    | 'command'
    | 'error'
    | 'speechStart'
    | 'speechEnd';

// ============================================================================
// Built-in Commands
// ============================================================================

const BUILTIN_COMMANDS: VoiceCommand[] = [
    // File operations
    {
        id: 'file-new',
        patterns: ['(create|new) file (.+)', 'new (.+) file'],
        action: 'file.new',
        description: 'Create a new file',
        category: 'file',
        enabled: true
    },
    {
        id: 'file-open',
        patterns: ['open file (.+)', 'open (.+)'],
        action: 'file.open',
        description: 'Open a file',
        category: 'file',
        enabled: true
    },
    {
        id: 'file-save',
        patterns: ['save( file)?', 'save (this|current)'],
        action: 'file.save',
        description: 'Save current file',
        category: 'file',
        enabled: true
    },
    {
        id: 'file-close',
        patterns: ['close( file)?', 'close (this|current)'],
        action: 'file.close',
        description: 'Close current file',
        category: 'file',
        enabled: true
    },

    // Navigation
    {
        id: 'nav-goto-line',
        patterns: ['go to line (\\d+)', 'line (\\d+)'],
        action: 'nav.gotoLine',
        description: 'Go to line number',
        category: 'navigation',
        enabled: true
    },
    {
        id: 'nav-goto-definition',
        patterns: ['go to definition', 'definition'],
        action: 'nav.gotoDefinition',
        description: 'Go to symbol definition',
        category: 'navigation',
        enabled: true
    },
    {
        id: 'nav-find',
        patterns: ['find (.+)', 'search for (.+)'],
        action: 'nav.find',
        description: 'Search in file',
        category: 'navigation',
        enabled: true
    },

    // Editing
    {
        id: 'edit-undo',
        patterns: ['undo', 'undo (that|last)'],
        action: 'edit.undo',
        description: 'Undo last action',
        category: 'edit',
        enabled: true
    },
    {
        id: 'edit-redo',
        patterns: ['redo', 'redo (that|last)'],
        action: 'edit.redo',
        description: 'Redo last action',
        category: 'edit',
        enabled: true
    },
    {
        id: 'edit-copy',
        patterns: ['copy', 'copy (that|this|selection)'],
        action: 'edit.copy',
        description: 'Copy selection',
        category: 'edit',
        enabled: true
    },
    {
        id: 'edit-paste',
        patterns: ['paste', 'paste (that|here)'],
        action: 'edit.paste',
        description: 'Paste clipboard',
        category: 'edit',
        enabled: true
    },
    {
        id: 'edit-cut',
        patterns: ['cut', 'cut (that|this|selection)'],
        action: 'edit.cut',
        description: 'Cut selection',
        category: 'edit',
        enabled: true
    },
    {
        id: 'edit-delete-line',
        patterns: ['delete (this )?line', 'remove (this )?line'],
        action: 'edit.deleteLine',
        description: 'Delete current line',
        category: 'edit',
        enabled: true
    },

    // View
    {
        id: 'view-sidebar',
        patterns: ['(show|hide|toggle) sidebar'],
        action: 'view.toggleSidebar',
        description: 'Toggle sidebar',
        category: 'view',
        enabled: true
    },
    {
        id: 'view-terminal',
        patterns: ['(show|hide|toggle|open) terminal'],
        action: 'view.toggleTerminal',
        description: 'Toggle terminal',
        category: 'view',
        enabled: true
    },
    {
        id: 'view-zoom-in',
        patterns: ['zoom in', 'increase (font|text) size'],
        action: 'view.zoomIn',
        description: 'Zoom in',
        category: 'view',
        enabled: true
    },
    {
        id: 'view-zoom-out',
        patterns: ['zoom out', 'decrease (font|text) size'],
        action: 'view.zoomOut',
        description: 'Zoom out',
        category: 'view',
        enabled: true
    },

    // Run/Debug
    {
        id: 'run-start',
        patterns: ['run', 'start', 'run (app|application|project)'],
        action: 'run.start',
        description: 'Run application',
        category: 'run',
        enabled: true
    },
    {
        id: 'run-stop',
        patterns: ['stop', 'stop (app|application|running)'],
        action: 'run.stop',
        description: 'Stop application',
        category: 'run',
        enabled: true
    },
    {
        id: 'run-debug',
        patterns: ['debug', 'start debug(ging)?'],
        action: 'run.debug',
        description: 'Start debugging',
        category: 'run',
        enabled: true
    },

    // Git
    {
        id: 'git-commit',
        patterns: ['commit', 'git commit', 'commit changes'],
        action: 'git.commit',
        description: 'Commit changes',
        category: 'git',
        enabled: true
    },
    {
        id: 'git-push',
        patterns: ['push', 'git push', 'push changes'],
        action: 'git.push',
        description: 'Push to remote',
        category: 'git',
        enabled: true
    },
    {
        id: 'git-pull',
        patterns: ['pull', 'git pull', 'pull changes'],
        action: 'git.pull',
        description: 'Pull from remote',
        category: 'git',
        enabled: true
    },

    // AI
    {
        id: 'ai-chat',
        patterns: ['(hey |ok )?ai (.+)', 'ask ai (.+)'],
        action: 'ai.chat',
        description: 'Send message to AI',
        category: 'ai',
        enabled: true
    },
    {
        id: 'ai-explain',
        patterns: ['explain (this|that|code|selection)'],
        action: 'ai.explain',
        description: 'Ask AI to explain code',
        category: 'ai',
        enabled: true
    },
    {
        id: 'ai-fix',
        patterns: ['fix (this|that|error|bug)'],
        action: 'ai.fix',
        description: 'Ask AI to fix issue',
        category: 'ai',
        enabled: true
    }
];

// ============================================================================
// Logger
// ============================================================================

class VoiceLogger {
    static log(level: string, message: string, data?: any): void {
        console.log(`[FX-VOICE:${level.toUpperCase()}]`, message, data ?? '');
    }
    static info(message: string, data?: any): void { this.log('info', message, data); }
    static warn(message: string, data?: any): void { this.log('warn', message, data); }
    static error(message: string, data?: any): void { this.log('error', message, data); }
    static debug(message: string, data?: any): void { this.log('debug', message, data); }
}

// ============================================================================
// Voice Bridge Plugin Class
// ============================================================================

export class FXVoiceBridge {
    public readonly name = 'voice-bridge';
    public readonly version = '1.0.0';
    public readonly description = 'Voice command processing and speech recognition';

    private fx: FXCore;
    private config: VoiceBridgeConfig;

    private recognition: any = null; // SpeechRecognition
    private synthesis: SpeechSynthesis | null = null;
    private voices: SpeechSynthesisVoice[] = [];

    private commands = new Map<string, VoiceCommand>();
    private listeners = new Map<VoiceEventType, Set<Function>>();
    private isListening = false;
    private isAwake = false;
    private wakeTimeout: NodeJS.Timeout | number | null = null;

    constructor(fx: FXCore, config: VoiceBridgeConfig = {}) {
        this.fx = fx;
        this.config = {
            language: 'en-US',
            continuous: true,
            interimResults: true,
            wakeWord: 'hey fx',
            commandTimeout: 5000,
            minConfidence: 0.6,
            enableSpeech: true,
            ...config
        };

        this.initNodes();
        this.loadBuiltinCommands();
        this.initRecognition();
        this.initSynthesis();

        VoiceLogger.info('FX Voice Bridge initialized');
    }

    // ========================================================================
    // Initialization
    // ========================================================================

    private initNodes(): void {
        const $$ = this.fx.proxy();

        $$('voice.status').val('idle');
        $$('voice.isListening').val(false);
        $$('voice.isAwake').val(false);
        $$('voice.lastTranscript').val('');
        $$('voice.commands').val({});
        $$('voice.history').val([]);
        $$('voice.stats').val({
            commandsExecuted: 0,
            recognitionErrors: 0,
            totalSessions: 0
        });
    }

    private loadBuiltinCommands(): void {
        for (const cmd of BUILTIN_COMMANDS) {
            this.commands.set(cmd.id, cmd);
        }
        this.updateCommandList();
    }

    private initRecognition(): void {
        const SpeechRecognition = (globalThis as any).SpeechRecognition ||
            (globalThis as any).webkitSpeechRecognition;

        if (!SpeechRecognition) {
            VoiceLogger.warn('Speech recognition not available');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.lang = this.config.language;
        this.recognition.continuous = this.config.continuous;
        this.recognition.interimResults = this.config.interimResults;

        this.recognition.onstart = () => {
            VoiceLogger.info('Recognition started');
            this.emit('start', {});
            this.updateStatus('listening');
        };

        this.recognition.onend = () => {
            VoiceLogger.info('Recognition ended');
            this.emit('end', {});
            this.updateStatus('idle');

            // Restart if continuous
            if (this.isListening && this.config.continuous) {
                setTimeout(() => {
                    if (this.isListening) {
                        this.recognition?.start();
                    }
                }, 100);
            }
        };

        this.recognition.onresult = (event: any) => {
            this.handleRecognitionResult(event);
        };

        this.recognition.onerror = (event: any) => {
            VoiceLogger.error('Recognition error', event.error);
            this.emit('error', { error: event.error });

            const $$ = this.fx.proxy();
            const stats = $$('voice.stats').val();
            $$('voice.stats').val({ ...stats, recognitionErrors: stats.recognitionErrors + 1 });
        };
    }

    private initSynthesis(): void {
        if (!this.config.enableSpeech) return;

        if ('speechSynthesis' in globalThis) {
            this.synthesis = globalThis.speechSynthesis;

            // Load voices
            const loadVoices = () => {
                this.voices = this.synthesis?.getVoices() || [];
                VoiceLogger.debug(`Loaded ${this.voices.length} voices`);
            };

            loadVoices();
            this.synthesis.onvoiceschanged = loadVoices;
        } else {
            VoiceLogger.warn('Speech synthesis not available');
        }
    }

    // ========================================================================
    // Recognition Control
    // ========================================================================

    /**
     * Start listening for voice commands
     */
    start(): void {
        if (!this.recognition) {
            throw new Error('Speech recognition not available');
        }

        if (this.isListening) return;

        this.isListening = true;
        this.recognition.start();

        const $$ = this.fx.proxy();
        $$('voice.isListening').val(true);

        const stats = $$('voice.stats').val();
        $$('voice.stats').val({ ...stats, totalSessions: stats.totalSessions + 1 });

        VoiceLogger.info('Voice listening started');
    }

    /**
     * Stop listening
     */
    stop(): void {
        if (!this.isListening) return;

        this.isListening = false;
        this.isAwake = false;
        this.recognition?.stop();

        const $$ = this.fx.proxy();
        $$('voice.isListening').val(false);
        $$('voice.isAwake').val(false);

        VoiceLogger.info('Voice listening stopped');
    }

    /**
     * Check if currently listening
     */
    getIsListening(): boolean {
        return this.isListening;
    }

    // ========================================================================
    // Result Handling
    // ========================================================================

    private handleRecognitionResult(event: any): void {
        const results = event.results;
        const latestResult = results[results.length - 1];
        const transcript = latestResult[0].transcript.toLowerCase().trim();
        const confidence = latestResult[0].confidence;
        const isFinal = latestResult.isFinal;

        const result: RecognitionResult = {
            transcript,
            confidence,
            isFinal,
            timestamp: Date.now()
        };

        this.emit('result', result);

        const $$ = this.fx.proxy();
        $$('voice.lastTranscript').val(transcript);

        if (!isFinal) return;

        // Check for wake word
        if (this.config.wakeWord && !this.isAwake) {
            if (transcript.includes(this.config.wakeWord.toLowerCase())) {
                this.wake();
                const afterWake = transcript.substring(
                    transcript.indexOf(this.config.wakeWord.toLowerCase()) +
                    this.config.wakeWord.length
                ).trim();

                if (afterWake) {
                    this.processCommand(afterWake, confidence);
                }
            }
            return;
        }

        // Process as command if awake or no wake word
        if (this.isAwake || !this.config.wakeWord) {
            this.processCommand(transcript, confidence);
        }
    }

    private wake(): void {
        this.isAwake = true;

        const $$ = this.fx.proxy();
        $$('voice.isAwake').val(true);
        this.updateStatus('awake');

        // Play acknowledgment
        this.speak('Yes?', { rate: 1.2 });

        // Set timeout
        if (this.wakeTimeout) {
            clearTimeout(this.wakeTimeout as number);
        }

        this.wakeTimeout = setTimeout(() => {
            this.isAwake = false;
            $$('voice.isAwake').val(false);
            this.updateStatus('listening');
        }, this.config.commandTimeout);
    }

    private processCommand(transcript: string, confidence: number): void {
        if (confidence < this.config.minConfidence!) {
            VoiceLogger.debug(`Low confidence: ${confidence}`);
            return;
        }

        const match = this.matchCommand(transcript);

        if (match) {
            VoiceLogger.info(`Command matched: ${match.command.action}`, match.parameters);

            this.emit('command', match);
            this.logCommand(match);

            // Reset wake timeout
            if (this.wakeTimeout) {
                clearTimeout(this.wakeTimeout as number);
                this.wakeTimeout = setTimeout(() => {
                    this.isAwake = false;
                    const $$ = this.fx.proxy();
                    $$('voice.isAwake').val(false);
                }, this.config.commandTimeout);
            }
        } else {
            VoiceLogger.debug(`No command matched: ${transcript}`);
        }
    }

    private matchCommand(transcript: string): CommandMatch | null {
        for (const command of this.commands.values()) {
            if (!command.enabled) continue;

            for (const pattern of command.patterns) {
                const regex = new RegExp(`^${pattern}$`, 'i');
                const match = transcript.match(regex);

                if (match) {
                    // Extract parameters from capture groups
                    const parameters: Record<string, string> = {};
                    for (let i = 1; i < match.length; i++) {
                        parameters[`param${i}`] = match[i];
                    }

                    return {
                        command,
                        transcript,
                        confidence: 1,
                        parameters
                    };
                }
            }
        }

        return null;
    }

    // ========================================================================
    // Speech Synthesis
    // ========================================================================

    /**
     * Speak text
     */
    speak(text: string, options: SpeechOptions = {}): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.synthesis) {
                reject(new Error('Speech synthesis not available'));
                return;
            }

            const utterance = new SpeechSynthesisUtterance(text);

            // Find voice
            if (options.voice) {
                const voice = this.voices.find(v => v.name === options.voice);
                if (voice) utterance.voice = voice;
            }

            utterance.rate = options.rate ?? 1;
            utterance.pitch = options.pitch ?? 1;
            utterance.volume = options.volume ?? 1;
            utterance.lang = options.language ?? this.config.language!;

            utterance.onstart = () => {
                this.emit('speechStart', { text });
            };

            utterance.onend = () => {
                this.emit('speechEnd', { text });
                resolve();
            };

            utterance.onerror = (e) => {
                reject(e);
            };

            this.synthesis.speak(utterance);
        });
    }

    /**
     * Stop speaking
     */
    stopSpeaking(): void {
        this.synthesis?.cancel();
    }

    /**
     * Get available voices
     */
    getVoices(): SpeechSynthesisVoice[] {
        return this.voices;
    }

    // ========================================================================
    // Command Management
    // ========================================================================

    /**
     * Register a command
     */
    registerCommand(command: Omit<VoiceCommand, 'id'>): VoiceCommand {
        const id = `cmd-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const newCommand: VoiceCommand = { ...command, id };

        this.commands.set(id, newCommand);
        this.updateCommandList();

        VoiceLogger.info(`Command registered: ${command.action}`);

        return newCommand;
    }

    /**
     * Unregister a command
     */
    unregisterCommand(id: string): void {
        this.commands.delete(id);
        this.updateCommandList();
    }

    /**
     * Enable/disable a command
     */
    setCommandEnabled(id: string, enabled: boolean): void {
        const command = this.commands.get(id);
        if (command) {
            command.enabled = enabled;
            this.updateCommandList();
        }
    }

    /**
     * Get all commands
     */
    getCommands(): VoiceCommand[] {
        return Array.from(this.commands.values());
    }

    /**
     * Get commands by category
     */
    getCommandsByCategory(category: string): VoiceCommand[] {
        return this.getCommands().filter(c => c.category === category);
    }

    // ========================================================================
    // Event System
    // ========================================================================

    /**
     * Subscribe to events
     */
    on(event: VoiceEventType, callback: Function): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);

        return () => this.off(event, callback);
    }

    /**
     * Unsubscribe from events
     */
    off(event: VoiceEventType, callback: Function): void {
        this.listeners.get(event)?.delete(callback);
    }

    private emit(event: VoiceEventType, data: any): void {
        const listeners = this.listeners.get(event);
        if (listeners) {
            for (const listener of listeners) {
                try {
                    listener(data);
                } catch (e) {
                    VoiceLogger.error(`Event listener error: ${event}`, e);
                }
            }
        }
    }

    // ========================================================================
    // Utilities
    // ========================================================================

    private updateStatus(status: string): void {
        const $$ = this.fx.proxy();
        $$('voice.status').val(status);
    }

    private updateCommandList(): void {
        const $$ = this.fx.proxy();
        const commandList: Record<string, any> = {};

        for (const [id, cmd] of this.commands) {
            commandList[id] = {
                action: cmd.action,
                description: cmd.description,
                category: cmd.category,
                enabled: cmd.enabled
            };
        }

        $$('voice.commands').val(commandList);
    }

    private logCommand(match: CommandMatch): void {
        const $$ = this.fx.proxy();
        const history = $$('voice.history').val() || [];

        history.unshift({
            action: match.command.action,
            transcript: match.transcript,
            timestamp: Date.now(),
            parameters: match.parameters
        });

        // Keep last 50
        if (history.length > 50) {
            history.pop();
        }

        $$('voice.history').val(history);

        const stats = $$('voice.stats').val();
        $$('voice.stats').val({ ...stats, commandsExecuted: stats.commandsExecuted + 1 });
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.stop();

        if (this.wakeTimeout) {
            clearTimeout(this.wakeTimeout as number);
        }

        this.listeners.clear();
        VoiceLogger.info('FX Voice Bridge disposed');
    }
}

// ============================================================================
// Plugin Export
// ============================================================================

export default function(fx: FXCore, config: VoiceBridgeConfig = {}): FXVoiceBridge {
    return new FXVoiceBridge(fx, config);
}
