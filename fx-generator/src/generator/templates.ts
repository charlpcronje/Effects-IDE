/**
 * Template Renderer - Renders templates with variable substitution
 */

export interface TemplateContext {
    projectName: string;
    template: string;
    loaderType: string;
    plugins: string[];
    templateName?: string;
}

export class TemplateRenderer {
    private templates: Map<string, string> = new Map();

    constructor() {
        this.loadTemplates();
    }

    private loadTemplates(): void {
        // Main entry point
        this.templates.set("main", `/**
 * {{projectName}} - Main Entry Point
 * Generated with FX Project Generator
 */

import { FXCore } from './fx/fx';
{{#if_wasm}}
import { FXDiskSyncLoader, patchFXWithPluginLoader } from './fx/fx-disk/index';
{{/if_wasm}}
import './app';

// Initialize FX Core
const fx = new FXCore();

{{#if_wasm}}
// Configure WASM VFS loader for instant plugin loading
fx.moduleLoader = new FXDiskSyncLoader({
    bundleUrl: '/dist/fx-bundle.bin'
});
patchFXWithPluginLoader(fx);
{{/if_wasm}}

// Export for use in app
export { fx };
export const $$ = fx.proxy();

console.log('[{{projectName}}] FX initialized');
`);

        // Counter template
        this.templates.set("app-counter", `/**
 * {{projectName}} - Counter App
 */

import { $$ } from './main';
{{#each_plugin}}
import '../fx/plugins/{{this}}';
{{/each_plugin}}

// Initialize counter state
$$("app.counter").val(0);

// Counter functions
export function increment() {
    const current = $$("app.counter").val();
    $$("app.counter").val(current + 1);
}

export function decrement() {
    const current = $$("app.counter").val();
    $$("app.counter").val(current - 1);
}

export function reset() {
    $$("app.counter").val(0);
}

// Watch for changes and update UI
$$("app.counter").watch((newVal: number) => {
    const display = document.getElementById("counter-value");
    if (display) {
        display.textContent = String(newVal);
    }
});

// Setup event listeners
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btn-increment")?.addEventListener("click", increment);
    document.getElementById("btn-decrement")?.addEventListener("click", decrement);
    document.getElementById("btn-reset")?.addEventListener("click", reset);

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
        if (e.key === "ArrowUp") increment();
        if (e.key === "ArrowDown") decrement();
        if (e.key === "r") reset();
    });
});

console.log('[{{projectName}}] Counter app initialized');
`);

        // CRUD template
        this.templates.set("app-crud", `/**
 * {{projectName}} - CRUD App (Task Manager)
 */

import { $$ } from './main';

interface Task {
    id: string;
    title: string;
    completed: boolean;
    createdAt: number;
}

// Initialize task list
$$("app.tasks").val([]);

// CRUD Operations
export const TaskManager = {
    create(title: string): Task {
        const task: Task = {
            id: crypto.randomUUID(),
            title,
            completed: false,
            createdAt: Date.now()
        };

        const tasks = $$("app.tasks").val() as Task[];
        $$("app.tasks").val([...tasks, task]);
        this.save();

        return task;
    },

    read(): Task[] {
        return $$("app.tasks").val() as Task[] || [];
    },

    update(id: string, updates: Partial<Task>): void {
        const tasks = this.read();
        const index = tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            tasks[index] = { ...tasks[index], ...updates };
            $$("app.tasks").val([...tasks]);
            this.save();
        }
    },

    delete(id: string): void {
        const tasks = this.read().filter(t => t.id !== id);
        $$("app.tasks").val(tasks);
        this.save();
    },

    toggle(id: string): void {
        const tasks = this.read();
        const task = tasks.find(t => t.id === id);
        if (task) {
            this.update(id, { completed: !task.completed });
        }
    },

    save(): void {
        localStorage.setItem("tasks", JSON.stringify(this.read()));
    },

    load(): void {
        const saved = localStorage.getItem("tasks");
        if (saved) {
            $$("app.tasks").val(JSON.parse(saved));
        }
    }
};

// Watch for changes and update UI
$$("app.tasks").watch((tasks: Task[]) => {
    renderTasks(tasks);
});

function renderTasks(tasks: Task[]): void {
    const list = document.getElementById("task-list");
    if (!list) return;

    list.innerHTML = tasks.map(task => \`
        <li class="task \${task.completed ? 'completed' : ''}" data-id="\${task.id}">
            <input type="checkbox" \${task.completed ? 'checked' : ''} />
            <span>\${task.title}</span>
            <button class="delete">Delete</button>
        </li>
    \`).join('');
}

// Setup
document.addEventListener("DOMContentLoaded", () => {
    TaskManager.load();

    document.getElementById("task-form")?.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = document.getElementById("task-input") as HTMLInputElement;
        if (input.value.trim()) {
            TaskManager.create(input.value.trim());
            input.value = "";
        }
    });

    document.getElementById("task-list")?.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const li = target.closest("li");
        const id = li?.dataset.id;
        if (!id) return;

        if (target.matches("input[type=checkbox]")) {
            TaskManager.toggle(id);
        } else if (target.matches(".delete")) {
            TaskManager.delete(id);
        }
    });
});

console.log('[{{projectName}}] CRUD app initialized');
`);

        // Flow template
        this.templates.set("app-flow", `/**
 * {{projectName}} - Flow Cross Realm App
 */

import { $$ } from './main';

// Flow definitions
interface FlowStep {
    name: string;
    execute: (input: any) => any;
}

class FlowEngine {
    private steps: FlowStep[] = [];

    step(name: string, execute: (input: any) => any): this {
        this.steps.push({ name, execute });
        return this;
    }

    async run(input: any): Promise<any> {
        let result = input;

        for (const step of this.steps) {
            console.log(\`[Flow] Running step: \${step.name}\`);
            $$(\`flow.current\`).val(step.name);

            result = await step.execute(result);

            $$(\`flow.results.\${step.name}\`).val(result);
        }

        $$("flow.current").val("complete");
        return result;
    }
}

// Create a sample flow
const dataProcessingFlow = new FlowEngine()
    .step("validate", (data) => {
        if (!data.id) throw new Error("Missing ID");
        return { ...data, validated: true };
    })
    .step("transform", (data) => {
        return {
            ...data,
            transformed: true,
            timestamp: Date.now()
        };
    })
    .step("enrich", (data) => {
        return {
            ...data,
            enriched: true,
            metadata: { source: "flow-engine" }
        };
    });

// Initialize state
$$("flow.status").val("idle");
$$("flow.current").val(null);
$$("flow.results").val({});

// Export for UI
export async function runFlow(inputData: any): Promise<any> {
    $$("flow.status").val("running");

    try {
        const result = await dataProcessingFlow.run(inputData);
        $$("flow.status").val("complete");
        return result;
    } catch (error) {
        $$("flow.status").val("error");
        $$("flow.error").val(error.message);
        throw error;
    }
}

// Watch for status changes
$$("flow.status").watch((status: string) => {
    const display = document.getElementById("flow-status");
    if (display) {
        display.textContent = status;
        display.className = \`status \${status}\`;
    }
});

// Setup
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("run-flow")?.addEventListener("click", async () => {
        const result = await runFlow({ id: 123, value: "test" });
        console.log("Flow result:", result);
    });
});

console.log('[{{projectName}}] Flow app initialized');
`);

        // Wiki template
        this.templates.set("app-wiki", `/**
 * {{projectName}} - Wiki App
 */

import { $$ } from './main';

interface WikiPage {
    id: string;
    title: string;
    content: Block[];
    parent?: string;
    children: string[];
    createdAt: number;
    updatedAt: number;
}

interface Block {
    id: string;
    type: 'heading' | 'paragraph' | 'list' | 'code';
    content: string;
    properties?: Record<string, any>;
}

// Initialize wiki state
$$("wiki.pages").val({});
$$("wiki.currentPage").val(null);

// Wiki operations
export const Wiki = {
    createPage(title: string, parent?: string): WikiPage {
        const page: WikiPage = {
            id: crypto.randomUUID(),
            title,
            content: [
                { id: crypto.randomUUID(), type: 'heading', content: title, properties: { level: 1 } },
                { id: crypto.randomUUID(), type: 'paragraph', content: 'Start writing...' }
            ],
            parent,
            children: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        const pages = $$("wiki.pages").val() as Record<string, WikiPage>;
        pages[page.id] = page;

        if (parent && pages[parent]) {
            pages[parent].children.push(page.id);
        }

        $$("wiki.pages").val({ ...pages });
        this.save();

        return page;
    },

    updatePage(id: string, updates: Partial<WikiPage>): void {
        const pages = $$("wiki.pages").val() as Record<string, WikiPage>;
        if (pages[id]) {
            pages[id] = { ...pages[id], ...updates, updatedAt: Date.now() };
            $$("wiki.pages").val({ ...pages });
            this.save();
        }
    },

    deletePage(id: string): void {
        const pages = $$("wiki.pages").val() as Record<string, WikiPage>;
        delete pages[id];
        $$("wiki.pages").val({ ...pages });
        this.save();
    },

    addBlock(pageId: string, block: Block): void {
        const pages = $$("wiki.pages").val() as Record<string, WikiPage>;
        if (pages[pageId]) {
            pages[pageId].content.push(block);
            pages[pageId].updatedAt = Date.now();
            $$("wiki.pages").val({ ...pages });
            this.save();
        }
    },

    save(): void {
        localStorage.setItem("wiki", JSON.stringify($$("wiki.pages").val()));
    },

    load(): void {
        const saved = localStorage.getItem("wiki");
        if (saved) {
            $$("wiki.pages").val(JSON.parse(saved));
        } else {
            // Create default page
            this.createPage("Welcome to Wiki");
        }
    }
};

// Render current page
$$("wiki.currentPage").watch((pageId: string) => {
    if (!pageId) return;

    const pages = $$("wiki.pages").val() as Record<string, WikiPage>;
    const page = pages[pageId];

    if (page) {
        renderPage(page);
    }
});

function renderPage(page: WikiPage): void {
    const container = document.getElementById("wiki-content");
    if (!container) return;

    container.innerHTML = page.content.map(block => {
        switch (block.type) {
            case 'heading':
                const level = block.properties?.level || 1;
                return \`<h\${level}>\${block.content}</h\${level}>\`;
            case 'paragraph':
                return \`<p>\${block.content}</p>\`;
            case 'list':
                return \`<ul><li>\${block.content}</li></ul>\`;
            case 'code':
                return \`<pre><code>\${block.content}</code></pre>\`;
            default:
                return \`<p>\${block.content}</p>\`;
        }
    }).join('');
}

// Setup
document.addEventListener("DOMContentLoaded", () => {
    Wiki.load();

    const pages = $$("wiki.pages").val() as Record<string, WikiPage>;
    const firstPage = Object.keys(pages)[0];
    if (firstPage) {
        $$("wiki.currentPage").val(firstPage);
    }
});

console.log('[{{projectName}}] Wiki app initialized');
`);

        // HTML template
        this.templates.set("index-html", `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{projectName}}</title>
    <link rel="stylesheet" href="./styles/main.css">
</head>
<body>
    <div id="app">
        <header>
            <h1>{{projectName}}</h1>
        </header>

        <main id="main-content">
            <!-- App content will be rendered here -->
        </main>

        <footer>
            <p>Built with FX Framework</p>
        </footer>
    </div>

    <script type="module" src="./main.ts"></script>
</body>
</html>
`);

        // CSS template
        this.templates.set("main-css", `/* {{projectName}} - Main Styles */

:root {
    --primary: #3b82f6;
    --primary-dark: #1d4ed8;
    --secondary: #6b7280;
    --success: #10b981;
    --error: #ef4444;
    --background: #0f172a;
    --surface: #1e293b;
    --text: #f1f5f9;
    --text-secondary: #94a3b8;
    --border: #334155;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: system-ui, -apple-system, sans-serif;
    background: var(--background);
    color: var(--text);
    line-height: 1.6;
}

#app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
}

header {
    background: var(--surface);
    padding: 1rem 2rem;
    border-bottom: 1px solid var(--border);
}

header h1 {
    font-size: 1.5rem;
    font-weight: 600;
}

main {
    flex: 1;
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
}

footer {
    padding: 1rem 2rem;
    text-align: center;
    color: var(--text-secondary);
    border-top: 1px solid var(--border);
}

button {
    background: var(--primary);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 0.875rem;
    transition: background 0.2s;
}

button:hover {
    background: var(--primary-dark);
}

input, textarea {
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 0.5rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
}

input:focus, textarea:focus {
    outline: none;
    border-color: var(--primary);
}
`);

        // Utils template
        this.templates.set("utils", `/**
 * Utility functions for {{projectName}}
 */

export function debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

export function throttle<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let lastCall = 0;
    return (...args: Parameters<T>) => {
        const now = Date.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            fn(...args);
        }
    };
}

export function generateId(): string {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString();
}

export function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString();
}
`);

        // Package.json template
        this.templates.set("package-json", `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "FX Application - {{templateName}}",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "npm run build:bundle && vite build",
    "build:bundle": "node scripts/build-bundle.js",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src --ext .ts,.tsx"
  },
  "dependencies": {},
  "devDependencies": {
    "vite": "^5.0.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0",
    "eslint": "^8.55.0"
  }
}
`);

        // TSConfig template
        this.templates.set("tsconfig", `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
`);

        // Gitignore template
        this.templates.set("gitignore", `node_modules/
dist/
*.log
.DS_Store
.env
.env.local
`);

        // Bundle config template
        this.templates.set("bundle-config", `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "plugins": [
{{#plugins_list}}
  ],
  "output": "./dist/fx-bundle.bin",
  "format": "binary",
  "compress": true
}
`);

        // README template
        this.templates.set("readme", `# {{projectName}}

FX Application built with the **{{templateName}}** template.

## Quick Start

### Install Dependencies

\`\`\`bash
npm install
\`\`\`

### Development

\`\`\`bash
npm run dev
\`\`\`

Open http://localhost:5173

### Build for Production

\`\`\`bash
npm run build
\`\`\`

### Run Tests

\`\`\`bash
npm test
\`\`\`

## Project Structure

- \`src/\` - Application source code
- \`src/fx/\` - FX framework
- \`src/components/\` - UI components
- \`tests/\` - Test suites
- \`dist/\` - Build output

## Installed Plugins

{{#plugins_list_readme}}

## Documentation

- [Getting Started](./GETTING_STARTED.md)
- [API Documentation](./docs/API.md)

## Built With

- [FX Framework](https://github.com/fx/fx)
- TypeScript
- Vite

---

Generated with FX Project Generator v1.0
`);

        // Getting Started template
        this.templates.set("getting-started", `# Getting Started with {{projectName}}

This guide will help you get up and running with your new FX project.

## Prerequisites

- Node.js 18+
- npm or yarn

## Installation

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Start development server:
   \`\`\`bash
   npm run dev
   \`\`\`

3. Open http://localhost:5173 in your browser

## Project Structure

\`\`\`
{{projectName}}/
├── src/
│   ├── main.ts          # Entry point
│   ├── app.ts           # Main application
│   ├── fx/              # FX framework files
│   └── components/      # UI components
├── tests/               # Test suites
└── dist/                # Build output
\`\`\`

## Using FX

Import the FX proxy in your components:

\`\`\`typescript
import { $$ } from './main';

// Set a value
$$("app.myValue").val(42);

// Get a value
const value = $$("app.myValue").val();

// Watch for changes
$$("app.myValue").watch((newVal, oldVal) => {
    console.log('Value changed:', newVal);
});
\`\`\`

## Next Steps

1. Explore the app.ts file to understand the structure
2. Check the installed plugins documentation
3. Run tests with \`npm test\`
`);

        // API docs template
        this.templates.set("api-docs", `# {{projectName}} API Documentation

## FX Core API

### Proxy Access

\`\`\`typescript
const $$ = fx.proxy();
\`\`\`

### Node Operations

#### \`val()\` - Get/Set Value
\`\`\`typescript
// Get value
const value = $$("path.to.node").val();

// Set value
$$("path.to.node").val(newValue);
\`\`\`

#### \`watch()\` - Subscribe to Changes
\`\`\`typescript
const unsubscribe = $$("path.to.node").watch((newVal, oldVal) => {
    // Handle change
});

// Later: unsubscribe to stop watching
unsubscribe();
\`\`\`

### Plugin Usage

{{#plugins_api_docs}}

## Template-Specific API

See the main app.ts file for template-specific exports and functions.
`);
    }

    /**
     * Render a template with context
     */
    render(templateName: string, context: TemplateContext): string {
        let template = this.templates.get(templateName);

        if (!template) {
            throw new Error(`Template not found: ${templateName}`);
        }

        // Simple variable replacement
        template = template.replace(/\{\{projectName\}\}/g, context.projectName);
        template = template.replace(/\{\{template\}\}/g, context.template);
        template = template.replace(/\{\{loaderType\}\}/g, context.loaderType);
        template = template.replace(/\{\{templateName\}\}/g, context.templateName || context.template);

        // Conditional: {{#if_wasm}}...{{/if_wasm}}
        const wasmRegex = /\{\{#if_wasm\}\}([\s\S]*?)\{\{\/if_wasm\}\}/g;
        template = template.replace(wasmRegex, (_, content) => {
            return context.loaderType === "wasm" ? content : "";
        });

        // Plugin list for imports
        const pluginImportRegex = /\{\{#each_plugin\}\}([\s\S]*?)\{\{\/each_plugin\}\}/g;
        template = template.replace(pluginImportRegex, (_, content) => {
            return context.plugins.map(plugin => {
                return content.replace(/\{\{this\}\}/g, plugin);
            }).join("\n");
        });

        // Plugin list for JSON
        const pluginsListRegex = /\{\{#plugins_list\}\}/g;
        template = template.replace(pluginsListRegex, () => {
            return context.plugins.map((p, i) => {
                const comma = i < context.plugins.length - 1 ? "," : "";
                return `    "./src/fx/plugins/${p}.ts"${comma}`;
            }).join("\n");
        });

        // Plugin list for README
        const pluginsReadmeRegex = /\{\{#plugins_list_readme\}\}/g;
        template = template.replace(pluginsReadmeRegex, () => {
            if (context.plugins.length === 0) return "No plugins installed.";
            return context.plugins.map(p => `- **${p}**`).join("\n");
        });

        // Plugin API docs
        const pluginsApiRegex = /\{\{#plugins_api_docs\}\}/g;
        template = template.replace(pluginsApiRegex, () => {
            if (context.plugins.length === 0) return "No plugins installed.";
            return context.plugins.map(p => `### ${p}\n\nSee plugin documentation.`).join("\n\n");
        });

        return template;
    }
}
