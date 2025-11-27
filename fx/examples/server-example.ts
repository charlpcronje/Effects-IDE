// /examples/server-example.ts
/**
 * @example FX Server with Manifest-based Lazy Loading
 * @description Complete example showing how to use FX Server with lazy-loaded plugins
 */

import { fx, $$ } from '../fx';
import type { FXContext } from '../plugins/fx-server';

/**
 * Example 1: Basic Server with Routes
 */
async function basicServerExample() {
    console.log('=== Basic FX Server Example ===\n');

    // The $server plugin is lazy-loaded from .fxrc.json
    const server = $server.create({
        port: 3000,
        host: 'localhost',
        cors: true
    });

    // Add a simple route
    server.get('/', (ctx: FXContext) => {
        ctx.response.json({
            message: 'Welcome to FX Server!',
            timestamp: new Date().toISOString()
        });
    });

    // Route with parameters
    server.get('/users/:id', (ctx: FXContext) => {
        const userId = ctx.params.get('id').val();
        ctx.response.json({
            user: {
                id: userId,
                name: `User ${userId}`,
                email: `user${userId}@example.com`
            }
        });
    });

    // POST route with body parsing
    server.post('/users', async (ctx: FXContext) => {
        const body = ctx.request.body.val();

        // Validate using lazy-loaded validators module
        const validators = $$('modules.validators');
        const validator = validators.createValidator({
            name: { required: true, type: 'string', minLength: 3 },
            email: { required: true, email: true }
        });

        const validation = validator(body);
        if (!validation.valid) {
            ctx.response.status(400).json({
                error: 'Validation failed',
                errors: validation.errors
            });
            return;
        }

        // Create user (simulated)
        const newUser = {
            id: Date.now(),
            ...body,
            createdAt: new Date().toISOString()
        };

        ctx.response.status(201).json(newUser);
    });

    // Start the server
    await server.listen(() => {
        console.log('Server started successfully!');
    });

    return server;
}

/**
 * Example 2: Server with Middleware and FX Nodes
 */
async function advancedServerExample() {
    console.log('\n=== Advanced FX Server Example ===\n');

    const server = $server.create({
        port: 3001,
        cors: {
            origin: ['http://localhost:3000', 'http://localhost:5173'],
            credentials: true
        },
        maxBodySize: 10 * 1024 * 1024 // 10MB
    });

    // Create FX nodes for application state
    const $appState = $$('app.state');
    $appState.val({
        requests: 0,
        users: new Map(),
        sessions: new Map()
    });

    // Request counting middleware
    server.use(async (ctx: FXContext) => {
        const state = $appState.val();
        state.requests++;
        $appState.val(state);

        // Log using FX node
        $$(`app.logs.request.${state.requests}`).val({
            method: ctx.request.method.val(),
            path: ctx.request.path.val(),
            timestamp: Date.now()
        });

        await ctx.next();
    });

    // Authentication middleware
    server.use(async (ctx: FXContext) => {
        const authHeader = ctx.request.headers.get('authorization').val();

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            const state = $appState.val();
            const session = state.sessions.get(token);

            if (session) {
                ctx.state.set('user', session.user);
                ctx.state.set('authenticated', true);
            }
        }

        await ctx.next();
    });

    // Protected route
    server.get('/api/profile', (ctx: FXContext) => {
        if (!ctx.state.get('authenticated').val()) {
            ctx.response.status(401).json({
                error: 'Unauthorized'
            });
            return;
        }

        const user = ctx.state.get('user').val();
        ctx.response.json({ profile: user });
    });

    // Login route
    server.post('/api/login', async (ctx: FXContext) => {
        const { username, password } = ctx.request.body.val();

        // Simple auth check (in production, use proper auth)
        if (username === 'admin' && password === 'password') {
            const token = Math.random().toString(36).substr(2);
            const state = $appState.val();

            state.sessions.set(token, {
                user: { id: 1, username },
                createdAt: Date.now()
            });

            $appState.val(state);

            ctx.response.json({
                token,
                user: { id: 1, username }
            });
        } else {
            ctx.response.status(401).json({
                error: 'Invalid credentials'
            });
        }
    });

    // WebSocket endpoint
    server.ws('/ws', (ws: any) => {
        console.log('WebSocket connected');

        ws.on('message', (message: string) => {
            // Echo the message back
            ws.send(`Echo: ${message}`);

            // Store in FX node
            $$('app.websocket.messages').set(Date.now(), message);
        });
    });

    return server;
}

/**
 * Example 3: Server with Database Integration
 */
async function databaseServerExample() {
    console.log('\n=== Database Integration Example ===\n');

    const server = $server.create({ port: 3002 });

    // The $db plugin is lazy-loaded from .fxrc.json
    // It will only be loaded when first accessed
    server.get('/api/products', async (ctx: FXContext) => {
        try {
            // This triggers lazy loading of fx-orm plugin
            const db = $db;

            // Use the ORM (simulated - actual implementation would connect to real DB)
            const products = await db.model('Product').findAll({
                where: ctx.query.val(),
                limit: 20
            });

            ctx.response.json({
                products,
                total: products.length
            });
        } catch (error) {
            ctx.response.status(500).json({
                error: 'Database error',
                message: error.message
            });
        }
    });

    // Using lazy-loaded cache plugin
    server.get('/api/cached/:key', async (ctx: FXContext) => {
        const key = ctx.params.get('key').val();

        // This triggers lazy loading of fx-cache plugin
        const cache = $cache;

        let value = cache.get(key);

        if (!value) {
            // Simulate expensive operation
            value = {
                key,
                data: `Generated data for ${key}`,
                timestamp: Date.now()
            };

            cache.set(key, value, { ttl: 3600 });
        }

        ctx.response.json(value);
    });

    return server;
}

/**
 * Example 4: Using Router Groups
 */
async function routerGroupExample() {
    console.log('\n=== Router Groups Example ===\n');

    const server = $server.create({ port: 3003 });

    // Import Router class
    const { Router } = await import('../plugins/fx-server');

    // Create API v1 router
    const v1 = new Router('/api/v1');

    v1.get('/status', (ctx: FXContext) => {
        ctx.response.json({
            version: '1.0.0',
            status: 'healthy'
        });
    });

    v1.get('/users', (ctx: FXContext) => {
        ctx.response.json({
            users: [
                { id: 1, name: 'Alice' },
                { id: 2, name: 'Bob' }
            ]
        });
    });

    // Create API v2 router
    const v2 = new Router('/api/v2');

    v2.get('/status', (ctx: FXContext) => {
        ctx.response.json({
            version: '2.0.0',
            status: 'healthy',
            features: ['pagination', 'filtering', 'sorting']
        });
    });

    // Mount routers
    v1.mount(server);
    v2.mount(server);

    // Admin routes with middleware
    const adminAuth = async (ctx: FXContext) => {
        const isAdmin = ctx.request.headers.get('x-admin-key').val() === 'secret';

        if (!isAdmin) {
            ctx.response.status(403).json({ error: 'Forbidden' });
            return;
        }

        await ctx.next();
    };

    server.get('/admin/stats', adminAuth, (ctx: FXContext) => {
        const stats = $$('server.stats').val();
        ctx.response.json(stats);
    });

    return server;
}

/**
 * Example 5: Static File Serving and SPA
 */
async function staticServerExample() {
    console.log('\n=== Static File Server Example ===\n');

    const server = $server.create({
        port: 3004,
        staticDir: './public',
        staticPrefix: '/static'
    });

    // Serve static files from /static/*
    server.static('/static', './public');

    // API routes
    server.get('/api/config', (ctx: FXContext) => {
        ctx.response.json({
            appName: 'FX Application',
            version: '1.0.0',
            features: ['reactive', 'lazy-loading', 'fx-nodes']
        });
    });

    // Catch-all for SPA routing
    server.get('*', (ctx: FXContext) => {
        ctx.response.html(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>FX Application</title>
                <script src="/static/app.js"></script>
            </head>
            <body>
                <div id="app"></div>
                <script>
                    // FX application would be initialized here
                    console.log('FX SPA loaded');
                </script>
            </body>
            </html>
        `);
    });

    return server;
}

/**
 * Main function to run examples
 */
async function main() {
    console.log('FX Server Examples\n');
    console.log('==================\n');

    // Check if manifest is loaded
    const manifest = fx.pluginManager.getManifest();
    if (manifest) {
        console.log('Manifest loaded successfully!');
        console.log('Configured plugins:', Object.keys(manifest.plugins || {}));
        console.log('Configured modules:', Object.keys(manifest.modules || {}));
        console.log('');
    }

    // Run examples based on command line argument
    const example = process.argv[2] || 'basic';

    switch (example) {
        case 'basic':
            await basicServerExample();
            break;
        case 'advanced':
            await advancedServerExample();
            break;
        case 'database':
            await databaseServerExample();
            break;
        case 'router':
            await routerGroupExample();
            break;
        case 'static':
            await staticServerExample();
            break;
        case 'all':
            // Run all examples on different ports
            await Promise.all([
                basicServerExample(),
                advancedServerExample(),
                databaseServerExample(),
                routerGroupExample(),
                staticServerExample()
            ]);
            break;
        default:
            console.log('Unknown example:', example);
            console.log('Available examples: basic, advanced, database, router, static, all');
    }
}

// Run if executed directly
if (require.main === module) {
    main().catch(console.error);
}

// Export for testing
export {
    basicServerExample,
    advancedServerExample,
    databaseServerExample,
    routerGroupExample,
    staticServerExample
};