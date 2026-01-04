// /plugins/fx-codegen-vault.ts
/**
 * @fx-plugin fx-codegen-vault
 * @fx-global $codegen
 * @fx-description Template and scaffold generator for code generation
 * @fx-dependencies fx-ast-lens
 * @fx-provides $codegen
 * @fx-version 1.0.0
 *
 * FX CodeGen Vault Plugin - Template-based code generation, scaffolding,
 * and code transformation utilities for AI-assisted development.
 */

import type { FXCore, FXNodeProxy } from '../fx.v4';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface Template {
    id: string;
    name: string;
    description: string;
    category: string;
    language: string;
    variables: TemplateVariable[];
    content: string;
    outputPath?: string; // Template for output path
    created: number;
    modified: number;
}

export interface TemplateVariable {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'select' | 'array';
    description: string;
    default?: any;
    required?: boolean;
    options?: string[]; // For select type
    validation?: string; // Regex pattern
}

export interface Scaffold {
    id: string;
    name: string;
    description: string;
    templates: ScaffoldTemplate[];
    variables: TemplateVariable[];
    hooks?: ScaffoldHooks;
}

export interface ScaffoldTemplate {
    templateId: string;
    outputPath: string;
    condition?: string; // Expression to evaluate
}

export interface ScaffoldHooks {
    beforeGenerate?: string; // Function code
    afterGenerate?: string;
    beforeEachFile?: string;
    afterEachFile?: string;
}

export interface GenerationResult {
    success: boolean;
    files: GeneratedFile[];
    errors: GenerationError[];
    duration: number;
}

export interface GeneratedFile {
    path: string;
    content: string;
    template: string;
    size: number;
}

export interface GenerationError {
    template: string;
    message: string;
    variable?: string;
}

export interface CodegenConfig {
    templateDir?: string;
    scaffoldDir?: string;
    outputDir?: string;
    preserveExisting?: boolean;
}

// ============================================================================
// Built-in Templates
// ============================================================================

const BUILTIN_TEMPLATES: Template[] = [
    {
        id: 'fx-plugin',
        name: 'FX Plugin',
        description: 'Create a new FX plugin',
        category: 'plugin',
        language: 'typescript',
        variables: [
            { name: 'name', type: 'string', description: 'Plugin name (e.g., my-plugin)', required: true },
            { name: 'global', type: 'string', description: 'Global accessor (e.g., $myPlugin)', required: true },
            { name: 'description', type: 'string', description: 'Plugin description', default: 'An FX plugin' },
            { name: 'version', type: 'string', description: 'Plugin version', default: '1.0.0' }
        ],
        content: `// /plugins/fx-{{name}}.ts
/**
 * @fx-plugin fx-{{name}}
 * @fx-global {{global}}
 * @fx-description {{description}}
 * @fx-dependencies
 * @fx-provides {{global}}
 * @fx-version {{version}}
 */

import type { FXCore, FXNodeProxy } from '../fx.v4';

export interface {{pascalCase name}}Config {
    // Add configuration options here
}

export class FX{{pascalCase name}} {
    public readonly name = '{{name}}';
    public readonly version = '{{version}}';
    public readonly description = '{{description}}';

    private fx: FXCore;
    private config: {{pascalCase name}}Config;

    constructor(fx: FXCore, config: {{pascalCase name}}Config = {}) {
        this.fx = fx;
        this.config = config;

        this.initNodes();
        console.log('[FX-{{upper name}}] Initialized');
    }

    private initNodes(): void {
        const $$ = this.fx.proxy();
        $$('plugins.{{name}}.status').val('ready');
    }

    // Add plugin methods here
}

export default function(fx: FXCore, config: {{pascalCase name}}Config = {}): FX{{pascalCase name}} {
    return new FX{{pascalCase name}}(fx, config);
}
`,
        created: Date.now(),
        modified: Date.now()
    },
    {
        id: 'react-component',
        name: 'React Component',
        description: 'Create a React functional component',
        category: 'component',
        language: 'tsx',
        variables: [
            { name: 'name', type: 'string', description: 'Component name', required: true },
            { name: 'hasProps', type: 'boolean', description: 'Include props interface', default: true },
            { name: 'hasState', type: 'boolean', description: 'Include useState', default: false },
            { name: 'hasEffect', type: 'boolean', description: 'Include useEffect', default: false }
        ],
        content: `import React{{#if hasState}}, { useState }{{/if}}{{#if hasEffect}}, { useEffect }{{/if}} from 'react';

{{#if hasProps}}
interface {{name}}Props {
    // Add props here
}

{{/if}}
export const {{name}}: React.FC{{#if hasProps}}<{{name}}Props>{{/if}} = ({{#if hasProps}}props{{/if}}) => {
{{#if hasState}}
    const [state, setState] = useState<any>(null);

{{/if}}
{{#if hasEffect}}
    useEffect(() => {
        // Effect logic here
        return () => {
            // Cleanup
        };
    }, []);

{{/if}}
    return (
        <div className="{{kebabCase name}}">
            <h1>{{name}}</h1>
        </div>
    );
};

export default {{name}};
`,
        created: Date.now(),
        modified: Date.now()
    },
    {
        id: 'typescript-class',
        name: 'TypeScript Class',
        description: 'Create a TypeScript class',
        category: 'class',
        language: 'typescript',
        variables: [
            { name: 'name', type: 'string', description: 'Class name', required: true },
            { name: 'hasConstructor', type: 'boolean', description: 'Include constructor', default: true },
            { name: 'isExported', type: 'boolean', description: 'Export the class', default: true }
        ],
        content: `{{#if isExported}}export {{/if}}class {{name}} {
{{#if hasConstructor}}
    constructor() {
        // Initialize
    }

{{/if}}
    // Add methods here
}
`,
        created: Date.now(),
        modified: Date.now()
    },
    {
        id: 'api-endpoint',
        name: 'API Endpoint',
        description: 'Create an API endpoint handler',
        category: 'api',
        language: 'typescript',
        variables: [
            { name: 'name', type: 'string', description: 'Endpoint name', required: true },
            { name: 'method', type: 'select', description: 'HTTP method', options: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], default: 'GET' },
            { name: 'path', type: 'string', description: 'URL path', required: true },
            { name: 'hasAuth', type: 'boolean', description: 'Require authentication', default: true }
        ],
        content: `import { Context } from 'hono';

/**
 * {{method}} {{path}}
 * {{name}} endpoint
 */
export async function {{camelCase name}}Handler(c: Context) {
{{#if hasAuth}}
    // Check authentication
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

{{/if}}
{{#if (eq method "GET")}}
    // Handle GET request
    const data = {}; // Fetch data

    return c.json(data);
{{/if}}
{{#if (eq method "POST")}}
    // Handle POST request
    const body = await c.req.json();

    // Validate and process
    const result = {}; // Process data

    return c.json(result, 201);
{{/if}}
{{#if (eq method "PUT")}}
    // Handle PUT request
    const body = await c.req.json();
    const id = c.req.param('id');

    // Update resource
    const result = {}; // Update data

    return c.json(result);
{{/if}}
{{#if (eq method "DELETE")}}
    // Handle DELETE request
    const id = c.req.param('id');

    // Delete resource

    return c.json({ success: true });
{{/if}}
}
`,
        created: Date.now(),
        modified: Date.now()
    }
];

// ============================================================================
// Template Engine
// ============================================================================

class TemplateEngine {
    private helpers: Record<string, (...args: any[]) => string> = {};

    constructor() {
        this.registerBuiltinHelpers();
    }

    private registerBuiltinHelpers(): void {
        // Case transformations
        this.helpers['pascalCase'] = (str: string) => {
            return str.replace(/[-_](.)/g, (_, c) => c.toUpperCase())
                .replace(/^(.)/, (_, c) => c.toUpperCase());
        };

        this.helpers['camelCase'] = (str: string) => {
            return str.replace(/[-_](.)/g, (_, c) => c.toUpperCase())
                .replace(/^(.)/, (_, c) => c.toLowerCase());
        };

        this.helpers['kebabCase'] = (str: string) => {
            return str.replace(/([a-z])([A-Z])/g, '$1-$2')
                .replace(/[_\s]+/g, '-')
                .toLowerCase();
        };

        this.helpers['snakeCase'] = (str: string) => {
            return str.replace(/([a-z])([A-Z])/g, '$1_$2')
                .replace(/[-\s]+/g, '_')
                .toLowerCase();
        };

        this.helpers['upper'] = (str: string) => str.toUpperCase();
        this.helpers['lower'] = (str: string) => str.toLowerCase();

        // Comparisons
        this.helpers['eq'] = (a: any, b: any) => a === b ? 'true' : '';
        this.helpers['ne'] = (a: any, b: any) => a !== b ? 'true' : '';
        this.helpers['gt'] = (a: number, b: number) => a > b ? 'true' : '';
        this.helpers['lt'] = (a: number, b: number) => a < b ? 'true' : '';
    }

    registerHelper(name: string, fn: (...args: any[]) => string): void {
        this.helpers[name] = fn;
    }

    render(template: string, context: Record<string, any>): string {
        let result = template;

        // Process conditionals {{#if condition}}...{{/if}}
        result = this.processConditionals(result, context);

        // Process loops {{#each array}}...{{/each}}
        result = this.processLoops(result, context);

        // Process helper calls {{helperName arg}}
        result = this.processHelpers(result, context);

        // Process simple variables {{variable}}
        result = this.processVariables(result, context);

        return result;
    }

    private processConditionals(template: string, context: Record<string, any>): string {
        // Handle {{#if (helper arg)}}
        const helperIfRegex = /\{\{#if\s+\((\w+)\s+([^)]+)\)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;
        template = template.replace(helperIfRegex, (match, helper, args, ifContent, elseContent) => {
            const argList = args.split(/\s+/).map((a: string) => {
                // Remove quotes
                if (a.startsWith('"') || a.startsWith("'")) {
                    return a.slice(1, -1);
                }
                return context[a] ?? a;
            });

            const helperFn = this.helpers[helper];
            const result = helperFn ? helperFn(...argList) : '';
            return result ? ifContent : (elseContent || '');
        });

        // Handle {{#if variable}}
        const simpleIfRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;
        return template.replace(simpleIfRegex, (match, variable, ifContent, elseContent) => {
            const value = context[variable];
            return value ? ifContent : (elseContent || '');
        });
    }

    private processLoops(template: string, context: Record<string, any>): string {
        const eachRegex = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;

        return template.replace(eachRegex, (match, arrayName, content) => {
            const array = context[arrayName];
            if (!Array.isArray(array)) return '';

            return array.map((item, index) => {
                let itemContent = content;
                // Replace {{this}} with item
                itemContent = itemContent.replace(/\{\{this\}\}/g, String(item));
                // Replace {{@index}} with index
                itemContent = itemContent.replace(/\{\{@index\}\}/g, String(index));
                return itemContent;
            }).join('');
        });
    }

    private processHelpers(template: string, context: Record<string, any>): string {
        const helperRegex = /\{\{(\w+)\s+([^}]+)\}\}/g;

        return template.replace(helperRegex, (match, helper, arg) => {
            const helperFn = this.helpers[helper];
            if (!helperFn) return match;

            // Get argument value
            const argValue = context[arg.trim()] ?? arg.trim();
            return helperFn(argValue);
        });
    }

    private processVariables(template: string, context: Record<string, any>): string {
        const varRegex = /\{\{(\w+(?:\.\w+)*)\}\}/g;

        return template.replace(varRegex, (match, path) => {
            const parts = path.split('.');
            let value: any = context;

            for (const part of parts) {
                if (value === undefined || value === null) return '';
                value = value[part];
            }

            return value !== undefined ? String(value) : '';
        });
    }
}

// ============================================================================
// CodeGen Vault Plugin Class
// ============================================================================

export class FXCodeGenVault {
    public readonly name = 'codegen-vault';
    public readonly version = '1.0.0';
    public readonly description = 'Template and scaffold generator';

    private fx: FXCore;
    private config: CodegenConfig;
    private engine = new TemplateEngine();
    private templates = new Map<string, Template>();
    private scaffolds = new Map<string, Scaffold>();

    constructor(fx: FXCore, config: CodegenConfig = {}) {
        this.fx = fx;
        this.config = {
            templateDir: 'templates',
            scaffoldDir: 'scaffolds',
            outputDir: 'src',
            preserveExisting: true,
            ...config
        };

        this.initNodes();
        this.loadBuiltinTemplates();
    }

    private initNodes(): void {
        const $$ = this.fx.proxy();

        $$('codegen.templates').val({});
        $$('codegen.scaffolds').val({});
        $$('codegen.history').val([]);
        $$('codegen.stats').val({
            templateCount: 0,
            scaffoldCount: 0,
            generatedFiles: 0
        });
    }

    private loadBuiltinTemplates(): void {
        for (const template of BUILTIN_TEMPLATES) {
            this.templates.set(template.id, template);
        }
        this.updateStats();
    }

    // ========================================================================
    // Template Management
    // ========================================================================

    /**
     * Register a new template
     */
    registerTemplate(template: Omit<Template, 'id' | 'created' | 'modified'>): Template {
        const id = `tpl-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const now = Date.now();

        const newTemplate: Template = {
            ...template,
            id,
            created: now,
            modified: now
        };

        this.templates.set(id, newTemplate);
        this.updateStats();

        return newTemplate;
    }

    /**
     * Get template by ID
     */
    getTemplate(id: string): Template | undefined {
        return this.templates.get(id);
    }

    /**
     * Get all templates
     */
    getTemplates(): Template[] {
        return Array.from(this.templates.values());
    }

    /**
     * Get templates by category
     */
    getTemplatesByCategory(category: string): Template[] {
        return this.getTemplates().filter(t => t.category === category);
    }

    /**
     * Update a template
     */
    updateTemplate(id: string, updates: Partial<Template>): Template {
        const template = this.templates.get(id);
        if (!template) {
            throw new Error(`Template not found: ${id}`);
        }

        const updated = {
            ...template,
            ...updates,
            id: template.id, // Preserve ID
            modified: Date.now()
        };

        this.templates.set(id, updated);
        return updated;
    }

    /**
     * Delete a template
     */
    deleteTemplate(id: string): void {
        this.templates.delete(id);
        this.updateStats();
    }

    // ========================================================================
    // Code Generation
    // ========================================================================

    /**
     * Generate code from template
     */
    generate(templateId: string, variables: Record<string, any>): GeneratedFile {
        const template = this.templates.get(templateId);
        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }

        // Validate required variables
        const errors: GenerationError[] = [];
        for (const v of template.variables) {
            if (v.required && variables[v.name] === undefined) {
                errors.push({
                    template: templateId,
                    message: `Missing required variable: ${v.name}`,
                    variable: v.name
                });
            }

            // Validate pattern
            if (v.validation && variables[v.name]) {
                const regex = new RegExp(v.validation);
                if (!regex.test(String(variables[v.name]))) {
                    errors.push({
                        template: templateId,
                        message: `Invalid value for ${v.name}`,
                        variable: v.name
                    });
                }
            }
        }

        if (errors.length > 0) {
            throw new Error(errors.map(e => e.message).join(', '));
        }

        // Apply defaults
        const context: Record<string, any> = {};
        for (const v of template.variables) {
            context[v.name] = variables[v.name] ?? v.default;
        }

        // Render template
        const content = this.engine.render(template.content, context);

        // Determine output path
        let outputPath = template.outputPath || `${template.name}.${this.getExtension(template.language)}`;
        outputPath = this.engine.render(outputPath, context);

        const file: GeneratedFile = {
            path: outputPath,
            content,
            template: templateId,
            size: new TextEncoder().encode(content).length
        };

        // Log generation
        this.logGeneration(file);

        return file;
    }

    /**
     * Generate multiple files from scaffold
     */
    generateScaffold(scaffoldId: string, variables: Record<string, any>): GenerationResult {
        const scaffold = this.scaffolds.get(scaffoldId);
        if (!scaffold) {
            throw new Error(`Scaffold not found: ${scaffoldId}`);
        }

        const startTime = performance.now();
        const files: GeneratedFile[] = [];
        const errors: GenerationError[] = [];

        // Apply scaffold variable defaults
        const context: Record<string, any> = {};
        for (const v of scaffold.variables) {
            context[v.name] = variables[v.name] ?? v.default;
        }

        // Run beforeGenerate hook
        if (scaffold.hooks?.beforeGenerate) {
            try {
                const fn = new Function('context', scaffold.hooks.beforeGenerate);
                fn(context);
            } catch (e: any) {
                errors.push({ template: 'scaffold', message: `beforeGenerate hook failed: ${e.message}` });
            }
        }

        // Generate each template
        for (const tpl of scaffold.templates) {
            // Check condition
            if (tpl.condition) {
                try {
                    const fn = new Function('context', `return ${tpl.condition}`);
                    if (!fn(context)) continue;
                } catch {
                    continue;
                }
            }

            try {
                // Run beforeEachFile hook
                if (scaffold.hooks?.beforeEachFile) {
                    const fn = new Function('context', 'template', scaffold.hooks.beforeEachFile);
                    fn(context, tpl);
                }

                const file = this.generate(tpl.templateId, {
                    ...context,
                    _outputPath: tpl.outputPath
                });

                // Override output path
                file.path = this.engine.render(tpl.outputPath, context);
                files.push(file);

                // Run afterEachFile hook
                if (scaffold.hooks?.afterEachFile) {
                    const fn = new Function('context', 'file', scaffold.hooks.afterEachFile);
                    fn(context, file);
                }
            } catch (e: any) {
                errors.push({
                    template: tpl.templateId,
                    message: e.message
                });
            }
        }

        // Run afterGenerate hook
        if (scaffold.hooks?.afterGenerate) {
            try {
                const fn = new Function('context', 'files', scaffold.hooks.afterGenerate);
                fn(context, files);
            } catch (e: any) {
                errors.push({ template: 'scaffold', message: `afterGenerate hook failed: ${e.message}` });
            }
        }

        const duration = performance.now() - startTime;

        return {
            success: errors.length === 0,
            files,
            errors,
            duration
        };
    }

    /**
     * Preview generated code without saving
     */
    preview(templateId: string, variables: Record<string, any>): string {
        return this.generate(templateId, variables).content;
    }

    // ========================================================================
    // Scaffold Management
    // ========================================================================

    /**
     * Register a scaffold
     */
    registerScaffold(scaffold: Omit<Scaffold, 'id'>): Scaffold {
        const id = `scf-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        const newScaffold: Scaffold = {
            ...scaffold,
            id
        };

        this.scaffolds.set(id, newScaffold);
        this.updateStats();

        return newScaffold;
    }

    /**
     * Get scaffold by ID
     */
    getScaffold(id: string): Scaffold | undefined {
        return this.scaffolds.get(id);
    }

    /**
     * Get all scaffolds
     */
    getScaffolds(): Scaffold[] {
        return Array.from(this.scaffolds.values());
    }

    // ========================================================================
    // Helper Registration
    // ========================================================================

    /**
     * Register a custom template helper
     */
    registerHelper(name: string, fn: (...args: any[]) => string): void {
        this.engine.registerHelper(name, fn);
    }

    // ========================================================================
    // Utilities
    // ========================================================================

    private getExtension(language: string): string {
        const extMap: Record<string, string> = {
            'typescript': 'ts',
            'javascript': 'js',
            'tsx': 'tsx',
            'jsx': 'jsx',
            'css': 'css',
            'html': 'html',
            'json': 'json',
            'markdown': 'md'
        };
        return extMap[language] || 'txt';
    }

    private logGeneration(file: GeneratedFile): void {
        const $$ = this.fx.proxy();
        const history = $$('codegen.history').val() || [];

        history.unshift({
            path: file.path,
            template: file.template,
            timestamp: Date.now(),
            size: file.size
        });

        // Keep last 100 entries
        if (history.length > 100) {
            history.pop();
        }

        $$('codegen.history').val(history);
        this.updateStats();
    }

    private updateStats(): void {
        const $$ = this.fx.proxy();
        const history = $$('codegen.history').val() || [];

        $$('codegen.stats').val({
            templateCount: this.templates.size,
            scaffoldCount: this.scaffolds.size,
            generatedFiles: history.length
        });

        // Update template list
        const templateList: Record<string, any> = {};
        for (const [id, t] of this.templates) {
            templateList[id] = {
                name: t.name,
                category: t.category,
                language: t.language
            };
        }
        $$('codegen.templates').val(templateList);
    }

    /**
     * Get generation history
     */
    getHistory(): Array<{ path: string; template: string; timestamp: number; size: number }> {
        const $$ = this.fx.proxy();
        return $$('codegen.history').val() || [];
    }
}

// ============================================================================
// Plugin Export
// ============================================================================

export default function(fx: FXCore, config: CodegenConfig = {}): FXCodeGenVault {
    return new FXCodeGenVault(fx, config);
}
