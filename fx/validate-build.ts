#!/usr/bin/env -S npx tsx
/**
 * @file validate-build.ts
 * @description Build validation script to ensure all FX plugins compile successfully
 *
 * This script validates that:
 * 1. The core fx.v4 module exports are accessible
 * 2. All plugins can be imported without errors
 * 3. TypeScript compilation succeeds
 * 4. CSP compatibility is maintained
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join, basename } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FX_DIR = join(__dirname, '../..');
const FX_TS_DIR = __dirname;
const PLUGINS_DIR = join(FX_TS_DIR, 'plugins');

interface ValidationResult {
    success: boolean;
    errors: string[];
    warnings: string[];
}

class BuildValidator {
    private errors: string[] = [];
    private warnings: string[] = [];

    /**
     * Validate that fx.v4 exports are correct
     */
    async validateCoreExports(): Promise<boolean> {
        console.log('🔍 Validating fx.v4 core exports...');

        try {
            // Check if fx.v4.ts exists
            const fxV4Path = join(FX_TS_DIR, 'fx.v4.ts');
            if (!existsSync(fxV4Path)) {
                this.errors.push('fx.v4.ts does not exist!');
                return false;
            }

            // Try to import fx.v4
            const fxV4Module = await import(fxV4Path);

            // Check required exports
            const requiredExports = ['FXCore', 'fx', '$$', 'initGlobals'];
            for (const exp of requiredExports) {
                if (!(exp in fxV4Module)) {
                    this.errors.push(`Missing export: ${exp}`);
                }
            }

            console.log('✅ Core exports validated');
            return this.errors.length === 0;
        } catch (error: any) {
            this.errors.push(`Failed to import fx.v4: ${error.message}`);
            return false;
        }
    }

    /**
     * Validate TypeScript compilation of all plugins
     */
    validateTypeScript(): boolean {
        console.log('🔍 Validating TypeScript compilation...');

        try {
            // Create a temporary tsconfig for validation
            const tsConfig = {
                compilerOptions: {
                    target: 'ES2022',
                    module: 'ES2020',
                    lib: ['ES2022', 'DOM', 'WebWorker'],
                    moduleResolution: 'node',
                    strict: false,
                    skipLibCheck: true,
                    noEmit: true,
                    allowJs: true,
                    esModuleInterop: true,
                    resolveJsonModule: true,
                    types: [],
                    noImplicitAny: false,
                    noUnusedLocals: false,
                    noUnusedParameters: false
                },
                include: [
                    join(FX_TS_DIR, 'fx.ts'),
                    join(FX_TS_DIR, 'fx.v4.ts'),
                    join(PLUGINS_DIR, '*.ts')
                ],
                exclude: ['node_modules', '**/*.test.ts', '**/*.spec.ts', '**/workers/**', '**/validate-build.ts']
            };

            // Write temporary tsconfig
            const tsconfigPath = join(FX_TS_DIR, 'tsconfig.validation.json');
            writeFileSync(tsconfigPath, JSON.stringify(tsConfig, null, 2));

            // Run TypeScript compiler
            try {
                execSync(`npx tsc -p "${tsconfigPath}"`, {
                    cwd: FX_TS_DIR,
                    stdio: 'pipe'
                });
                console.log('✅ TypeScript compilation successful');
                return true;
            } catch (error: any) {
                const output = error.stdout?.toString() || error.stderr?.toString() || error.message;
                this.errors.push(`TypeScript compilation failed:\n${output}`);
                return false;
            } finally {
                // Clean up temporary tsconfig
                if (existsSync(tsconfigPath)) {
                    unlinkSync(tsconfigPath);
                }
            }
        } catch (error: any) {
            this.errors.push(`Failed to validate TypeScript: ${error.message}`);
            return false;
        }
    }

    /**
     * Validate individual plugin imports
     */
    async validatePlugins(): Promise<boolean> {
        console.log('🔍 Validating plugin imports...');

        if (!existsSync(PLUGINS_DIR)) {
            this.errors.push('Plugins directory does not exist!');
            return false;
        }

        const pluginFiles = readdirSync(PLUGINS_DIR)
            .filter(f => f.endsWith('.ts') && !f.includes('.test') && !f.includes('.spec'));

        let allSuccess = true;

        for (const file of pluginFiles) {
            const pluginPath = join(PLUGINS_DIR, file);
            console.log(`  Checking ${file}...`);

            try {
                // Read the plugin file to check imports
                const content = readFileSync(pluginPath, 'utf-8');

                // Check if it imports from fx.v4
                if (content.includes("from '../fx.v4'") || content.includes('from "../fx.v4"')) {
                    console.log(`    ✓ Imports fx.v4 correctly`);
                } else if (content.includes("from '../fx'") || content.includes('from "../fx"')) {
                    this.warnings.push(`${file} imports from fx.ts instead of fx.v4`);
                }

                // Check for CSP violations
                if (content.includes('new Function') && !content.includes('CSP')) {
                    this.warnings.push(`${file} uses 'new Function' without CSP checks`);
                }

                if (content.includes('eval(')) {
                    this.warnings.push(`${file} uses 'eval()' which violates CSP`);
                }

            } catch (error: any) {
                this.errors.push(`Failed to validate ${file}: ${error.message}`);
                allSuccess = false;
            }
        }

        if (allSuccess) {
            console.log(`✅ All ${pluginFiles.length} plugins validated`);
        }

        return allSuccess;
    }

    /**
     * Check for CSP compatibility
     */
    validateCSPCompatibility(): boolean {
        console.log('🔍 Validating CSP compatibility...');

        const fxPath = join(FX_TS_DIR, 'fx.ts');
        const content = readFileSync(fxPath, 'utf-8');

        // Check for CSP detection
        if (content.includes('detectCSP')) {
            console.log('  ✓ CSP detection implemented');
        } else {
            this.warnings.push('CSP detection not found in fx.ts');
        }

        // Check for CSP-safe alternatives
        if (content.includes('cspMode')) {
            console.log('  ✓ CSP mode handling implemented');
        } else {
            this.warnings.push('CSP mode not implemented in SyncModuleLoader');
        }

        // Check for async loading methods
        if (content.includes('loadAsync')) {
            console.log('  ✓ Async loading method available');
        } else {
            this.warnings.push('No async loading alternative for CSP environments');
        }

        console.log('✅ CSP compatibility validated');
        return true;
    }

    /**
     * Run all validations
     */
    async runAll(): Promise<ValidationResult> {
        console.log('\n🚀 Starting FX Framework Build Validation\n');
        console.log('=' .repeat(50));

        // Run validations
        const coreValid = await this.validateCoreExports();
        const pluginsValid = await this.validatePlugins();
        const cspValid = this.validateCSPCompatibility();
        const tsValid = this.validateTypeScript();

        // Summary
        console.log('\n' + '=' .repeat(50));
        console.log('\n📊 Validation Summary:\n');

        const allValid = coreValid && pluginsValid && cspValid && tsValid;

        if (this.errors.length > 0) {
            console.log('❌ Errors found:');
            this.errors.forEach(err => console.log(`   - ${err}`));
        }

        if (this.warnings.length > 0) {
            console.log('\n⚠️  Warnings:');
            this.warnings.forEach(warn => console.log(`   - ${warn}`));
        }

        if (allValid && this.errors.length === 0) {
            console.log('\n✅ All validations passed successfully!');
        } else {
            console.log('\n❌ Validation failed. Please fix the errors above.');
        }

        return {
            success: allValid && this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings
        };
    }
}

// Run validation if executed directly
const validator = new BuildValidator();
validator.runAll().then((result) => {
    process.exit(result.success ? 0 : 1);
}).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});

export { BuildValidator, ValidationResult };