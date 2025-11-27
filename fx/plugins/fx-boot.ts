// /fx-boot.ts
/**
 * FX Boot Loader - Enhanced TypeScript version
 * Handles early initialization, event buffering, and performance monitoring
 */

interface FXConfig {
    corePlugins: string[];
    autoPreload: boolean;
    cacheEnabled: boolean;
    cacheTTL: number;
    moduleBasePath: string;
    ready: {
        waitForDOM: boolean;
        waitForCorePlugins: boolean;
        timeout: number;
    };
    performance?: {
        enabled: boolean;
        sampleRate: number;
    };
}

interface BufferedEvent {
    type: string;
    event?: Event;
    target?: EventTarget;
    args?: any[];
    timestamp: number;
    duration?: number;
}

interface FXPlaceholder {
    _isFXPlaceholder: true;
    _resolved: boolean;
    _value: any;
    _callbacks: ((value: any) => void)[];
}

class FXBootLogger {
    private static logBuffer: Array<{ level: string; message: string; data: any; timestamp: number }> = [];
    private static maxBufferSize = 100;

    static log(level: string, message: string, data: any = {}): void {
        const entry = { level: level.toUpperCase(), message, data, timestamp: Date.now() };
        this.logBuffer.push(entry);
        if (this.logBuffer.length > this.maxBufferSize) {
            this.logBuffer.shift();
        }
        console.log(`[FX-BOOT:${entry.level}]`, message, data);
    }

    static error(message: string, error: any): void { this.log('error', message, { error }); }
    static warn(message: string, data?: any): void { this.log('warn', message, data); }
    static info(message: string, data?: any): void { this.log('info', message, data); }
    static debug(message: string, data?: any): void { this.log('debug', message, data); }

    static getLogBuffer(): typeof FXBootLogger.logBuffer {
        return [...this.logBuffer];
    }
}

export class FXBootLoader {
    private isReady: boolean = false;
    private eventBuffer: BufferedEvent[] = [];
    private domEventBuffer: BufferedEvent[] = [];
    private pendingModules: string[] = [];
    private readyCallbacks: Array<() => void> = [];
    private config: FXConfig;
    private corePluginsReady?: () => void;
    private performanceMarks: Map<string, number> = new Map();
    private originalFX: any = null;
    private eventListeners: Map<string, EventListenerOrEventListenerObject[]> = new Map();

    constructor() {
        this.config = this.loadConfig();
        this.markPerformance('boot-start');
        
        this.setupEventBuffering();
        this.setupReadyState();
        this.preloadCorePlugins();
        this.setupPerformanceMonitoring();
        
        FXBootLogger.info('FX Boot Loader initialized', {
            config: this.config,
            performance: performance.now()
        });
    }

    private loadConfig(): FXConfig {
        // Check for config in script tag
        const configScript = document.querySelector<HTMLScriptElement>('script[type="fx-config"]');
        if (configScript?.textContent) {
            try {
                return JSON.parse(configScript.textContent);
            } catch (e) {
                FXBootLogger.error('Invalid FX config JSON', e);
            }
        }

        // Check for config in meta tag
        const configMeta = document.querySelector<HTMLMetaElement>('meta[name="fx-config"]');
        if (configMeta?.content) {
            try {
                return JSON.parse(configMeta.content);
            } catch (e) {
                FXBootLogger.error('Invalid FX config in meta tag', e);
            }
        }

        // Default config
        return {
            corePlugins: [
                'router@/plugins/fx-router.js',
                'dom@/plugins/fx-dom-enhanced.js',
                'cache@/plugins/fx-cache.js',
                'modules@/plugins/fx-modules.js',
                'scout@/plugins/fx-scout.js'
            ],
            autoPreload: true,
            cacheEnabled: true,
            cacheTTL: 24 * 60 * 60 * 1000,
            moduleBasePath: '/plugins',
            ready: {
                waitForDOM: true,
                waitForCorePlugins: true,
                timeout: 10000
            },
            performance: {
                enabled: true,
                sampleRate: 1.0
            }
        };
    }

    private setupEventBuffering(): void {
        const eventsToBuffer = [
            'click', 'input', 'change', 'submit', 
            'focus', 'blur', 'keydown', 'keyup',
            'touchstart', 'touchend', 'scroll'
        ];
        
        eventsToBuffer.forEach(eventType => {
            const handler = (event: Event) => {
                if (!this.isReady) {
                    const bufferedEvent: BufferedEvent = {
                        type: eventType,
                        event: event,
                        target: event.target!,
                        timestamp: Date.now()
                    };
                    
                    this.domEventBuffer.push(bufferedEvent);
                    
                    // Prevent default for forms and links until ready
                    if (eventType === 'submit' || (eventType === 'click' && (event.target as HTMLElement)?.tagName === 'A')) {
                        event.preventDefault();
                        FXBootLogger.debug(`Buffered ${eventType} until FX ready`, { target: event.target });
                    }
                }
            };
            
            document.addEventListener(eventType, handler, true);
            
            // Store for cleanup
            if (!this.eventListeners.has(eventType)) {
                this.eventListeners.set(eventType, []);
            }
            this.eventListeners.get(eventType)!.push(handler);
        });

        // Intercept FX calls
        if (typeof globalThis !== 'undefined') {
            this.originalFX = (globalThis as any).$$;
            (globalThis as any).$$ = (...args: any[]) => {
                if (!this.isReady) {
                    const bufferedCall: BufferedEvent = {
                        type: 'fx-call',
                        args: args,
                        timestamp: Date.now()
                    };
                    this.eventBuffer.push(bufferedCall);
                    return this.createPlaceholder();
                }
                return this.originalFX?.(...args);
            };
        }
    }

    private createPlaceholder(): FXPlaceholder {
        const placeholder: FXPlaceholder = {
            _isFXPlaceholder: true,
            _resolved: false,
            _value: null,
            _callbacks: []
        };

        return new Proxy(placeholder, {
            get(target, prop) {
                if (prop === 'then') {
                    return (resolve: (value: any) => void) => {
                        if (target._resolved) {
                            resolve(target._value);
                        } else {
                            target._callbacks.push(resolve);
                        }
                    };
                }
                return target[prop as keyof FXPlaceholder];
            }
        }) as FXPlaceholder;
    }

    private setupReadyState(): void {
        const readyChecks: Promise<void>[] = [];

        if (this.config.ready.waitForDOM) {
            readyChecks.push(this.waitForDOM());
        }

        if (this.config.ready.waitForCorePlugins) {
            readyChecks.push(this.waitForCorePlugins());
        }

        const timeoutPromise = new Promise<void>((_, reject) => {
            setTimeout(() => reject(new Error('FX ready timeout')), this.config.ready.timeout);
        });

        Promise.race([
            Promise.all(readyChecks),
            timeoutPromise
        ]).then(() => {
            this.markReady();
        }).catch((error) => {
            FXBootLogger.error('FX ready failed', error);
            this.markReady(); // Mark ready anyway to prevent hanging
        });
    }

    private waitForDOM(): Promise<void> {
        return new Promise((resolve) => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
            } else {
                resolve();
            }
        });
    }

    private waitForCorePlugins(): Promise<void> {
        return new Promise((resolve) => {
            this.corePluginsReady = resolve;
        });
    }

    private async preloadCorePlugins(): Promise<void> {
        if (!this.config.autoPreload || !this.config.corePlugins.length) {
            this.corePluginsReady?.();
            return;
        }

        try {
            FXBootLogger.info('Preloading core plugins', { plugins: this.config.corePlugins });
            
            // Store plugins for later loading
            this.pendingModules = [...this.config.corePlugins];
            
            // Preload plugin files
            await this.preloadResources(this.config.corePlugins);
            
            this.corePluginsReady?.();
        } catch (error) {
            FXBootLogger.error('Failed to preload core plugins', error);
            this.corePluginsReady?.();
        }
    }

    private async preloadResources(plugins: string[]): Promise<void> {
        const preloadPromises = plugins.map(plugin => {
            const [, path] = plugin.split('@');
            if (!path) return Promise.resolve();
            
            return new Promise<void>((resolve) => {
                const link = document.createElement('link');
                link.rel = 'preload';
                link.as = 'script';
                link.href = path;
                link.onload = () => resolve();
                link.onerror = () => {
                    FXBootLogger.warn(`Failed to preload ${path}`);
                    resolve();
                };
                document.head.appendChild(link);
            });
        });
        
        await Promise.all(preloadPromises);
    }

    private setupPerformanceMonitoring(): void {
        if (!this.config.performance?.enabled) return;
        
        // Monitor long tasks
        if ('PerformanceObserver' in window) {
            try {
                const observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.duration > 50) { // Long task threshold
                            FXBootLogger.warn('Long task detected', {
                                duration: entry.duration,
                                startTime: entry.startTime
                            });
                        }
                    }
                });
                observer.observe({ entryTypes: ['longtask'] });
            } catch (e) {
                // Long task observer not supported
            }
        }
    }

    private markPerformance(mark: string): void {
        if (!this.config.performance?.enabled) return;
        
        const now = performance.now();
        this.performanceMarks.set(mark, now);
        
        if (performance.mark) {
            performance.mark(`fx-boot:${mark}`);
        }
    }

    private markReady(): void {
        this.isReady = true;
        this.markPerformance('boot-ready');
        
        const bootTime = (this.performanceMarks.get('boot-ready') || 0) - 
                        (this.performanceMarks.get('boot-start') || 0);
        
        FXBootLogger.info('FX is ready!', {
            bootTime: `${bootTime.toFixed(2)}ms`,
            eventBuffer: this.eventBuffer.length,
            domEventBuffer: this.domEventBuffer.length,
            pendingModules: this.pendingModules.length
        });

        // Process ready callbacks
        this.readyCallbacks.forEach(callback => {
            try {
                callback();
            } catch (error) {
                FXBootLogger.error('Ready callback error', error);
            }
        });

        // Emit ready event
        document.dispatchEvent(new CustomEvent('fx:ready', {
            detail: {
                eventBuffer: this.eventBuffer,
                domEventBuffer: this.domEventBuffer,
                pendingModules: this.pendingModules,
                bootTime,
                performanceMarks: Object.fromEntries(this.performanceMarks)
            }
        }));

        // Restore original FX if it was intercepted
        if (this.originalFX && typeof globalThis !== 'undefined') {
            (globalThis as any).$$ = this.originalFX;
        }
    }

    ready(callback: () => void): this {
        if (this.isReady) {
            callback();
        } else {
            this.readyCallbacks.push(callback);
        }
        return this;
    }

    replayBufferedEvents(): void {
        FXBootLogger.info('Replaying buffered events');

        // Replay FX calls
        this.eventBuffer.forEach(bufferedCall => {
            try {
                if (bufferedCall.type === 'fx-call' && typeof (globalThis as any).$$ === 'function') {
                    (globalThis as any).$$(...(bufferedCall.args || []));
                }
            } catch (error) {
                FXBootLogger.error('Error replaying FX call', error);
            }
        });

        // Replay DOM events
        this.domEventBuffer.forEach(bufferedEvent => {
            try {
                if (bufferedEvent.type === 'submit' && bufferedEvent.target) {
                    const form = (bufferedEvent.target as HTMLElement).closest('form');
                    if (form) {
                        const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                        form.dispatchEvent(submitEvent);
                    }
                } else if (bufferedEvent.type === 'click' && bufferedEvent.target) {
                    (bufferedEvent.target as HTMLElement).click();
                }
            } catch (error) {
                FXBootLogger.error('Error replaying DOM event', error);
            }
        });

        // Clear buffers
        this.eventBuffer = [];
        this.domEventBuffer = [];
    }

    getPendingModules(): string[] {
        return [...this.pendingModules];
    }

    getConfig(): FXConfig {
        return { ...this.config };
    }

    getPerformanceMetrics(): Record<string, any> {
        return {
            marks: Object.fromEntries(this.performanceMarks),
            bootTime: (this.performanceMarks.get('boot-ready') || 0) - 
                     (this.performanceMarks.get('boot-start') || 0),
            bufferedEvents: this.eventBuffer.length + this.domEventBuffer.length,
            logs: FXBootLogger.getLogBuffer()
        };
    }

    destroy(): void {
        // Clean up event listeners
        this.eventListeners.forEach((handlers, eventType) => {
            handlers.forEach(handler => {
                document.removeEventListener(eventType, handler, true);
            });
        });
        this.eventListeners.clear();
        
        // Clear buffers
        this.eventBuffer = [];
        this.domEventBuffer = [];
        this.readyCallbacks = [];
        
        FXBootLogger.info('FX Boot Loader destroyed');
    }
}

// Create and expose singleton
const fxBoot = new FXBootLoader();

// Expose globally
declare global {
    interface Window {
        fxBoot: FXBootLoader;
        fxReady: (callback: () => void) => FXBootLoader;
    }
}

if (typeof window !== 'undefined') {
    window.fxBoot = fxBoot;
    window.fxReady = (callback: () => void) => fxBoot.ready(callback);
}

// Listen for FX core
document.addEventListener('fx:core-loaded', () => {
    fxBoot.replayBufferedEvents();
});

// Monitor initial load
document.addEventListener('DOMContentLoaded', () => {
    const fxScript = document.querySelector('script[src*="fx.js"], script[src*="fx.ts"]');
    if (!fxScript) {
        FXBootLogger.warn('FX core script not found');
    }
});

export default fxBoot;