/* PixelProTech Pixel App — sw.js
   Offline application shell. Cache-first from a versioned cache so the app never mixes files from two releases.
   RELEASE RULE: change VERSION whenever any shell file changes — that byte change is what makes browsers fetch the new worker.
   A new worker waits until the person chooses "Reload now" in the app; it never swaps files under an open editing session. */
const VERSION = 'pixelapp-shell-v1';
const SHELL = [
  'index.html', 'offline.html', 'manifest.webmanifest', 'app.css',
  'components.js', 'blueprints.js', 'templates.js', 'engine.js', 'storage.js', 'exporter.js', 'preflight.js',
  'inspector.js', 'canvas.js', 'panels.js', 'dialogs.js', 'app.js',
  'icons.svg', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'
];
const abs = (p) => new URL(p, self.registration.scope).href;

self.addEventListener('install', (e) => {
  // addAll is atomic: if any file is missing the install fails instead of caching a broken shell.
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((p) => new Request(abs(p), { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('pixelapp-shell-') && k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.type === 'SKIP_WAITING') self.skipWaiting();
  else if (d.type === 'STATUS' && e.ports && e.ports[0]) {
    e.waitUntil((async () => {
      const keys = await (await caches.open(VERSION)).keys();
      const have = new Set(keys.map((r) => r.url));
      e.ports[0].postMessage({ version: VERSION, expected: SHELL.length, cached: SHELL.filter((p) => have.has(abs(p))).length });
    })());
  }
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate' && (url.pathname === new URL(abs('./')).pathname)) { const home = await caches.match(abs('index.html')); if (home) return home; }
    try { return await fetch(req); }
    catch (err) {
      if (req.mode === 'navigate') { const off = await caches.match(abs('offline.html')); if (off) return off; }
      return new Response('Offline and not cached.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    }
  })());
});
