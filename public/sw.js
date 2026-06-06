/**
 * DreamVault Service Worker
 * Strategy:
 *  - App shell (HTML / JS / CSS / fonts / images): Cache-first with network update
 *  - Supabase API & auth calls: Network-only (never cache sensitive data)
 *  - Everything else: Network-first with cache fallback
 *
 * Cache versioning: bump SHELL_VERSION when deploying a new build.
 */

const SHELL_VERSION   = 'dreamvault-shell-v3';
const RUNTIME_VERSION = 'dreamvault-runtime-v3';

// Resources that make up the app shell — pre-cached on install
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/icons.svg',
  '/offline.html',
];

// Patterns that must NEVER be cached (auth tokens, encrypted data, realtime)
const BYPASS_PATTERNS = [
  /supabase\.co/,
  /\.supabase\./,
  /chrome-extension/,
  /\/rest\/v1\//,
  /\/auth\/v1\//,
  /\/realtime\//,
  /\/storage\/v1\//,
];

function shouldBypass(url) {
  return BYPASS_PATTERNS.some((p) => p.test(url));
}

// ── Install: pre-cache app shell ─────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_VERSION).then((cache) =>
      cache.addAll(SHELL_ASSETS).catch((err) => {
        console.warn('[SW] Shell pre-cache partial failure:', err);
      })
    )
  );
  // Activate immediately without waiting for old tabs to close
  self.skipWaiting();
});

// ── Activate: clean up old caches ────────────────────────────────────────
self.addEventListener('activate', (event) => {
  const keep = [SHELL_VERSION, RUNTIME_VERSION];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !keep.includes(k)).map((k) => {
          console.info('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: routing logic ─────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Skip non-GET and bypassed origins
  if (request.method !== 'GET' || shouldBypass(url)) return;

  // Navigation requests — serve app shell (SPA)
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithShellFallback(request));
    return;
  }

  // App shell assets — cache-first
  if (isShellAsset(url)) {
    event.respondWith(cacheFirst(request, SHELL_VERSION));
    return;
  }

  // Google Fonts & external static resources — cache-first (long-lived)
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    event.respondWith(cacheFirst(request, RUNTIME_VERSION));
    return;
  }

  // DiceBear avatar SVGs — cache-first (they are deterministic)
  if (url.includes('dicebear.com')) {
    event.respondWith(cacheFirst(request, RUNTIME_VERSION));
    return;
  }

  // Default: network-first with runtime cache fallback
  event.respondWith(networkFirst(request, RUNTIME_VERSION));
});

// ── Cache strategies ─────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return offlineFallback(request);
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached ?? offlineFallback(request);
  }
}

async function networkFirstWithShellFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match('/index.html');
    return cached ?? offlineFallback(request);
  }
}

function isShellAsset(url) {
  return SHELL_ASSETS.some((path) => url.endsWith(path) || url.includes(path));
}

function offlineFallback(request) {
  if (request.headers.get('accept')?.includes('text/html')) {
    return caches.match('/offline.html');
  }
  return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
}

// ── Background Sync (best-effort) ────────────────────────────────────────
// The actual sync logic lives in syncService.ts (in-page).
// This handler fires when connectivity is restored while the app is in background.
self.addEventListener('sync', (event) => {
  if (event.tag === 'dreamvault-sync') {
    // Post a message to the open client so it can run the in-page sync
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'SW_SYNC_REQUEST' }));
      })
    );
  }
});

// ── Push Notifications (stub) ────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'DreamVault', {
      body: data.body || 'You have a new notification.',
      icon: '/logo.png',
      badge: '/logo.png',
      tag: 'dreamvault',
    })
  );
});
