// ═══════════════════════════════════════════════════════════════
//  AgroMetrix — Service Worker v3.0
//  Estratégia: Cache-first para assets + Network-first para dados
// ═══════════════════════════════════════════════════════════════

const APP_VERSION = 'agrometrix-v3.0.0';
const STATIC_CACHE = `${APP_VERSION}-static`;
const DATA_CACHE   = `${APP_VERSION}-data`;
const IMG_CACHE    = `${APP_VERSION}-images`;

// Assets que serão cacheados no install (app shell)
const APP_SHELL = [
  '/',
  '/index.html',
  '/offline.html',
  '/pwa.js',
  '/db.js',
  '/history.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  // Fontes Google (serão cacheadas dinamicamente)
];

// APIs de dados meteorológicos (network-first)
const DATA_APIS = [
  'api.open-meteo.com',
  'nominatim.openstreetmap.org',
  'services.swpc.noaa.gov',
  'corsproxy.io',
];

// ── INSTALL ──────────────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing AgroMetrix v3.0');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        // Instala o shell; ignora falhas individuais para não bloquear
        return Promise.allSettled(
          APP_SHELL.map(url => cache.add(url).catch(() => {}))
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating AgroMetrix v3.0');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== STATIC_CACHE && k !== DATA_CACHE && k !== IMG_CACHE)
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH STRATEGY ───────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora não-GET e requests de extensões
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // 1. APIs de dados → Network-First com fallback offline
  if (DATA_APIS.some(api => url.hostname.includes(api))) {
    event.respondWith(networkFirstData(request));
    return;
  }

  // 2. Fontes / CDN externos → Cache-First com update
  if (url.hostname.includes('fonts.g') || url.hostname.includes('cdnjs')) {
    event.respondWith(cacheFirstExternal(request));
    return;
  }

  // 3. App shell e assets locais → Cache-First
  event.respondWith(cacheFirstLocal(request));
});

// ── Network-First para dados de API ──────────────────────────────
async function networkFirstData(request) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const response = await fetchWithTimeout(request.clone(), 8000);
    if (response.ok) {
      // Salva com timestamp para expiração
      const clone = response.clone();
      cache.put(request, clone);
      broadcastNetworkStatus(true);
    }
    return response;
  } catch (err) {
    broadcastNetworkStatus(false);
    const cached = await cache.match(request);
    if (cached) {
      // Injeta header indicando dados offline
      const headers = new Headers(cached.headers);
      headers.set('X-AgroMetrix-Source', 'cache');
      return new Response(await cached.blob(), {
        status: cached.status,
        statusText: cached.statusText,
        headers
      });
    }
    return new Response(JSON.stringify({
      error: 'offline',
      message: 'Sem conexão e sem cache disponível'
    }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
}

// ── Cache-First para assets externos ─────────────────────────────
async function cacheFirstExternal(request) {
  const cache = await caches.open(IMG_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('', { status: 408 });
  }
}

// ── Cache-First para app shell ────────────────────────────────────
async function cacheFirstLocal(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    // Atualiza em background (stale-while-revalidate)
    fetchAndUpdate(request, cache);
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    // Fallback para offline.html em navegação
    if (request.mode === 'navigate') {
      const offline = await cache.match('/offline.html');
      return offline || new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } });
    }
    return new Response('', { status: 408 });
  }
}

async function fetchAndUpdate(request, cache) {
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
  } catch {}
}

// ── Timeout wrapper ───────────────────────────────────────────────
function fetchWithTimeout(request, ms) {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}

// ── Broadcast status de rede para a página ────────────────────────
function broadcastNetworkStatus(online) {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => client.postMessage({
      type: 'NETWORK_STATUS',
      online,
      timestamp: Date.now()
    }));
  });
}

// ── PUSH NOTIFICATIONS ────────────────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  const options = {
    body: data.body || 'Atualização meteorológica disponível',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    vibrate: [200, 100, 200],
    data: data,
    actions: [
      { action: 'open',    title: '📊 Ver dados' },
      { action: 'dismiss', title: 'Fechar'       }
    ],
    tag: 'agrometrix-update',
    renotify: true,
    requireInteraction: data.priority === 'high'
  };
  event.waitUntil(
    self.registration.showNotification(
      data.title || '🌿 AgroMetrix — Alerta Climático',
      options
    )
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      const client = clientList.find(c => c.url.includes(self.location.origin) && 'focus' in c);
      if (client) return client.focus();
      return clients.openWindow(event.notification.data?.url || '/');
    })
  );
});

// ── BACKGROUND SYNC ───────────────────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-operations') {
    event.waitUntil(syncPendingOperations());
  }
});

async function syncPendingOperations() {
  // Notifica todas as abas para sincronizar
  const clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage({ type: 'SYNC_OPERATIONS' }));
}

// ── PERIODIC BACKGROUND SYNC (Android) ───────────────────────────
self.addEventListener('periodicsync', event => {
  if (event.tag === 'weather-refresh') {
    event.waitUntil(prefetchWeatherBackground());
  }
});

async function prefetchWeatherBackground() {
  // Pre-aquece o cache de clima se houver localização salva
  try {
    const cache = await caches.open(DATA_CACHE);
    // A localização salva será lida pelo app ao abrir
    const clients = await self.clients.matchAll();
    clients.forEach(c => c.postMessage({ type: 'BG_REFRESH' }));
  } catch {}
}

console.log('[SW] AgroMetrix Service Worker v3.0 carregado');
