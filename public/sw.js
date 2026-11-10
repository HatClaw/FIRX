// Bump this value whenever the app shell changes so installed PWAs discard
// stale cached assets and load the current branding and interface.
const CACHE = 'grow-v5';
const APP_BASE = new URL(self.registration.scope).pathname;
const shell = [APP_BASE, `${APP_BASE}index.html`, `${APP_BASE}manifest.webmanifest`, `${APP_BASE}assets/pwa-icon.svg`];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(shell)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('grow-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(APP_BASE)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CACHE).then((cache) => cache.put(`${APP_BASE}index.html`, response.clone()));
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match(`${APP_BASE}index.html`)) || Response.error())
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
        return response;
      });
      return cached || network.catch(() => Response.error());
    })
  );
});
