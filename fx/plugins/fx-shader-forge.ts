// /plugins/fx-shader-forge.ts
/**
 * @fx-plugin fx-shader-forge
 * @fx-global $shader
 * @fx-description WebGL/WebGPU shader compilation, material management, and theme integration
 * @fx-dependencies
 * @fx-provides $shader
 * @fx-version 1.0.0
 *
 * FX Shader Forge Plugin - Manages shader programs, materials, and theme-driven uniforms
 * for the FX Dreamweaver 3D IDE rendering system.
 */

import type { FXCore, FXNodeProxy } from '../fx.v4';

// Get FXSuspend from global
const FXSuspend = (globalThis as any).FXSuspend;

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ShaderSource {
    vertex: string;
    fragment: string;
    name?: string;
}

export interface ShaderProgram {
    id: string;
    name: string;
    program: WebGLProgram | null;
    vertexShader: WebGLShader | null;
    fragmentShader: WebGLShader | null;
    uniforms: Map<string, WebGLUniformLocation>;
    attributes: Map<string, number>;
    compiled: boolean;
    error?: string;
}

export interface Material {
    id: string;
    name: string;
    shader: string; // shader program id
    uniforms: Record<string, UniformValue>;
    textures: Record<string, TextureBinding>;
    blendMode: BlendMode;
    cullFace: CullFace;
    depthTest: boolean;
    depthWrite: boolean;
}

export type UniformValue =
    | number
    | number[]
    | Float32Array
    | Int32Array
    | { type: 'color'; value: [number, number, number, number] }
    | { type: 'texture'; textureId: string };

export interface TextureBinding {
    textureId: string;
    unit: number;
    sampler?: SamplerSettings;
}

export interface SamplerSettings {
    minFilter: number;
    magFilter: number;
    wrapS: number;
    wrapT: number;
}

export type BlendMode = 'none' | 'alpha' | 'additive' | 'multiply' | 'screen';
export type CullFace = 'none' | 'front' | 'back';

export interface TextureData {
    id: string;
    name: string;
    width: number;
    height: number;
    format: 'rgba' | 'rgb' | 'alpha' | 'luminance';
    data: Uint8Array | HTMLImageElement | HTMLCanvasElement | null;
    texture: WebGLTexture | null;
    loaded: boolean;
}

export interface ThemeColors {
    primary: [number, number, number, number];
    secondary: [number, number, number, number];
    accent: [number, number, number, number];
    background: [number, number, number, number];
    surface: [number, number, number, number];
    error: [number, number, number, number];
    text: [number, number, number, number];
    textSecondary: [number, number, number, number];
}

export interface ShaderForgeConfig {
    autoCompile?: boolean;
    cacheShaders?: boolean;
    logLevel?: 'none' | 'error' | 'warn' | 'info' | 'debug';
    defaultTheme?: Partial<ThemeColors>;
}

// ============================================================================
// Built-in Shaders
// ============================================================================

const BUILTIN_SHADERS: Record<string, ShaderSource> = {
    'basic': {
        name: 'Basic',
        vertex: `
            attribute vec3 aPosition;
            attribute vec2 aTexCoord;
            attribute vec4 aColor;

            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;

            varying vec2 vTexCoord;
            varying vec4 vColor;

            void main() {
                gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
                vTexCoord = aTexCoord;
                vColor = aColor;
            }
        `,
        fragment: `
            precision mediump float;

            uniform sampler2D uTexture;
            uniform vec4 uColor;
            uniform float uOpacity;

            varying vec2 vTexCoord;
            varying vec4 vColor;

            void main() {
                vec4 texColor = texture2D(uTexture, vTexCoord);
                gl_FragColor = texColor * uColor * vColor * uOpacity;
            }
        `
    },
    'flat': {
        name: 'Flat Color',
        vertex: `
            attribute vec3 aPosition;

            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;

            void main() {
                gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
            }
        `,
        fragment: `
            precision mediump float;

            uniform vec4 uColor;

            void main() {
                gl_FragColor = uColor;
            }
        `
    },
    'panel': {
        name: 'Panel',
        vertex: `
            attribute vec3 aPosition;
            attribute vec2 aTexCoord;
            attribute vec3 aNormal;

            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;
            uniform mat3 uNormalMatrix;

            varying vec2 vTexCoord;
            varying vec3 vNormal;
            varying vec3 vPosition;

            void main() {
                vec4 worldPos = uModelViewMatrix * vec4(aPosition, 1.0);
                gl_Position = uProjectionMatrix * worldPos;
                vTexCoord = aTexCoord;
                vNormal = normalize(uNormalMatrix * aNormal);
                vPosition = worldPos.xyz;
            }
        `,
        fragment: `
            precision mediump float;

            uniform vec4 uPrimaryColor;
            uniform vec4 uSecondaryColor;
            uniform vec4 uAccentColor;
            uniform float uBorderWidth;
            uniform float uCornerRadius;
            uniform float uGlowIntensity;
            uniform float uTime;
            uniform vec2 uResolution;

            varying vec2 vTexCoord;
            varying vec3 vNormal;
            varying vec3 vPosition;

            float roundedBox(vec2 center, vec2 size, float radius) {
                vec2 q = abs(center) - size + radius;
                return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
            }

            void main() {
                vec2 uv = vTexCoord;
                vec2 center = uv - 0.5;

                // Rounded rectangle SDF
                float d = roundedBox(center, vec2(0.48), uCornerRadius);

                // Border
                float border = smoothstep(0.0, uBorderWidth, abs(d));

                // Glow effect
                float glow = exp(-abs(d) * 10.0) * uGlowIntensity;

                // Lighting
                vec3 lightDir = normalize(vec3(0.5, 0.5, 1.0));
                float diffuse = max(dot(vNormal, lightDir), 0.0);
                float ambient = 0.3;
                float lighting = ambient + diffuse * 0.7;

                // Combine colors
                vec4 baseColor = mix(uPrimaryColor, uSecondaryColor, uv.y);
                vec4 borderColor = uAccentColor;

                vec4 finalColor = mix(borderColor, baseColor, border);
                finalColor.rgb += uAccentColor.rgb * glow;
                finalColor.rgb *= lighting;

                // Clip outside rounded rect
                if (d > 0.0) discard;

                gl_FragColor = finalColor;
            }
        `
    },
    'holographic': {
        name: 'Holographic',
        vertex: `
            attribute vec3 aPosition;
            attribute vec2 aTexCoord;
            attribute vec3 aNormal;

            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;
            uniform mat3 uNormalMatrix;
            uniform float uTime;

            varying vec2 vTexCoord;
            varying vec3 vNormal;
            varying vec3 vPosition;
            varying float vScanline;

            void main() {
                vec4 worldPos = uModelViewMatrix * vec4(aPosition, 1.0);
                gl_Position = uProjectionMatrix * worldPos;
                vTexCoord = aTexCoord;
                vNormal = normalize(uNormalMatrix * aNormal);
                vPosition = worldPos.xyz;
                vScanline = aPosition.y + uTime * 0.5;
            }
        `,
        fragment: `
            precision mediump float;

            uniform vec4 uPrimaryColor;
            uniform vec4 uAccentColor;
            uniform float uTime;
            uniform float uOpacity;
            uniform float uNoiseScale;
            uniform float uScanlineIntensity;

            varying vec2 vTexCoord;
            varying vec3 vNormal;
            varying vec3 vPosition;
            varying float vScanline;

            // Simple noise function
            float noise(vec2 p) {
                return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
            }

            void main() {
                vec2 uv = vTexCoord;

                // Fresnel effect
                vec3 viewDir = normalize(-vPosition);
                float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 2.0);

                // Scanlines
                float scanline = sin(vScanline * 50.0) * 0.5 + 0.5;
                scanline = mix(1.0, scanline, uScanlineIntensity);

                // Noise
                float n = noise(uv * uNoiseScale + uTime);
                n = mix(1.0, n, 0.1);

                // Color shift based on view angle
                vec4 color = mix(uPrimaryColor, uAccentColor, fresnel);
                color.a *= uOpacity * scanline * n;
                color.rgb += fresnel * uAccentColor.rgb * 0.5;

                gl_FragColor = color;
            }
        `
    },
    'outline': {
        name: 'Outline',
        vertex: `
            attribute vec3 aPosition;
            attribute vec3 aNormal;

            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;
            uniform float uOutlineWidth;

            void main() {
                vec3 pos = aPosition + aNormal * uOutlineWidth;
                gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(pos, 1.0);
            }
        `,
        fragment: `
            precision mediump float;

            uniform vec4 uOutlineColor;

            void main() {
                gl_FragColor = uOutlineColor;
            }
        `
    },
    'grid': {
        name: 'Grid',
        vertex: `
            attribute vec3 aPosition;
            attribute vec2 aTexCoord;

            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;

            varying vec2 vTexCoord;
            varying vec3 vPosition;

            void main() {
                vec4 worldPos = uModelViewMatrix * vec4(aPosition, 1.0);
                gl_Position = uProjectionMatrix * worldPos;
                vTexCoord = aTexCoord;
                vPosition = worldPos.xyz;
            }
        `,
        fragment: `
            precision mediump float;

            uniform vec4 uGridColor;
            uniform vec4 uBackgroundColor;
            uniform float uGridSize;
            uniform float uLineWidth;
            uniform float uFadeDistance;

            varying vec2 vTexCoord;
            varying vec3 vPosition;

            void main() {
                vec2 grid = abs(fract(vPosition.xz / uGridSize - 0.5) - 0.5) / fwidth(vPosition.xz / uGridSize);
                float line = min(grid.x, grid.y);
                float alpha = 1.0 - min(line, 1.0);

                // Fade with distance
                float dist = length(vPosition.xz);
                float fade = 1.0 - smoothstep(0.0, uFadeDistance, dist);

                vec4 color = mix(uBackgroundColor, uGridColor, alpha * fade);
                color.a *= uLineWidth;

                gl_FragColor = color;
            }
        `
    }
};

// ============================================================================
// Logger
// ============================================================================

class ShaderLogger {
    private level: 'none' | 'error' | 'warn' | 'info' | 'debug' = 'info';

    setLevel(level: 'none' | 'error' | 'warn' | 'info' | 'debug') {
        this.level = level;
    }

    private shouldLog(level: string): boolean {
        const levels = ['none', 'error', 'warn', 'info', 'debug'];
        return levels.indexOf(level) <= levels.indexOf(this.level);
    }

    error(msg: string, data?: any) {
        if (this.shouldLog('error')) console.error(`[FX-SHADER:ERROR] ${msg}`, data ?? '');
    }
    warn(msg: string, data?: any) {
        if (this.shouldLog('warn')) console.warn(`[FX-SHADER:WARN] ${msg}`, data ?? '');
    }
    info(msg: string, data?: any) {
        if (this.shouldLog('info')) console.info(`[FX-SHADER:INFO] ${msg}`, data ?? '');
    }
    debug(msg: string, data?: any) {
        if (this.shouldLog('debug')) console.log(`[FX-SHADER:DEBUG] ${msg}`, data ?? '');
    }
}

// ============================================================================
// Shader Forge Plugin Class
// ============================================================================

export class FXShaderForge {
    public readonly name = 'shader-forge';
    public readonly version = '1.0.0';
    public readonly description = 'WebGL/WebGPU shader compilation and material management';

    private fx: FXCore;
    private gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
    private config: ShaderForgeConfig;
    private logger = new ShaderLogger();

    // Caches
    private shaders = new Map<string, ShaderProgram>();
    private materials = new Map<string, Material>();
    private textures = new Map<string, TextureData>();

    // Theme
    private themeColors: ThemeColors = {
        primary: [0.2, 0.4, 0.8, 1.0],
        secondary: [0.3, 0.3, 0.4, 1.0],
        accent: [0.0, 0.8, 1.0, 1.0],
        background: [0.05, 0.05, 0.1, 1.0],
        surface: [0.1, 0.1, 0.15, 1.0],
        error: [1.0, 0.3, 0.3, 1.0],
        text: [1.0, 1.0, 1.0, 1.0],
        textSecondary: [0.7, 0.7, 0.7, 1.0]
    };

    // Animation
    private time = 0;
    private animationFrame: number | null = null;

    constructor(fx: FXCore, config: ShaderForgeConfig = {}) {
        this.fx = fx;
        this.config = {
            autoCompile: true,
            cacheShaders: true,
            logLevel: 'info',
            ...config
        };

        this.logger.setLevel(this.config.logLevel!);

        // Store in FX nodes
        this.initNodes();

        // Apply default theme
        if (config.defaultTheme) {
            this.setTheme(config.defaultTheme);
        }

        this.logger.info('FX Shader Forge initialized');
    }

    // ========================================================================
    // Initialization
    // ========================================================================

    private initNodes(): void {
        const $$ = this.fx.proxy();

        // Store shader registry
        $$('ui.shaders.programs').val({});
        $$('ui.shaders.materials').val({});
        $$('ui.shaders.textures').val({});
        $$('ui.shaders.theme').val(this.themeColors);
        $$('ui.shaders.stats').val({
            programCount: 0,
            materialCount: 0,
            textureCount: 0,
            compiledCount: 0,
            errorCount: 0
        });

        // Watch theme changes
        $$('settings.themes.active').watch((theme: any) => {
            if (theme?.colors) {
                this.setTheme(theme.colors);
            }
        });
    }

    /**
     * Initialize with a WebGL context
     */
    initGL(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
        this.gl = gl;
        this.logger.info('WebGL context initialized');

        // Compile built-in shaders if autoCompile is enabled
        if (this.config.autoCompile) {
            this.compileBuiltinShaders();
        }

        // Start animation loop for time uniform
        this.startAnimationLoop();
    }

    private compileBuiltinShaders(): void {
        for (const [id, source] of Object.entries(BUILTIN_SHADERS)) {
            try {
                this.compileShader(id, source);
                this.logger.debug(`Compiled built-in shader: ${id}`);
            } catch (e) {
                this.logger.error(`Failed to compile built-in shader: ${id}`, e);
            }
        }
    }

    private startAnimationLoop(): void {
        const update = () => {
            this.time = performance.now() / 1000;
            this.animationFrame = requestAnimationFrame(update);
        };
        update();
    }

    // ========================================================================
    // Shader Compilation
    // ========================================================================

    /**
     * Compile a shader program from vertex and fragment sources
     */
    compileShader(id: string, source: ShaderSource): ShaderProgram {
        if (!this.gl) {
            throw new Error('WebGL context not initialized');
        }

        const gl = this.gl;

        // Check cache
        if (this.config.cacheShaders && this.shaders.has(id)) {
            return this.shaders.get(id)!;
        }

        const program: ShaderProgram = {
            id,
            name: source.name || id,
            program: null,
            vertexShader: null,
            fragmentShader: null,
            uniforms: new Map(),
            attributes: new Map(),
            compiled: false
        };

        try {
            // Compile vertex shader
            program.vertexShader = this.compileShaderSource(gl.VERTEX_SHADER, source.vertex);

            // Compile fragment shader
            program.fragmentShader = this.compileShaderSource(gl.FRAGMENT_SHADER, source.fragment);

            // Create and link program
            program.program = gl.createProgram()!;
            gl.attachShader(program.program, program.vertexShader);
            gl.attachShader(program.program, program.fragmentShader);
            gl.linkProgram(program.program);

            if (!gl.getProgramParameter(program.program, gl.LINK_STATUS)) {
                const error = gl.getProgramInfoLog(program.program);
                throw new Error(`Program link failed: ${error}`);
            }

            // Get uniform and attribute locations
            this.extractUniformsAndAttributes(program);

            program.compiled = true;
            this.shaders.set(id, program);
            this.updateStats();

            this.logger.info(`Shader compiled: ${id}`);

        } catch (e: any) {
            program.error = e.message;
            this.shaders.set(id, program);
            this.updateStats();
            this.logger.error(`Shader compilation failed: ${id}`, e);
            throw e;
        }

        return program;
    }

    private compileShaderSource(type: number, source: string): WebGLShader {
        const gl = this.gl!;
        const shader = gl.createShader(type)!;

        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const error = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(`Shader compile failed: ${error}`);
        }

        return shader;
    }

    private extractUniformsAndAttributes(program: ShaderProgram): void {
        const gl = this.gl!;
        const prog = program.program!;

        // Get uniforms
        const numUniforms = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < numUniforms; i++) {
            const info = gl.getActiveUniform(prog, i);
            if (info) {
                const location = gl.getUniformLocation(prog, info.name);
                if (location) {
                    program.uniforms.set(info.name, location);
                }
            }
        }

        // Get attributes
        const numAttribs = gl.getProgramParameter(prog, gl.ACTIVE_ATTRIBUTES);
        for (let i = 0; i < numAttribs; i++) {
            const info = gl.getActiveAttrib(prog, i);
            if (info) {
                const location = gl.getAttribLocation(prog, info.name);
                program.attributes.set(info.name, location);
            }
        }
    }

    // ========================================================================
    // Material Management
    // ========================================================================

    /**
     * Create a new material
     */
    createMaterial(id: string, config: Partial<Material> & { shader: string }): Material {
        const material: Material = {
            id,
            name: config.name || id,
            shader: config.shader,
            uniforms: config.uniforms || {},
            textures: config.textures || {},
            blendMode: config.blendMode || 'alpha',
            cullFace: config.cullFace || 'back',
            depthTest: config.depthTest ?? true,
            depthWrite: config.depthWrite ?? true
        };

        this.materials.set(id, material);
        this.updateStats();
        this.logger.debug(`Material created: ${id}`);

        return material;
    }

    /**
     * Get a material by ID
     */
    getMaterial(id: string): Material | undefined {
        return this.materials.get(id);
    }

    /**
     * Update material uniforms
     */
    updateMaterial(id: string, uniforms: Record<string, UniformValue>): void {
        const material = this.materials.get(id);
        if (material) {
            Object.assign(material.uniforms, uniforms);
        }
    }

    /**
     * Apply a material for rendering
     */
    useMaterial(id: string): void {
        if (!this.gl) return;

        const material = this.materials.get(id);
        if (!material) {
            this.logger.warn(`Material not found: ${id}`);
            return;
        }

        const program = this.shaders.get(material.shader);
        if (!program || !program.compiled) {
            this.logger.warn(`Shader not compiled: ${material.shader}`);
            return;
        }

        const gl = this.gl;

        // Use program
        gl.useProgram(program.program);

        // Apply blend mode
        this.applyBlendMode(material.blendMode);

        // Apply cull face
        this.applyCullFace(material.cullFace);

        // Apply depth settings
        if (material.depthTest) {
            gl.enable(gl.DEPTH_TEST);
        } else {
            gl.disable(gl.DEPTH_TEST);
        }
        gl.depthMask(material.depthWrite);

        // Set uniforms
        this.setMaterialUniforms(program, material);

        // Bind textures
        this.bindMaterialTextures(program, material);
    }

    private applyBlendMode(mode: BlendMode): void {
        const gl = this.gl!;

        switch (mode) {
            case 'none':
                gl.disable(gl.BLEND);
                break;
            case 'alpha':
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                break;
            case 'additive':
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
                break;
            case 'multiply':
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.DST_COLOR, gl.ZERO);
                break;
            case 'screen':
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
                break;
        }
    }

    private applyCullFace(cull: CullFace): void {
        const gl = this.gl!;

        switch (cull) {
            case 'none':
                gl.disable(gl.CULL_FACE);
                break;
            case 'front':
                gl.enable(gl.CULL_FACE);
                gl.cullFace(gl.FRONT);
                break;
            case 'back':
                gl.enable(gl.CULL_FACE);
                gl.cullFace(gl.BACK);
                break;
        }
    }

    private setMaterialUniforms(program: ShaderProgram, material: Material): void {
        const gl = this.gl!;

        // Set time uniform
        const timeLocation = program.uniforms.get('uTime');
        if (timeLocation) {
            gl.uniform1f(timeLocation, this.time);
        }

        // Set theme uniforms
        this.setThemeUniforms(program);

        // Set material uniforms
        for (const [name, value] of Object.entries(material.uniforms)) {
            const location = program.uniforms.get(name);
            if (!location) continue;

            if (typeof value === 'number') {
                gl.uniform1f(location, value);
            } else if (Array.isArray(value)) {
                switch (value.length) {
                    case 2: gl.uniform2fv(location, value); break;
                    case 3: gl.uniform3fv(location, value); break;
                    case 4: gl.uniform4fv(location, value); break;
                    case 9: gl.uniformMatrix3fv(location, false, value); break;
                    case 16: gl.uniformMatrix4fv(location, false, value); break;
                }
            } else if (value instanceof Float32Array) {
                switch (value.length) {
                    case 2: gl.uniform2fv(location, value); break;
                    case 3: gl.uniform3fv(location, value); break;
                    case 4: gl.uniform4fv(location, value); break;
                    case 9: gl.uniformMatrix3fv(location, false, value); break;
                    case 16: gl.uniformMatrix4fv(location, false, value); break;
                }
            } else if (typeof value === 'object' && 'type' in value) {
                if (value.type === 'color') {
                    gl.uniform4fv(location, value.value);
                }
            }
        }
    }

    private setThemeUniforms(program: ShaderProgram): void {
        const gl = this.gl!;

        const themeUniforms: Record<string, keyof ThemeColors> = {
            'uPrimaryColor': 'primary',
            'uSecondaryColor': 'secondary',
            'uAccentColor': 'accent',
            'uBackgroundColor': 'background',
            'uSurfaceColor': 'surface',
            'uErrorColor': 'error',
            'uTextColor': 'text',
            'uTextSecondaryColor': 'textSecondary'
        };

        for (const [uniformName, themeKey] of Object.entries(themeUniforms)) {
            const location = program.uniforms.get(uniformName);
            if (location) {
                gl.uniform4fv(location, this.themeColors[themeKey]);
            }
        }
    }

    private bindMaterialTextures(program: ShaderProgram, material: Material): void {
        const gl = this.gl!;

        for (const [name, binding] of Object.entries(material.textures)) {
            const texture = this.textures.get(binding.textureId);
            if (!texture || !texture.texture) continue;

            const location = program.uniforms.get(name);
            if (!location) continue;

            gl.activeTexture(gl.TEXTURE0 + binding.unit);
            gl.bindTexture(gl.TEXTURE_2D, texture.texture);
            gl.uniform1i(location, binding.unit);
        }
    }

    // ========================================================================
    // Texture Management
    // ========================================================================

    /**
     * Create a texture from image data
     */
    createTexture(id: string, config: {
        width: number;
        height: number;
        format?: 'rgba' | 'rgb' | 'alpha' | 'luminance';
        data?: Uint8Array;
        image?: HTMLImageElement;
        canvas?: HTMLCanvasElement;
    }): TextureData {
        const textureData: TextureData = {
            id,
            name: id,
            width: config.width,
            height: config.height,
            format: config.format || 'rgba',
            data: config.data || null,
            texture: null,
            loaded: false
        };

        if (this.gl) {
            textureData.texture = this.createGLTexture(textureData, config);
            textureData.loaded = true;
        }

        this.textures.set(id, textureData);
        this.updateStats();

        return textureData;
    }

    private createGLTexture(textureData: TextureData, config: any): WebGLTexture {
        const gl = this.gl!;
        const texture = gl.createTexture()!;

        gl.bindTexture(gl.TEXTURE_2D, texture);

        // Set parameters
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        const format = this.getGLFormat(textureData.format);

        if (config.image) {
            gl.texImage2D(gl.TEXTURE_2D, 0, format, format, gl.UNSIGNED_BYTE, config.image);
        } else if (config.canvas) {
            gl.texImage2D(gl.TEXTURE_2D, 0, format, format, gl.UNSIGNED_BYTE, config.canvas);
        } else if (config.data) {
            gl.texImage2D(gl.TEXTURE_2D, 0, format, textureData.width, textureData.height, 0, format, gl.UNSIGNED_BYTE, config.data);
        } else {
            // Create empty texture
            gl.texImage2D(gl.TEXTURE_2D, 0, format, textureData.width, textureData.height, 0, format, gl.UNSIGNED_BYTE, null);
        }

        return texture;
    }

    private getGLFormat(format: string): number {
        const gl = this.gl!;
        switch (format) {
            case 'rgb': return gl.RGB;
            case 'alpha': return gl.ALPHA;
            case 'luminance': return gl.LUMINANCE;
            default: return gl.RGBA;
        }
    }

    /**
     * Load a texture from URL
     */
    loadTexture(id: string, url: string): TextureData {
        const textureData: TextureData = {
            id,
            name: id,
            width: 1,
            height: 1,
            format: 'rgba',
            data: null,
            texture: null,
            loaded: false
        };

        if (this.gl) {
            // Create placeholder texture
            textureData.texture = this.createGLTexture(textureData, {
                data: new Uint8Array([255, 255, 255, 255])
            });

            // Load image
            const image = new Image();
            image.crossOrigin = 'anonymous';
            image.onload = () => {
                textureData.width = image.width;
                textureData.height = image.height;

                const gl = this.gl!;
                gl.bindTexture(gl.TEXTURE_2D, textureData.texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                gl.generateMipmap(gl.TEXTURE_2D);

                textureData.loaded = true;
                this.logger.debug(`Texture loaded: ${id}`);
            };
            image.onerror = () => {
                this.logger.error(`Failed to load texture: ${id}`, url);
            };
            image.src = url;
        }

        this.textures.set(id, textureData);
        this.updateStats();

        return textureData;
    }

    // ========================================================================
    // Theme Management
    // ========================================================================

    /**
     * Set theme colors
     */
    setTheme(colors: Partial<ThemeColors>): void {
        Object.assign(this.themeColors, colors);

        // Update FX node
        const $$ = this.fx.proxy();
        $$('ui.shaders.theme').val(this.themeColors);

        this.logger.debug('Theme updated');
    }

    /**
     * Get current theme colors
     */
    getTheme(): ThemeColors {
        return { ...this.themeColors };
    }

    /**
     * Convert hex color to RGBA array
     */
    hexToRGBA(hex: string, alpha: number = 1): [number, number, number, number] {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            return [
                parseInt(result[1], 16) / 255,
                parseInt(result[2], 16) / 255,
                parseInt(result[3], 16) / 255,
                alpha
            ];
        }
        return [1, 1, 1, alpha];
    }

    // ========================================================================
    // Getters & Utilities
    // ========================================================================

    /**
     * Get a shader program by ID
     */
    getShader(id: string): ShaderProgram | undefined {
        return this.shaders.get(id);
    }

    /**
     * Get all shader IDs
     */
    getShaderIds(): string[] {
        return Array.from(this.shaders.keys());
    }

    /**
     * Get all material IDs
     */
    getMaterialIds(): string[] {
        return Array.from(this.materials.keys());
    }

    /**
     * Get all texture IDs
     */
    getTextureIds(): string[] {
        return Array.from(this.textures.keys());
    }

    /**
     * Delete a shader program
     */
    deleteShader(id: string): void {
        const program = this.shaders.get(id);
        if (program && this.gl) {
            if (program.program) this.gl.deleteProgram(program.program);
            if (program.vertexShader) this.gl.deleteShader(program.vertexShader);
            if (program.fragmentShader) this.gl.deleteShader(program.fragmentShader);
        }
        this.shaders.delete(id);
        this.updateStats();
    }

    /**
     * Delete a material
     */
    deleteMaterial(id: string): void {
        this.materials.delete(id);
        this.updateStats();
    }

    /**
     * Delete a texture
     */
    deleteTexture(id: string): void {
        const texture = this.textures.get(id);
        if (texture && texture.texture && this.gl) {
            this.gl.deleteTexture(texture.texture);
        }
        this.textures.delete(id);
        this.updateStats();
    }

    private updateStats(): void {
        const $$ = this.fx.proxy();
        $$('ui.shaders.stats').val({
            programCount: this.shaders.size,
            materialCount: this.materials.size,
            textureCount: this.textures.size,
            compiledCount: Array.from(this.shaders.values()).filter(s => s.compiled).length,
            errorCount: Array.from(this.shaders.values()).filter(s => s.error).length
        });
    }

    /**
     * Get current time for shaders
     */
    getTime(): number {
        return this.time;
    }

    /**
     * Dispose all resources
     */
    dispose(): void {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        // Delete all shaders
        for (const id of this.shaders.keys()) {
            this.deleteShader(id);
        }

        // Delete all textures
        for (const id of this.textures.keys()) {
            this.deleteTexture(id);
        }

        this.materials.clear();
        this.gl = null;

        this.logger.info('FX Shader Forge disposed');
    }
}

// ============================================================================
// Plugin Export
// ============================================================================

export default function(fx: FXCore, config: ShaderForgeConfig = {}): FXShaderForge {
    return new FXShaderForge(fx, config);
}
