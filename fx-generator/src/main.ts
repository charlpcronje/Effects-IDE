/**
 * FX Project Generator - Main Entry Point
 *
 * A single-executable Deno application that generates fully-configured,
 * tested FX projects through an interactive CLI wizard.
 *
 * @version 1.0.0
 */

import { Wizard } from "./cli/wizard.ts";
import { GeneratorEngine } from "./generator/engine.ts";
import { Display } from "./cli/display.ts";
import { Validator } from "./validator/tester.ts";

async function main() {
    const display = new Display();

    try {
        // Show welcome screen
        display.welcome();

        // Run wizard to collect user input
        const wizard = new Wizard(display);
        const config = await wizard.run();

        if (!config) {
            display.info("\nProject creation cancelled.");
            Deno.exit(0);
        }

        // Generate project
        const generator = new GeneratorEngine(display);
        const result = await generator.generate(config);

        if (!result.success) {
            display.error("\nProject generation failed:");
            for (const error of result.errors) {
                display.error(`  - ${error}`);
            }
            Deno.exit(1);
        }

        // Validate project
        const validator = new Validator(display);
        const validation = await validator.validate(config.projectPath);

        // Show success screen
        display.success(config, validation);

    } catch (error) {
        display.error(`\nFatal error: ${error.message}`);
        Deno.exit(1);
    }
}

// Run
main();
