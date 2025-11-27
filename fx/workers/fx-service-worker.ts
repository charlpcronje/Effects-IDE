/**
 * FX Service Worker - Module Proxy & Offline Support
 *
 * Provides:
 * - Cross-origin module loading proxy
 * - Module caching for offline use
 * - CORS handling
 * - Integration with fx-scout module loader
 *
 * @version 1.0.0
 */

declare const self: ServiceWorkerGlobalScope;

// Configuration
const CACHE_VERSION = 'fx-cache-v1';
const MODULE_CACHE = 'fx-modules-v1';
const API_CACHE = 'fx-api-v1';
const OFFLINE_CACHE = 'fx-offline-v1';

// Core FX modules to pre-cache
const CORE_MODULES = [
  '/fx/fx.ts',
  '/fx/plugins/fx-scout.ts',
  '/fx/plugins/fx-orm.ts',
  '/fx/plugins/fx-flow.ts',
  '/fx/plugins/fx-api.ts',
  '/fx/plugins/workers/fx-scout-worker.ts',
];

// Allowed proxy origins (configure as needed)
const ALLOWED_ORIGINS = [
  'https://unpkg.com',
  'https://cdn.jsdelivr.net',
  'https://esm.sh',
  'https://cdn.skypack.dev',
  'https://jspm.dev',
];

/**
 * Service Worker Installation
 * Pre-cache core FX modules
 */
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil((async () => {
    const cache = await caches.open(MODULE_CACHE);

    // Try to cache core modules, but don't fail if some are missing
    const cachePromises = CORE_MODULES.map(async (url) => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
          console.log(`[FX-SW] Cached: ${url}`);
        }
      } catch (error) {
        console.warn(`[FX-SW] Failed to cache: ${url}`, error);
      }
    });

    await Promise.allSettled(cachePromises);

    // Skip waiting to activate immediately
    await self.skipWaiting();
  })());
});

/**
 * Service Worker Activation
 * Clean up old caches
 */
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil((async () => {
    // Clean up old cache versions
    const cacheNames = await caches.keys();
    const deletePromises = cacheNames
      .filter(name => name.startsWith('fx-') && ![CACHE_VERSION, MODULE_CACHE, API_CACHE, OFFLINE_CACHE].includes(name))
      .map(name => caches.delete(name));

    await Promise.all(deletePromises);

    // Take control of all clients immediately
    await self.clients.claim();
    console.log('[FX-SW] Activated and ready');
  })());
});

/**
 * Fetch Event Handler
 * Intercept and handle various request types
 */
self.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url);

  // Handle /fx/proxy requests (cross-origin proxy)
  if (url.pathname === '/fx/proxy' || url.pathname.startsWith('/fx/proxy/')) {
    event.respondWith(handleProxyRequest(event.request));
    return;
  }

  // Handle /fx/module requests (module loading)
  if (url.pathname.startsWith('/fx/module/')) {
    event.respondWith(handleModuleRequest(event.request));
    return;
  }

  // Handle /fx/api requests (API proxy with caching)
  if (url.pathname.startsWith('/fx/api/')) {
    event.respondWith(handleAPIRequest(event.request));
    return;
  }

  // Handle FX module requests (.ts, .js files in /fx/)
  if (url.pathname.startsWith('/fx/') && (url.pathname.endsWith('.ts') || url.pathname.endsWith('.js'))) {
    event.respondWith(handleFXModuleRequest(event.request));
    return;
  }

  // Pass through other requests with offline fallback
  event.respondWith(handleGeneralRequest(event.request));
});

/**
 * Handle cross-origin proxy requests
 * Bypasses CORS restrictions for module loading
 */
async function handleProxyRequest(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);

    // Extract target URL from query parameter or request body
    let targetUrl: string | null = url.searchParams.get('url');

    if (!targetUrl && request.method === 'POST') {
      try {
        const body = await request.json();
        targetUrl = body.url;
      } catch {
        // Not JSON, try as form data
        const formData = await request.formData();
        targetUrl = formData.get('url') as string;
      }
    }

    if (!targetUrl) {
      return new Response('Missing target URL', { status: 400 });
    }

    // Validate target URL
    const targetUrlObj = new URL(targetUrl);

    // Check if origin is allowed (optional security measure)
    const isAllowed = ALLOWED_ORIGINS.some(origin => targetUrl!.startsWith(origin)) ||
                     targetUrlObj.origin === self.location.origin;

    if (!isAllowed && !url.searchParams.has('force')) {
      return new Response(`Origin not allowed: ${targetUrlObj.origin}`, { status: 403 });
    }

    // Check cache first
    const cacheKey = `proxy:${targetUrl}`;
    const cache = await caches.open(API_CACHE);
    const cachedResponse = await cache.match(cacheKey);

    if (cachedResponse) {
      return cachedResponse;
    }

    // Fetch from target
    const proxyResponse = await fetch(targetUrl, {
      method: request.method === 'POST' && request.body ? 'POST' : 'GET',
      headers: {
        'Accept': request.headers.get('Accept') || '*/*',
        'User-Agent': 'FX-ServiceWorker/1.0',
      },
      body: request.method === 'POST' && request.body ? request.body : undefined,
    });

    // Clone response for caching
    const responseToCache = proxyResponse.clone();

    // Create CORS-enabled response
    const corsHeaders = new Headers(proxyResponse.headers);
    corsHeaders.set('Access-Control-Allow-Origin', '*');
    corsHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    corsHeaders.set('Access-Control-Allow-Headers', '*');

    const corsResponse = new Response(proxyResponse.body, {
      status: proxyResponse.status,
      statusText: proxyResponse.statusText,
      headers: corsHeaders,
    });

    // Cache successful responses
    if (proxyResponse.ok) {
      await cache.put(cacheKey, responseToCache);
    }

    return corsResponse;

  } catch (error) {
    console.error('[FX-SW] Proxy error:', error);
    return new Response(`Proxy error: ${error}`, { status: 500 });
  }
}

/**
 * Handle module loading requests
 * Supports dynamic module imports with transformation
 */
async function handleModuleRequest(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const modulePath = url.pathname.replace('/fx/module/', '');

    // Check cache first
    const cache = await caches.open(MODULE_CACHE);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // Determine actual module URL
    let moduleUrl: string;

    // Handle npm-style module paths (e.g., "react", "lodash/debounce")
    if (!modulePath.startsWith('http')) {
      // Try to resolve from common CDNs
      moduleUrl = `https://esm.sh/${modulePath}`;
    } else {
      moduleUrl = modulePath;
    }

    // Fetch module
    const moduleResponse = await fetch(moduleUrl);

    if (!moduleResponse.ok) {
      throw new Error(`Failed to fetch module: ${moduleResponse.status}`);
    }

    // Transform module content if needed
    let moduleContent = await moduleResponse.text();

    // Basic import transformation (convert bare imports to full URLs)
    moduleContent = transformModuleImports(moduleContent, moduleUrl);

    // Create response with proper headers
    const transformedResponse = new Response(moduleContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=31536000',
      },
    });

    // Cache the transformed module
    await cache.put(request, transformedResponse.clone());

    return transformedResponse;

  } catch (error) {
    console.error('[FX-SW] Module loading error:', error);
    return new Response(`Module loading error: ${error}`, { status: 500 });
  }
}

/**
 * Transform module imports to absolute URLs
 */
function transformModuleImports(content: string, baseUrl: string): string {
  // Transform bare imports (e.g., import x from 'react')
  content = content.replace(
    /import\s+(.*?)\s+from\s+['"]([^'"]+)['"]/g,
    (match, imports, specifier) => {
      if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('http')) {
        // Relative or absolute imports - resolve relative to base URL
        if (specifier.startsWith('.')) {
          const resolved = new URL(specifier, baseUrl).href;
          return `import ${imports} from '${resolved}'`;
        }
        return match;
      }
      // Bare import - use ESM CDN
      return `import ${imports} from 'https://esm.sh/${specifier}'`;
    }
  );

  // Transform dynamic imports
  content = content.replace(
    /import\(['"]([^'"]+)['"]\)/g,
    (match, specifier) => {
      if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('http')) {
        if (specifier.startsWith('.')) {
          const resolved = new URL(specifier, baseUrl).href;
          return `import('${resolved}')`;
        }
        return match;
      }
      return `import('https://esm.sh/${specifier}')`;
    }
  );

  return content;
}

/**
 * Handle API requests with caching
 */
async function handleAPIRequest(request: Request): Promise<Response> {
  try {
    const cache = await caches.open(API_CACHE);

    // For GET requests, check cache first
    if (request.method === 'GET') {
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        // Check if cache is still fresh (optional)
        const cacheAge = Date.now() - (cachedResponse.headers.get('X-Cache-Time') ?
          parseInt(cachedResponse.headers.get('X-Cache-Time')!) : 0);

        // Cache for 5 minutes
        if (cacheAge < 5 * 60 * 1000) {
          return cachedResponse;
        }
      }
    }

    // Fetch from network
    const response = await fetch(request);

    // Cache successful GET responses
    if (request.method === 'GET' && response.ok) {
      const responseToCache = response.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set('X-Cache-Time', Date.now().toString());

      const cacheResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers,
      });

      await cache.put(request, cacheResponse);
    }

    return response;

  } catch (error) {
    console.error('[FX-SW] API request error:', error);

    // Try to return cached version on network error
    if (request.method === 'GET') {
      const cache = await caches.open(API_CACHE);
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        console.log('[FX-SW] Serving stale cache due to network error');
        return cachedResponse;
      }
    }

    return new Response(`API request failed: ${error}`, { status: 503 });
  }
}

/**
 * Handle FX module requests
 */
async function handleFXModuleRequest(request: Request): Promise<Response> {
  try {
    const cache = await caches.open(MODULE_CACHE);

    // Check cache first
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Fetch from network
    const response = await fetch(request);

    // Cache successful responses
    if (response.ok) {
      await cache.put(request, response.clone());
    }

    return response;

  } catch (error) {
    console.error('[FX-SW] FX module request error:', error);

    // Try offline cache
    const cache = await caches.open(MODULE_CACHE);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    return new Response(`Module not available offline: ${request.url}`, { status: 503 });
  }
}

/**
 * Handle general requests with offline support
 */
async function handleGeneralRequest(request: Request): Promise<Response> {
  try {
    // Try network first
    const response = await fetch(request);

    // Cache successful responses for offline use
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(OFFLINE_CACHE);
      await cache.put(request, response.clone());
    }

    return response;

  } catch (error) {
    // Network failed, try cache
    const cache = await caches.open(OFFLINE_CACHE);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      console.log('[FX-SW] Serving from offline cache:', request.url);
      return cachedResponse;
    }

    // Return offline page if available
    if (request.mode === 'navigate') {
      const offlineResponse = await cache.match('/offline.html');
      if (offlineResponse) {
        return offlineResponse;
      }
    }

    return new Response('Network error and no cached version available', { status: 503 });
  }
}

/**
 * Message handler for communication with clients
 */
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const { type, data } = event.data;

  switch (type) {
    case 'CLEAR_CACHE':
      event.waitUntil(clearCache(data?.cacheName));
      break;

    case 'CACHE_MODULES':
      event.waitUntil(cacheModules(data?.modules || []));
      break;

    case 'GET_CACHE_STATUS':
      event.waitUntil(sendCacheStatus(event));
      break;

    default:
      console.warn('[FX-SW] Unknown message type:', type);
  }
});

/**
 * Clear specified cache or all caches
 */
async function clearCache(cacheName?: string): Promise<void> {
  if (cacheName) {
    await caches.delete(cacheName);
    console.log(`[FX-SW] Cleared cache: ${cacheName}`);
  } else {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('[FX-SW] Cleared all caches');
  }
}

/**
 * Cache specified modules
 */
async function cacheModules(modules: string[]): Promise<void> {
  const cache = await caches.open(MODULE_CACHE);

  const cachePromises = modules.map(async (url) => {
    try {
      const response = await fetch(url);
      if (response.ok) {
        await cache.put(url, response);
        console.log(`[FX-SW] Cached module: ${url}`);
      }
    } catch (error) {
      console.error(`[FX-SW] Failed to cache module: ${url}`, error);
    }
  });

  await Promise.allSettled(cachePromises);
}

/**
 * Send cache status to client
 */
async function sendCacheStatus(event: ExtendableMessageEvent): Promise<void> {
  const cacheNames = await caches.keys();
  const status: Record<string, number> = {};

  for (const name of cacheNames) {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    status[name] = keys.length;
  }

  event.ports[0].postMessage({
    type: 'CACHE_STATUS',
    data: status,
  });
}

// Export types for TypeScript
export type ServiceWorkerMessageType =
  | 'CLEAR_CACHE'
  | 'CACHE_MODULES'
  | 'GET_CACHE_STATUS';

export interface ServiceWorkerMessage {
  type: ServiceWorkerMessageType;
  data?: any;
}