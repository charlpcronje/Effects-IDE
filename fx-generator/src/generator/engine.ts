/**
 * Generator Engine - Orchestrates project creation
 */

import { Display, ProjectConfig } from "../cli/display.ts";
import { TemplateRenderer } from "./templates.ts";
import { ResourceManager } from "../resources/manager.ts";

export interface GenerationResult {
    success: boolean;
    projectPath: string;
    filesCreated: number;
    errors: string[];
    duration: number;
}

export class GeneratorEngine {
    private display: Display;
    private templateRenderer: TemplateRenderer;
    private resourceManager: ResourceManager;

    constructor(display: Display) {
        this.display = display;
        this.templateRenderer = new TemplateRenderer();
        this.resourceManager = new ResourceManager();
    }

    /**
     * Generate a project from configuration
     */
    async generate(config: ProjectConfig): Promise<GenerationResult> {
        const startTime = performance.now();
        const errors: string[] = [];
        let filesCreated = 0;

        console.log();
        this.display.section(`🚀 Generating Project: ${config.projectName}`);
        console.log();

        try {
            // Step 1: Create project structure
            this.display.progress(1, 7, "Creating project structure...");
            await this.createStructure(config);
            filesCreated += 5;
            this.display.check("Created project structure", 50);

            // Step 2: Extract FX core files
            this.display.progress(2, 7, "Extracting FX core files...");
            await this.extractCore(config);
            filesCreated += 10;
            this.display.check("Extracted FX core files", 120);

            // Step 3: Install plugins
            this.display.progress(3, 7, "Installing plugins...");
            await this.installPlugins(config);
            filesCreated += config.plugins.length;
            this.display.check(`Installed plugins (${config.plugins.length})`, 80);

            // Step 4: Render template
            this.display.progress(4, 7, "Rendering template...");
            await this.renderTemplate(config);
            filesCreated += 5;
            this.display.check(`Rendered template: ${this.getTemplateName(config.template)}`, 150);

            // Step 5: Generate configuration files
            this.display.progress(5, 7, "Generating configuration files...");
            await this.generateConfigs(config);
            filesCreated += 4;
            this.display.check("Generated configuration files", 40);

            // Step 6: Build bundle if WASM
            if (config.loaderType === "wasm") {
                this.display.progress(6, 7, "Building WASM VFS bundle...");
                await this.buildBundle(config);
                filesCreated += 1;
                this.display.check("Built WASM VFS bundle", 340);
            } else {
                this.display.progress(6, 7, "Skipping bundle (suspend loader)...");
                this.display.check("Skipped bundle build", 0);
            }

            // Step 7: Generate documentation
            this.display.progress(7, 7, "Generating documentation...");
            await this.generateDocs(config);
            filesCreated += 3;
            this.display.check("Generated documentation", 60);

        } catch (error) {
            errors.push(error.message);
        }

        const duration = performance.now() - startTime;

        console.log();
        console.log(`─`.repeat(60));
        console.log(`Total time: ${(duration / 1000).toFixed(2)}s`);

        return {
            success: errors.length === 0,
            projectPath: config.projectPath,
            filesCreated,
            errors,
            duration
        };
    }

    private async createStructure(config: ProjectConfig): Promise<void> {
        const dirs = [
            config.projectPath,
            `${config.projectPath}/src`,
            `${config.projectPath}/src/fx`,
            `${config.projectPath}/src/fx/plugins`,
            `${config.projectPath}/src/fx/fx-disk`,
            `${config.projectPath}/src/components`,
            `${config.projectPath}/src/styles`,
            `${config.projectPath}/src/lib`,
            `${config.projectPath}/dist`,
            `${config.projectPath}/tests`,
            `${config.projectPath}/tests/unit`,
            `${config.projectPath}/tests/integration`,
            `${config.projectPath}/tests/e2e`,
            `${config.projectPath}/docs`
        ];

        for (const dir of dirs) {
            await Deno.mkdir(dir, { recursive: true });
        }
    }

    private async extractCore(config: ProjectConfig): Promise<void> {
        // Generate minimal FX core
        const fxCore = this.resourceManager.getFXCore();
        await Deno.writeTextFile(`${config.projectPath}/src/fx/fx.ts`, fxCore);

        // Generate fx.v4.ts
        const fxV4 = this.resourceManager.getFXV4();
        await Deno.writeTextFile(`${config.projectPath}/src/fx/fx.v4.ts`, fxV4);

        // Generate FX Disk files if WASM loader
        if (config.loaderType === "wasm") {
            const fxDisk = this.resourceManager.getFXDisk();
            await Deno.writeTextFile(`${config.projectPath}/src/fx/fx-disk/index.ts`, fxDisk.index);
            await Deno.writeTextFile(`${config.projectPath}/src/fx/fx-disk/loader.ts`, fxDisk.loader);
            await Deno.writeTextFile(`${config.projectPath}/src/fx/fx-disk/vfs.ts`, fxDisk.vfs);
        }
    }

    private async installPlugins(config: ProjectConfig): Promise<void> {
        for (const plugin of config.plugins) {
            const content = this.resourceManager.getPlugin(plugin);
            await Deno.writeTextFile(`${config.projectPath}/src/fx/plugins/${plugin}.ts`, content);
        }
    }

    private async renderTemplate(config: ProjectConfig): Promise<void> {
        const context = {
            projectName: config.projectName,
            template: config.template,
            loaderType: config.loaderType,
            plugins: config.plugins
        };

        // Main entry point
        const mainTs = this.templateRenderer.render("main", context);
        await Deno.writeTextFile(`${config.projectPath}/src/main.ts`, mainTs);

        // App file
        const appTs = this.templateRenderer.render(`app-${config.template}`, context);
        await Deno.writeTextFile(`${config.projectPath}/src/app.ts`, appTs);

        // HTML template
        const indexHtml = this.templateRenderer.render("index-html", context);
        await Deno.writeTextFile(`${config.projectPath}/src/index.html`, indexHtml);

        // Styles
        const mainCss = this.templateRenderer.render("main-css", context);
        await Deno.writeTextFile(`${config.projectPath}/src/styles/main.css`, mainCss);

        // Utils
        const utilsTs = this.templateRenderer.render("utils", context);
        await Deno.writeTextFile(`${config.projectPath}/src/lib/utils.ts`, utilsTs);
    }

    private async generateConfigs(config: ProjectConfig): Promise<void> {
        const context = {
            projectName: config.projectName,
            template: config.template,
            loaderType: config.loaderType,
            plugins: config.plugins
        };

        // package.json
        const packageJson = this.templateRenderer.render("package-json", context);
        await Deno.writeTextFile(`${config.projectPath}/package.json`, packageJson);

        // tsconfig.json
        const tsconfig = this.templateRenderer.render("tsconfig", context);
        await Deno.writeTextFile(`${config.projectPath}/tsconfig.json`, tsconfig);

        // .gitignore
        const gitignore = this.templateRenderer.render("gitignore", context);
        await Deno.writeTextFile(`${config.projectPath}/.gitignore`, gitignore);

        // bundle.config.json (if WASM)
        if (config.loaderType === "wasm") {
            const bundleConfig = this.templateRenderer.render("bundle-config", context);
            await Deno.writeTextFile(`${config.projectPath}/bundle.config.json`, bundleConfig);
        }
    }

    private async buildBundle(_config: ProjectConfig): Promise<void> {
        // Placeholder - in production, this would run the FX Disk bundler
        // For now, just create an empty bundle file
        await Deno.writeTextFile(`${_config.projectPath}/dist/fx-bundle.bin`, "");
    }

    private async generateDocs(config: ProjectConfig): Promise<void> {
        const context = {
            projectName: config.projectName,
            template: config.template,
            loaderType: config.loaderType,
            plugins: config.plugins,
            templateName: this.getTemplateName(config.template)
        };

        // README.md
        const readme = this.templateRenderer.render("readme", context);
        await Deno.writeTextFile(`${config.projectPath}/README.md`, readme);

        // GETTING_STARTED.md
        const gettingStarted = this.templateRenderer.render("getting-started", context);
        await Deno.writeTextFile(`${config.projectPath}/GETTING_STARTED.md`, gettingStarted);

        // docs/API.md
        const api = this.templateRenderer.render("api-docs", context);
        await Deno.writeTextFile(`${config.projectPath}/docs/API.md`, api);
    }

    private getTemplateName(template: string): string {
        const names: Record<string, string> = {
            "counter": "Basic Counter",
            "crud": "Basic CRUD",
            "flow": "Flow Cross Realm",
            "wiki": "Full FX Wiki"
        };
        return names[template] || template;
    }
}
