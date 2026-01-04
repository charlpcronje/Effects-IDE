/**
 * Display utilities for CLI output
 */

// Colors for terminal output
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    bgBlue: "\x1b[44m",
    bgGreen: "\x1b[42m",
};

export interface ProjectConfig {
    projectName: string;
    projectPath: string;
    projectType: "app" | "plugin";
    loaderType: "wasm" | "suspend";
    template: string;
    plugins: string[];
}

export interface ValidationResult {
    passed: boolean;
    tests: {
        unit: { passed: number; total: number };
        integration: { passed: number; total: number };
        e2e: { passed: number; total: number };
    };
    checks: {
        structure: boolean;
        config: boolean;
        build: boolean;
    };
}

export class Display {
    private width = 60;

    /**
     * Show welcome screen
     */
    welcome(): void {
        console.clear();
        this.box([
            "",
            `${colors.cyan}${colors.bright}FX Project Generator v1.0${colors.reset}`,
            "",
            "Create production-ready FX applications",
            "with zero configuration",
            ""
        ]);
        console.log();
    }

    /**
     * Draw a box around content
     */
    box(lines: string[]): void {
        const border = "═".repeat(this.width);
        console.log(`╔${border}╗`);
        for (const line of lines) {
            const stripped = this.stripAnsi(line);
            const padding = this.width - stripped.length;
            const left = Math.floor(padding / 2);
            const right = padding - left;
            console.log(`║${" ".repeat(left)}${line}${" ".repeat(right)}║`);
        }
        console.log(`╚${border}╝`);
    }

    /**
     * Show section header
     */
    section(title: string): void {
        console.log();
        console.log(`${colors.cyan}${title}${colors.reset}`);
        console.log("─".repeat(this.width));
    }

    /**
     * Show info message
     */
    info(message: string): void {
        console.log(`${colors.blue}ℹ${colors.reset} ${message}`);
    }

    /**
     * Show warning message
     */
    warn(message: string): void {
        console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
    }

    /**
     * Show error message
     */
    error(message: string): void {
        console.log(`${colors.red}✗${colors.reset} ${message}`);
    }

    /**
     * Show success checkmark
     */
    check(message: string, time?: number): void {
        const timeStr = time !== undefined ? ` ${colors.dim}(${time}ms)${colors.reset}` : "";
        console.log(`${colors.green}✓${colors.reset} ${message}${timeStr}`);
    }

    /**
     * Show progress bar
     */
    progress(current: number, total: number, label: string = ""): void {
        const percent = Math.floor((current / total) * 100);
        const filled = Math.floor((current / total) * 40);
        const empty = 40 - filled;
        const bar = `[${"█".repeat(filled)}${"░".repeat(empty)}]`;

        // Clear line and write progress
        Deno.stdout.writeSync(new TextEncoder().encode(`\r${bar} ${percent}% ${label}`));

        if (current === total) {
            console.log();
        }
    }

    /**
     * Show spinner (simplified - just prints dots)
     */
    async spinner<T>(message: string, fn: () => Promise<T>): Promise<T> {
        const start = performance.now();
        process.stdout.write(`${message}...`);

        try {
            const result = await fn();
            const time = Math.round(performance.now() - start);
            console.log(` ${colors.green}done${colors.reset} ${colors.dim}(${time}ms)${colors.reset}`);
            return result;
        } catch (error) {
            console.log(` ${colors.red}failed${colors.reset}`);
            throw error;
        }
    }

    /**
     * Show success screen
     */
    success(config: ProjectConfig, validation: ValidationResult): void {
        console.log();
        this.box([
            "",
            `${colors.green}${colors.bright}Project Created Successfully!${colors.reset}`,
            ""
        ]);
        console.log();

        console.log(`📁 Location: ${colors.cyan}./${config.projectName}${colors.reset}`);
        console.log(`📦 Template: ${config.template}`);
        console.log(`🔌 Plugins:  ${config.plugins.join(", ") || "none"}`);

        const totalTests = validation.tests.unit.total +
                          validation.tests.integration.total +
                          validation.tests.e2e.total;
        const passedTests = validation.tests.unit.passed +
                           validation.tests.integration.passed +
                           validation.tests.e2e.passed;

        console.log(`✅ Tests:    ${passedTests}/${totalTests} passed (${Math.round(passedTests/totalTests*100)}%)`);

        console.log();
        console.log(`${colors.bright}Next steps:${colors.reset}`);
        console.log();
        console.log(`  1. Navigate to project:`);
        console.log(`     ${colors.cyan}$ cd ${config.projectName}${colors.reset}`);
        console.log();
        console.log(`  2. Install dependencies:`);
        console.log(`     ${colors.cyan}$ npm install${colors.reset}`);
        console.log();
        console.log(`  3. Start development server:`);
        console.log(`     ${colors.cyan}$ npm run dev${colors.reset}`);
        console.log();
        console.log(`  4. Build for production:`);
        console.log(`     ${colors.cyan}$ npm run build${colors.reset}`);
        console.log();
        console.log(`Documentation: ${colors.cyan}./${config.projectName}/README.md${colors.reset}`);
        console.log();
        console.log(`Happy coding! 🚀`);
        console.log();
    }

    /**
     * Strip ANSI escape codes from string
     */
    private stripAnsi(str: string): string {
        return str.replace(/\x1b\[[0-9;]*m/g, "");
    }
}

// Polyfill for process.stdout in Deno
const process = {
    stdout: {
        write(str: string) {
            Deno.stdout.writeSync(new TextEncoder().encode(str));
        }
    }
};
