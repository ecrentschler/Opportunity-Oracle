// Opportunity Oracle service worker — v2
// Strategy: NETWORK-FIRST for HTML and the app code, so new deploys appear
// immediately on next open. Falls back to cache only when offline.
// Cache-first is reserved for fonts and icons which rarely change.
const CACHE = "oracle-v2";

self.addEventListener("install", e => {
  self.skipWaiting();  // take over right away on activate
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    // clean up old caches from earlier versions
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;       // never cache POST/PUT/DELETE
  if (url.pathname.startsWith("/api/")) return; // never cache API calls

  // network-first for HTML and JS (the app shell that changes on deploys)
  const isAppShell = url.pathname === "/" ||
                     url.pathname.endsWith(".html") ||
                     url.pathname.endsWith(".js");

  if (isAppShell) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(e.request, { cache: "no-store" });
        const c = await caches.open(CACHE);
        c.put(e.request, fresh.clone());
        return fresh;
      } catch (_) {
        const cached = await caches.match(e.request);
        return cached || new Response("offline", { status: 503 });
      }
    })());
    return;
  }

  // cache-first for fonts / icons / images (rarely change)
  e.respondWith((async () => {
    const cached = await caches.match(e.request);
    if (cached) return cached;
    try {
      const fresh = await fetch(e.request);
      const c = await caches.open(CACHE);
      c.put(e.request, fresh.clone());
      return fresh;
    } catch (_) {
      return new Response("offline", { status: 503 });
    }
  })());
});
