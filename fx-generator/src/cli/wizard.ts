/**
 * Interactive CLI Wizard for project configuration
 */

import { Display, ProjectConfig } from "./display.ts";

// Simple prompt implementation (avoiding external dependencies for compilation)
async function prompt(message: string): Promise<string> {
    const buf = new Uint8Array(1024);
    await Deno.stdout.write(new TextEncoder().encode(message));
    const n = await Deno.stdin.read(buf);
    if (n === null) return "";
    return new TextDecoder().decode(buf.subarray(0, n)).trim();
}

async function select(message: string, options: Array<{ name: string; value: string }>): Promise<string> {
    console.log(message);
    console.log();

    for (let i = 0; i < options.length; i++) {
        console.log(`  ${i + 1}. ${options[i].name}`);
    }

    console.log();
    const answer = await prompt("Enter number: ");
    const index = parseInt(answer) - 1;

    if (index >= 0 && index < options.length) {
        return options[index].value;
    }

    return options[0].value;
}

async function checkbox(message: string, options: Array<{ name: string; value: string; checked?: boolean }>): Promise<string[]> {
    console.log(message);
    console.log("(Enter comma-separated numbers, or press Enter for defaults)");
    console.log();

    for (let i = 0; i < options.length; i++) {
        const check = options[i].checked ? "[x]" : "[ ]";
        console.log(`  ${i + 1}. ${check} ${options[i].name}`);
    }

    console.log();
    const answer = await prompt("Selection: ");

    if (!answer.trim()) {
        // Return defaults
        return options.filter(o => o.checked).map(o => o.value);
    }

    const indices = answer.split(",").map(s => parseInt(s.trim()) - 1);
    return indices
        .filter(i => i >= 0 && i < options.length)
        .map(i => options[i].value);
}

export class Wizard {
    private display: Display;

    constructor(display: Display) {
        this.display = display;
    }

    /**
     * Run the wizard and collect project configuration
     */
    async run(): Promise<ProjectConfig | null> {
        // Step 1: Project Name
        this.display.section("📁 Project Name");
        const projectName = await this.getProjectName();
        if (!projectName) return null;

        // Step 2: Project Type
        this.display.section("📦 Project Type");
        const projectType = await this.getProjectType();

        // Step 3: Loader Type
        this.display.section("⚡ Module Loader");
        const loaderType = await this.getLoaderType();

        // Step 4: Template
        this.display.section("📋 Starter Template");
        const template = await this.getTemplate();

        // Step 5: Plugins
        this.display.section("🔌 Plugins");
        const plugins = await this.getPlugins(template);

        // Confirm
        console.log();
        this.display.section("📝 Configuration Summary");
        console.log(`  Project Name: ${projectName}`);
        console.log(`  Type:         ${projectType}`);
        console.log(`  Loader:       ${loaderType}`);
        console.log(`  Template:     ${template}`);
        console.log(`  Plugins:      ${plugins.join(", ") || "none"}`);
        console.log();

        const confirm = await prompt("Create project? (Y/n): ");
        if (confirm.toLowerCase() === "n") {
            return null;
        }

        return {
            projectName,
            projectPath: `./${projectName}`,
            projectType: projectType as "app" | "plugin",
            loaderType: loaderType as "wasm" | "suspend",
            template,
            plugins
        };
    }

    private async getProjectName(): Promise<string | null> {
        const name = await prompt("? What is your project name? ");

        if (!name.trim()) {
            this.display.error("Project name is required");
            return null;
        }

        // Validate name
        if (!/^[a-z0-9-]+$/.test(name)) {
            this.display.error("Use lowercase letters, numbers, and hyphens only");
            return null;
        }

        // Check if directory exists
        try {
            const stat = await Deno.stat(`./${name}`);
            if (stat.isDirectory) {
                this.display.error(`Directory "${name}" already exists`);
                return null;
            }
        } catch {
            // Directory doesn't exist, good
        }

        return name;
    }

    private async getProjectType(): Promise<string> {
        return await select("? What type of project?", [
            { name: "App       - Full application with UI", value: "app" },
            { name: "Plugin    - Reusable FX plugin", value: "plugin" }
        ]);
    }

    private async getLoaderType(): Promise<string> {
        return await select("? Which loader do you want to use?", [
            { name: "WASM VFS         - Instant loading (<1ms) [Recommended]", value: "wasm" },
            { name: "Suspend Loader   - Standard async loading", value: "suspend" }
        ]);
    }

    private async getTemplate(): Promise<string> {
        return await select("? Select a template to start with:", [
            { name: "Basic Counter      - Simple counter app (great for learning)", value: "counter" },
            { name: "Basic CRUD         - Todo/task manager with CRUD operations", value: "crud" },
            { name: "Flow Cross Realm   - Multi-worker flow processing", value: "flow" },
            { name: "Full FX Wiki       - Notion-style wiki with pages & components", value: "wiki" }
        ]);
    }

    private async getPlugins(template: string): Promise<string[]> {
        // Suggest plugins based on template
        const suggestions: Record<string, string[]> = {
            "counter": ["fx-dom-dollar"],
            "crud": ["fx-dom-dollar", "fx-cache"],
            "flow": ["fx-flow", "fx-dom-dollar"],
            "wiki": ["fx-dom-dollar", "fx-cache", "fx-markdown", "fx-router"]
        };

        const suggested = suggestions[template] || ["fx-dom-dollar"];

        return await checkbox("? Select plugins to include:", [
            { name: "fx-dom-dollar    - DOM manipulation ($dom)", value: "fx-dom-dollar", checked: suggested.includes("fx-dom-dollar") },
            { name: "fx-cache         - Caching system ($cache)", value: "fx-cache", checked: suggested.includes("fx-cache") },
            { name: "fx-orm           - Database ORM ($db)", value: "fx-orm", checked: suggested.includes("fx-orm") },
            { name: "fx-router        - Client-side routing ($router)", value: "fx-router", checked: suggested.includes("fx-router") },
            { name: "fx-api           - API client ($api)", value: "fx-api", checked: suggested.includes("fx-api") },
            { name: "fx-markdown      - Markdown rendering", value: "fx-markdown", checked: suggested.includes("fx-markdown") },
            { name: "fx-flow          - Cross-realm workflows", value: "fx-flow", checked: suggested.includes("fx-flow") },
            { name: "fx-serialize     - State serialization", value: "fx-serialize", checked: suggested.includes("fx-serialize") }
        ]);
    }
}
