// Opportunity Oracle service worker.
// Strategy: cache-first for the app shell (HTML/fonts/CDN React), network-first
// for /api so the dashboard always reflects fresh server state when online but
// can still load (last data) when offline. Bumps cache version on each deploy
// so users get fresh shells without manual reload.

const VERSION = "oracle-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const SHELL_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE).then((c) =>
      c.addAll(SHELL_ASSETS).catch(() => {/* tolerate missing optional assets */})
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // never cache POST/PUT/DELETE
  if (e.request.method !== "GET") return;

  // API: network-first, fall back to cache (so dashboard loads offline with last data)
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Shell + same-origin static: cache-first, fall through to network
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(SHELL_CACHE).then((c) => c.put(e.request, copy));
        return res;
      }))
    );
    return;
  }

  // Third-party (fonts, React CDN): cache-first opportunistically
  e.respondWith(
    caches.match(e.request).then((hit) =>
      hit || fetch(e.request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => hit) // graceful offline
    )
  );
});
