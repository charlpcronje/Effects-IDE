// /plugins/fx-devtools-fixed.ts
/**
 * @fx-plugin fx-devtools
 * @fx-global $dev
 * @fx-description Quake-style developer console with remote control and automated testing - NO ASYNC
 * @fx-dependencies $
 * @fx-provides $dev
 * @fx-version 2.0.0
 *
 * FX Developer Tools - Ultimate AI Testing Environment (NO ASYNC VERSION)
 *
 * Features:
 * - Quake-style slide-down console (Ctrl+`)
 * - Slash command system (/command param:value)
 * - Backend-to-frontend remote control via WebSocket
 * - Element watching and monitoring
 * - Automated test script execution
 * - Real-time system introspection
 * - AI-friendly command interface
 * - NO ASYNC/AWAIT - Uses FX_SUSPEND pattern
 */

import type { FXCore as FX, FXNodeProxy } from "../fx.v4";

// Get FXSuspend from global (set by fx.ts)
const FXSuspend = (globalThis as any).FXSuspend;

type FXN = FXNodeProxy<any, any>;

interface DevToolsOptions {
  global?: string;
  hotkey?: string;
  theme?: 'dark' | 'light' | 'matrix';
  enableRemoteControl?: boolean;
  enableElementWatching?: boolean;
  enableAutomatedTesting?: boolean;
  websocketUrl?: string;
}

interface Command {
  name: string;
  description: string;
  syntax: string;
  handler: (params: Record<string, any>) => any;
  examples: string[];
}

interface TestStep {
  action: 'goto' | 'click' | 'type' | 'wait' | 'assert' | 'report';
  target?: string;
  value?: string;
  timeout?: number;
  expected?: any;
}

interface ElementWatcher {
  selector: string;
  property: string;
  callback: (oldValue: any, newValue: any) => void;
  lastValue?: any;
}

/**
 * @class FXDevToolsPlugin
 * @description Ultimate developer console for FX applications - NO ASYNC VERSION
 */
class FXDevToolsPlugin {
  public readonly name = 'fx-devtools';
  public readonly version = '2.0.0';
  public readonly description = 'Quake-style developer console with remote control (NO ASYNC)';

  private fx: FX;
  private options: Required<DevToolsOptions>;
  private console: HTMLElement | null = null;
  private input: HTMLInputElement | null = null;
  private output: HTMLElement | null = null;
  private isVisible = false;
  private commandHistory: string[] = [];
  private historyIndex = -1;
  private commands: Map<string, Command> = new Map();
  private webSocket: WebSocket | null = null;
  private watchers: ElementWatcher[] = [];
  private watcherInterval: number | null = null;
  private pendingCommands: Map<string, any> = new Map();

  constructor(fx: FX, options: DevToolsOptions = {}) {
    this.fx = fx;
    this.options = {
      global: '$dev',
      hotkey: 'ctrl+`',
      theme: 'dark',
      enableRemoteControl: true,
      enableElementWatching: true,
      enableAutomatedTesting: true,
      websocketUrl: 'ws://localhost:4005',
      ...options
    };

    this.initializeConsole();
    this.setupCommands();
    this.setupKeyboardShortcuts();
    this.setupWebSocketRemoteControl();
    this.setupElementWatching();

    console.log('🎮 FX DevTools initialized (NO ASYNC) - Press Ctrl+` for console');
  }

  /**
   * Create Quake-style slide-down console
   */
  private initializeConsole() {
    if (typeof document === 'undefined') return;

    // Create console container
    this.console = document.createElement('div');
    this.console.id = 'fx-dev-console';
    this.console.style.cssText = `
      position: fixed;
      top: -400px;
      left: 0;
      width: 100%;
      height: 400px;
      background: ${this.options.theme === 'matrix' ? 'rgba(0, 20, 0, 0.95)' : 'rgba(0, 0, 0, 0.95)'};
      color: ${this.options.theme === 'matrix' ? '#00ff00' : '#00ff00'};
      font-family: 'Courier New', monospace;
      font-size: 14px;
      z-index: 999999;
      backdrop-filter: blur(10px);
      border-bottom: 2px solid #00ff00;
      transition: top 0.3s ease-out;
      display: flex;
      flex-direction: column;
    `;

    // Create header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 10px;
      background: rgba(0, 50, 0, 0.8);
      border-bottom: 1px solid #00ff00;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    header.innerHTML = `
      <span>🎮 FX Developer Console v${this.version} | ${this.options.theme.toUpperCase()} MODE | NO ASYNC</span>
      <span>Press Ctrl+\` to toggle | Type /help for commands</span>
    `;

    // Create output area
    this.output = document.createElement('div');
    this.output.style.cssText = `
      flex: 1;
      padding: 10px;
      overflow-y: auto;
      white-space: pre-wrap;
      line-height: 1.4;
    `;

    // Create input area
    const inputContainer = document.createElement('div');
    inputContainer.style.cssText = `
      padding: 10px;
      background: rgba(0, 30, 0, 0.8);
      border-top: 1px solid #00ff00;
      display: flex;
      align-items: center;
    `;

    const prompt = document.createElement('span');
    prompt.textContent = 'FX> ';
    prompt.style.color = '#00ff00';
    prompt.style.marginRight = '5px';

    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.style.cssText = `
      flex: 1;
      background: transparent;
      border: none;
      color: #00ff00;
      font-family: inherit;
      font-size: inherit;
      outline: none;
    `;
    this.input.placeholder = 'Enter command (try /help)';

    inputContainer.appendChild(prompt);
    inputContainer.appendChild(this.input);

    this.console.appendChild(header);
    this.console.appendChild(this.output);
    this.console.appendChild(inputContainer);

    document.body.appendChild(this.console);

    // Setup input handling
    this.input.addEventListener('keydown', (e) => this.handleKeyDown(e));

    // Welcome message
    this.log('🎮 FX Developer Console Ready (NO ASYNC VERSION)');
    this.log('⚡ Type /help to see available commands');
    this.log('🔧 Remote control enabled via WebSocket');
    this.log('📊 Element watching active');
    this.log('🚀 Using FX_SUSPEND pattern - no async/await');
    this.log('');
  }

  /**
   * Setup keyboard shortcuts
   */
  private setupKeyboardShortcuts() {
    if (typeof document === 'undefined') return;

    document.addEventListener('keydown', (e) => {
      // Ctrl+` to toggle console
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        this.toggleConsole();
      }

      // Escape to hide console
      if (e.key === 'Escape' && this.isVisible) {
        this.hideConsole();
      }
    });
  }

  /**
   * Toggle console visibility (Quake-style)
   */
  private toggleConsole() {
    if (this.isVisible) {
      this.hideConsole();
    } else {
      this.showConsole();
    }
  }

  private showConsole() {
    if (!this.console) return;

    this.isVisible = true;
    this.console.style.top = '0px';

    setTimeout(() => {
      if (this.input) {
        this.input.focus();
      }
    }, 300);

    this.log('🎮 Console activated');
  }

  private hideConsole() {
    if (!this.console) return;

    this.isVisible = false;
    this.console.style.top = '-400px';
    this.log('🎮 Console hidden');
  }

  /**
   * Handle console input
   */
  private handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      const command = (e.target as HTMLInputElement).value.trim();
      if (command) {
        this.executeCommand(command);
        this.commandHistory.push(command);
        this.historyIndex = this.commandHistory.length;
        (e.target as HTMLInputElement).value = '';
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (this.historyIndex > 0) {
        this.historyIndex--;
        (e.target as HTMLInputElement).value = this.commandHistory[this.historyIndex];
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (this.historyIndex < this.commandHistory.length - 1) {
        this.historyIndex++;
        (e.target as HTMLInputElement).value = this.commandHistory[this.historyIndex];
      } else {
        this.historyIndex = this.commandHistory.length;
        (e.target as HTMLInputElement).value = '';
      }
    }
  }

  /**
   * Execute console command (NO ASYNC - uses FX_SUSPEND)
   */
  private executeCommand(commandLine: string) {
    this.log(`FX> ${commandLine}`, 'input');

    if (!commandLine.startsWith('/')) {
      this.log('❌ Commands must start with / (try /help)', 'error');
      return;
    }

    const parts = commandLine.slice(1).split(' ');
    const commandName = parts[0];
    const params = this.parseCommandParams(parts.slice(1));

    const command = this.commands.get(commandName);
    if (!command) {
      this.log(`❌ Unknown command: ${commandName} (try /help)`, 'error');
      return;
    }

    try {
      const result = command.handler(params);

      // Check if result is a Promise and handle with FX_SUSPEND
      if (result instanceof Promise) {
        // Store command for retry
        const commandId = `${commandName}_${Date.now()}`;
        this.pendingCommands.set(commandId, { command, params });

        // Handle the promise result
        result.then(res => {
          if (res !== undefined) {
            this.log(`✅ ${JSON.stringify(res, null, 2)}`, 'success');
          }
          this.pendingCommands.delete(commandId);
        }).catch(error => {
          this.log(`❌ Command failed: ${error.message}`, 'error');
          this.pendingCommands.delete(commandId);
        });
      } else if (result !== undefined) {
        this.log(`✅ ${JSON.stringify(result, null, 2)}`, 'success');
      }
    } catch (error: any) {
      // Re-throw FX_SUSPEND
      if (error instanceof FXSuspend) {
        // Handle suspended operation
        error.promise.then(() => {
          // Retry the command
          this.executeCommand(commandLine);
        }).catch(err => {
          this.log(`❌ Command suspended and failed: ${err.message}`, 'error');
        });
      } else {
        this.log(`❌ Command failed: ${error.message}`, 'error');
      }
    }
  }

  /**
   * Parse command parameters (param:value format)
   */
  private parseCommandParams(parts: string[]): Record<string, any> {
    const params: Record<string, any> = {};

    parts.forEach(part => {
      if (part.includes(':')) {
        const [key, ...valueParts] = part.split(':');
        let value: any = valueParts.join(':');

        // Type conversion
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (/^\d+$/.test(value)) value = parseInt(value);
        else if (/^\d*\.\d+$/.test(value)) value = parseFloat(value);
        else if (value.startsWith('{') || value.startsWith('[')) {
          try { value = JSON.parse(value); } catch {}
        }

        params[key] = value;
      } else {
        params[part] = true;
      }
    });

    return params;
  }

  /**
   * Setup built-in commands (NO ASYNC)
   */
  private setupCommands() {
    // Help command
    this.addCommand('help', {
      description: 'Show available commands',
      syntax: '/help [command]',
      handler: (params) => {
        if (params.command) {
          const cmd = this.commands.get(params.command);
          if (cmd) {
            this.log(`📋 ${params.command}: ${cmd.description}`);
            this.log(`💡 Syntax: ${cmd.syntax}`);
            this.log(`📝 Examples:`);
            cmd.examples.forEach(ex => this.log(`   ${ex}`));
          } else {
            this.log(`❌ Command not found: ${params.command}`);
          }
        } else {
          this.log('📋 Available FX Developer Commands:');
          this.log('');
          this.commands.forEach((cmd, name) => {
            this.log(`/${name.padEnd(15)} - ${cmd.description}`);
          });
          this.log('');
          this.log('💡 Use /help command:name for detailed help');
        }
      },
      examples: ['/help', '/help command:goto']
    });

    // FX introspection commands
    this.addCommand('fx', {
      description: 'Inspect FX framework state',
      syntax: '/fx [action:nodes|plugins|stats]',
      handler: (params) => {
        const action = params.action || 'stats';

        switch (action) {
          case 'nodes':
            const nodeCount = Object.keys((this.fx as any).root.__nodes || {}).length;
            this.log(`📊 FX Nodes: ${nodeCount} total`);

            // Show top-level nodes
            Object.keys((this.fx as any).root.__nodes || {}).slice(0, 10).forEach(key => {
              const node = (this.fx as any).root.__nodes[key];
              this.log(`  ${key}: ${typeof node.__value} (${node.__watchers?.size || 0} watchers)`);
            });
            break;

          case 'plugins':
            const plugins = Object.keys(globalThis).filter(key => key.startsWith('$'));
            this.log(`📦 Loaded Plugins: ${plugins.length}`);
            plugins.forEach(plugin => {
              const available = typeof (globalThis as any)[plugin] !== 'undefined';
              this.log(`  ${plugin}: ${available ? '✅' : '❌'}`);
            });
            break;

          case 'stats':
          default:
            this.log(`🪄 FX Framework Status:`);
            this.log(`  Version: ${(this.fx as any).version || 'Unknown'}`);
            this.log(`  Auto-loading: ${typeof (globalThis as any).loadPluginByGlobal !== 'undefined' ? 'Enabled' : 'Disabled'}`);
            this.log(`  Plugins: ${Object.keys(globalThis).filter(k => k.startsWith('$')).length}`);
            this.log(`  Nodes: ${Object.keys((this.fx as any).root.__nodes || {}).length}`);
            break;
        }
      },
      examples: ['/fx', '/fx action:nodes', '/fx action:plugins']
    });

    // Navigation commands (NO ASYNC)
    this.addCommand('goto', {
      description: 'Navigate to URL',
      syntax: '/goto url:address [wait:ms]',
      handler: (params) => {
        if (!params.url) {
          throw new Error('URL required');
        }

        window.location.href = params.url;

        if (params.wait) {
          // Use setTimeout instead of async wait
          setTimeout(() => {
            this.log(`⏳ Waited ${params.wait}ms after navigation`);
          }, params.wait);
        }

        return `🔗 Navigated to: ${params.url}`;
      },
      examples: ['/goto url:/run/dc_1039', '/goto url:http://localhost:4003 wait:1000']
    });

    // Element interaction commands (NO ASYNC)
    this.addCommand('click', {
      description: 'Click element by selector',
      syntax: '/click target:selector [wait:ms]',
      handler: (params) => {
        if (!params.target) {
          throw new Error('Target selector required');
        }

        const element = document.querySelector(params.target);
        if (!element) {
          throw new Error(`Element not found: ${params.target}`);
        }

        (element as HTMLElement).click();

        if (params.wait) {
          setTimeout(() => {
            this.log(`⏳ Waited ${params.wait}ms after click`);
          }, params.wait);
        }

        return `🖱️ Clicked: ${params.target}`;
      },
      examples: ['/click target:button', '/click target:#submit-btn wait:500']
    });

    this.addCommand('type', {
      description: 'Type text into input element',
      syntax: '/type target:selector value:text [clear:true]',
      handler: (params) => {
        if (!params.target || !params.value) {
          throw new Error('Target and value required');
        }

        const element = document.querySelector(params.target) as HTMLInputElement;
        if (!element) {
          throw new Error(`Element not found: ${params.target}`);
        }

        if (params.clear) {
          element.value = '';
        }

        element.value = params.value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));

        return `⌨️ Typed "${params.value}" into ${params.target}`;
      },
      examples: ['/type target:#email value:test@example.com', '/type target:input[name="username"] value:admin clear:true']
    });

    // Element inspection commands
    this.addCommand('get', {
      description: 'Get element value or FX node value',
      syntax: '/get target:selector [prop:property] OR /get path:node.path',
      handler: (params) => {
        // Check if it's an FX node path
        if (params.path) {
          const $$ = (globalThis as any).$$;
          if ($$) {
            const value = $$(params.path).get();
            this.log(`📋 ${params.path}: ${JSON.stringify(value, null, 2)}`);
            return value;
          } else {
            throw new Error('FX $$ not available');
          }
        }

        // Otherwise handle as DOM element
        if (!params.target) {
          throw new Error('Target selector or path required');
        }

        const element = document.querySelector(params.target);
        if (!element) {
          throw new Error(`Element not found: ${params.target}`);
        }

        const property = params.prop || 'textContent';
        const value = (element as any)[property];

        this.log(`📋 ${params.target}.${property}: ${JSON.stringify(value)}`);
        return value;
      },
      examples: ['/get target:#username', '/get target:button prop:disabled', '/get path:app.user']
    });

    // Wait command (NO ASYNC - uses callbacks)
    this.addCommand('wait', {
      description: 'Wait for specified time or element',
      syntax: '/wait [time:ms] [for:selector] [timeout:ms]',
      handler: (params) => {
        if (params.time) {
          setTimeout(() => {
            this.log(`⏳ Waited ${params.time}ms`, 'success');
          }, params.time);
          return `⏳ Waiting ${params.time}ms...`;
        }

        if (params.for) {
          const timeout = params.timeout || 5000;
          const startTime = Date.now();

          const checkElement = () => {
            if (document.querySelector(params.for)) {
              this.log(`✅ Element appeared: ${params.for}`, 'success');
            } else if (Date.now() - startTime < timeout) {
              setTimeout(checkElement, 100);
            } else {
              this.log(`❌ Timeout waiting for: ${params.for}`, 'error');
            }
          };

          checkElement();
          return `⏳ Waiting for element: ${params.for}...`;
        }

        throw new Error('Either time or for parameter required');
      },
      examples: ['/wait time:1000', '/wait for:button timeout:10000']
    });

    // Console manipulation
    this.addCommand('clear', {
      description: 'Clear console output',
      syntax: '/clear',
      handler: () => {
        if (this.output) {
          this.output.innerHTML = '';
        }
        return 'Console cleared';
      },
      examples: ['/clear']
    });

    // FX node manipulation
    this.addCommand('set', {
      description: 'Set FX node value',
      syntax: '/set path:node.path value:data',
      handler: (params) => {
        if (!params.path || params.value === undefined) {
          throw new Error('Path and value required');
        }

        const $$ = (globalThis as any).$$;
        if (!$$) {
          throw new Error('FX $$ not available');
        }

        $$(params.path).set(params.value);
        return `✅ Set ${params.path} = ${JSON.stringify(params.value)}`;
      },
      examples: ['/set path:app.debug value:true', '/set path:user.name value:"John Doe"']
    });

    // Element watching
    this.addCommand('watch', {
      description: 'Watch element for changes',
      syntax: '/watch target:selector [prop:property] [stop:true]',
      handler: (params) => {
        if (params.stop) {
          this.watchers = this.watchers.filter(w => w.selector !== params.target);
          return `🔍 Stopped watching: ${params.target}`;
        }

        if (!params.target) {
          throw new Error('Target selector required');
        }

        const watcher: ElementWatcher = {
          selector: params.target,
          property: params.prop || 'textContent',
          callback: (oldVal, newVal) => {
            this.log(`👁️ ${params.target}.${watcher.property}: ${JSON.stringify(oldVal)} → ${JSON.stringify(newVal)}`, 'watch');
          }
        };

        this.watchers.push(watcher);
        return `👁️ Watching: ${params.target}.${watcher.property}`;
      },
      examples: ['/watch target:#status', '/watch target:input prop:value', '/watch target:#status stop:true']
    });

    // Test automation (NO ASYNC)
    this.addCommand('test', {
      description: 'Run automated test sequence',
      syntax: '/test script:name [steps:json]',
      handler: (params) => {
        if (params.script) {
          this.runTestScript(params.script);
          return `🤖 Starting test script: ${params.script}`;
        }

        if (params.steps) {
          this.runTestSteps(params.steps);
          return `🤖 Starting test steps`;
        }

        throw new Error('Script name or steps required');
      },
      examples: ['/test script:login', '/test steps:[{"action":"click","target":"button"}]']
    });

    // Export/Import state
    this.addCommand('export', {
      description: 'Export FX state or console history',
      syntax: '/export [type:state|history]',
      handler: (params) => {
        const type = params.type || 'state';

        if (type === 'history') {
          const $$ = (globalThis as any).$$;
          const history = $$ ? $$('devtools.console.history').get() : this.commandHistory;
          const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `fx-console-history-${Date.now()}.json`;
          a.click();
          return '📁 Exported console history';
        }

        // Export FX state
        const $$ = (globalThis as any).$$;
        if (!$$) {
          throw new Error('FX $$ not available');
        }

        const state = (this.fx as any).root.__nodes || {};
        const exportData = {};

        Object.keys(state).forEach(key => {
          try {
            (exportData as any)[key] = state[key].__value;
          } catch (e) {
            // Skip nodes that can't be serialized
          }
        });

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fx-state-${Date.now()}.json`;
        a.click();

        return '📁 Exported FX state';
      },
      examples: ['/export', '/export type:history']
    });

    // Performance monitoring
    this.addCommand('perf', {
      description: 'Show performance metrics',
      syntax: '/perf',
      handler: () => {
        if (typeof performance === 'undefined') {
          throw new Error('Performance API not available');
        }

        const metrics = {
          memory: (performance as any).memory ? {
            used: Math.round((performance as any).memory.usedJSHeapSize / 1048576) + 'MB',
            total: Math.round((performance as any).memory.totalJSHeapSize / 1048576) + 'MB',
            limit: Math.round((performance as any).memory.jsHeapSizeLimit / 1048576) + 'MB'
          } : 'N/A',
          navigation: performance.timing ? {
            loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart + 'ms',
            domReady: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart + 'ms',
            firstPaint: (performance as any).getEntriesByType ?
              (performance as any).getEntriesByType('paint')[0]?.startTime?.toFixed(2) + 'ms' : 'N/A'
          } : 'N/A'
        };

        this.log('📊 Performance Metrics:');
        this.log(JSON.stringify(metrics, null, 2));
        return metrics;
      },
      examples: ['/perf']
    });
  }

  /**
   * Add custom command
   */
  public addCommand(name: string, command: Omit<Command, 'name'>) {
    this.commands.set(name, {
      name,
      ...command
    });
  }

  /**
   * Log message to console
   */
  private log(message: string, type: 'info' | 'error' | 'success' | 'input' | 'watch' = 'info') {
    if (!this.output) return;

    const timestamp = new Date().toLocaleTimeString();
    const colors = {
      info: '#00ff00',
      error: '#ff4444',
      success: '#44ff44',
      input: '#ffff44',
      watch: '#44ffff'
    };

    const logLine = document.createElement('div');
    logLine.style.color = colors[type];
    logLine.textContent = `[${timestamp}] ${message}`;

    this.output.appendChild(logLine);
    this.output.scrollTop = this.output.scrollHeight;

    // Also log to FX nodes for remote access
    const $$ = (globalThis as any).$$;
    if ($$) {
      try {
        $$('devtools.console.history').set([
          ...($$('devtools.console.history').get() || []).slice(-99),
          { timestamp, message, type }
        ]);
      } catch (e) {
        // Ignore errors in FX node access
      }
    }
  }

  /**
   * Setup WebSocket remote control (NO ASYNC)
   */
  private setupWebSocketRemoteControl() {
    if (!this.options.enableRemoteControl) return;

    const connect = () => {
      try {
        this.webSocket = new WebSocket(this.options.websocketUrl);

        this.webSocket.onopen = () => {
          this.log('📡 Remote control connected', 'success');
          const $$ = (globalThis as any).$$;
          if ($$) {
            try {
              $$('devtools.remoteControl.connected').set(true);
            } catch (e) {}
          }
        };

        this.webSocket.onclose = () => {
          this.log('❌ Remote control disconnected', 'error');
          const $$ = (globalThis as any).$$;
          if ($$) {
            try {
              $$('devtools.remoteControl.connected').set(false);
            } catch (e) {}
          }

          // Auto-reconnect
          setTimeout(() => connect(), 3000);
        };

        this.webSocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'command') {
              this.log(`📡 Remote command: ${data.command}`, 'input');
              this.executeCommand(data.command);
            }

            if (data.type === 'test_script') {
              this.log(`🤖 Remote test script: ${data.script}`, 'input');
              this.runTestScript(data.script);
            }
          } catch (error: any) {
            this.log(`❌ Failed to process remote message: ${error.message}`, 'error');
          }
        };

        this.webSocket.onerror = (error) => {
          this.log(`❌ WebSocket error: ${error}`, 'error');
        };

      } catch (error: any) {
        this.log(`❌ Failed to setup remote control: ${error.message}`, 'error');
        // Retry connection
        setTimeout(() => connect(), 5000);
      }
    };

    connect();
  }

  /**
   * Setup element watching system
   */
  private setupElementWatching() {
    if (!this.options.enableElementWatching) return;

    this.watcherInterval = setInterval(() => {
      this.watchers.forEach(watcher => {
        const element = document.querySelector(watcher.selector);
        if (element) {
          const currentValue = (element as any)[watcher.property];
          if (currentValue !== watcher.lastValue) {
            watcher.callback(watcher.lastValue, currentValue);
            watcher.lastValue = currentValue;
          }
        }
      });
    }, 500) as any;
  }

  /**
   * Run automated test script (NO ASYNC)
   */
  private runTestScript(scriptName: string): void {
    this.log(`🤖 Running test script: ${scriptName}`);

    // Built-in test scripts
    const scripts: Record<string, TestStep[]> = {
      'wizard_navigation': [
        { action: 'goto', target: '/run/dc_1039' },
        { action: 'wait', timeout: 2000 },
        { action: 'assert', target: 'h1', expected: 'Tenant Migration: dc_1039' },
        { action: 'click', target: 'button:contains("2. Inventory")' },
        { action: 'wait', timeout: 1000 },
        { action: 'report', target: 'Current step completed' }
      ],
      'form_interaction': [
        { action: 'type', target: 'input[placeholder*="host"]', value: 'localhost' },
        { action: 'type', target: 'input[type="password"]', value: 'testpass' },
        { action: 'click', target: 'button[type="submit"]' },
        { action: 'wait', timeout: 2000 },
        { action: 'report', target: 'Form submission attempted' }
      ]
    };

    const steps = scripts[scriptName];
    if (!steps) {
      this.log(`❌ Test script not found: ${scriptName}`, 'error');
      return;
    }

    this.runTestSteps(steps);
  }

  /**
   * Execute test steps (NO ASYNC)
   */
  private runTestSteps(steps: TestStep[]): void {
    let currentStep = 0;

    const executeStep = () => {
      if (currentStep >= steps.length) {
        this.log(`✅ Test completed: ${steps.length} steps executed`, 'success');
        return;
      }

      const step = steps[currentStep];
      this.log(`🤖 Step ${currentStep + 1}: ${step.action} ${step.target || ''}`);

      try {
        switch (step.action) {
          case 'goto':
            if (step.target) {
              window.location.href = step.target;
              this.log(`  ✅ Navigated to ${step.target}`, 'success');
            }
            break;

          case 'click':
            if (step.target) {
              const element = document.querySelector(step.target);
              if (element) {
                (element as HTMLElement).click();
                this.log(`  ✅ Clicked ${step.target}`, 'success');
              } else {
                throw new Error(`Element not found: ${step.target}`);
              }
            }
            break;

          case 'type':
            if (step.target && step.value) {
              const element = document.querySelector(step.target) as HTMLInputElement;
              if (element) {
                element.value = step.value;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                this.log(`  ✅ Typed "${step.value}" into ${step.target}`, 'success');
              } else {
                throw new Error(`Element not found: ${step.target}`);
              }
            }
            break;

          case 'wait':
            if (step.timeout) {
              this.log(`  ⏳ Waiting ${step.timeout}ms...`);
              setTimeout(() => {
                this.log(`  ✅ Waited ${step.timeout}ms`, 'success');
                currentStep++;
                executeStep();
              }, step.timeout);
              return; // Don't increment step yet
            }
            break;

          case 'assert':
            if (step.target && step.expected) {
              const element = document.querySelector(step.target);
              const actual = element?.textContent || '';
              if (actual.includes(step.expected)) {
                this.log(`  ✅ Assertion passed: ${step.target} contains "${step.expected}"`, 'success');
              } else {
                throw new Error(`Assertion failed: ${step.target} = "${actual}", expected "${step.expected}"`);
              }
            }
            break;

          case 'report':
            this.log(`  📊 ${step.target}`, 'success');
            break;
        }

        currentStep++;

        // Continue to next step with a small delay
        setTimeout(executeStep, 100);

      } catch (error: any) {
        this.log(`  ❌ Step failed: ${error.message}`, 'error');
        this.log(`🛑 Test aborted at step ${currentStep + 1}`, 'error');
      }
    };

    executeStep();
  }

  /**
   * Get console output for remote access
   */
  public getConsoleOutput(): any[] {
    const $$ = (globalThis as any).$$;
    if ($$) {
      try {
        return $$('devtools.console.history').get() || [];
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  /**
   * Send remote command (NO ASYNC)
   */
  public sendRemoteCommand(command: string): boolean {
    if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
      try {
        this.webSocket.send(JSON.stringify({
          type: 'command',
          command,
          timestamp: Date.now()
        }));
        return true;
      } catch (error: any) {
        this.log(`❌ Failed to send remote command: ${error.message}`, 'error');
        return false;
      }
    }
    return false;
  }

  /**
   * Public methods for console control
   */
  public showConsolePublic(): void {
    this.showConsole();
  }

  public hideConsolePublic(): void {
    this.hideConsole();
  }

  public toggleConsolePublic(): void {
    this.toggleConsole();
  }

  /**
   * Cleanup
   */
  public destroy() {
    if (this.console) {
      this.console.remove();
    }

    if (this.webSocket) {
      this.webSocket.close();
    }

    if (this.watcherInterval) {
      clearInterval(this.watcherInterval);
    }

    this.log('🛑 FX DevTools destroyed');
  }
}

// Plugin factory function
export default function fxDevToolsPlugin(fx: FX, options: DevToolsOptions = {}): FXDevToolsPlugin {
  const devTools = new FXDevToolsPlugin(fx, options);

  // Make available globally
  if (options.global) {
    (globalThis as any)[options.global] = {
      show: () => devTools.showConsolePublic(),
      hide: () => devTools.hideConsolePublic(),
      toggle: () => devTools.toggleConsolePublic(),
      log: (msg: string) => devTools.log(msg, 'info'),
      addCommand: (name: string, cmd: any) => devTools.addCommand(name, cmd),
      getOutput: () => devTools.getConsoleOutput(),
      sendRemote: (cmd: string) => devTools.sendRemoteCommand(cmd),
      destroy: () => devTools.destroy(),
      // Additional utility methods
      executeCommand: (cmd: string) => devTools.executeCommand(cmd),
      clearConsole: () => {
        const output = (devTools as any).output;
        if (output) output.innerHTML = '';
      }
    };
  }

  return devTools;
}

// Export types for external use
export type { Command, TestStep, ElementWatcher, DevToolsOptions };