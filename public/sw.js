/* Mirhaba service worker: keeps Quick Talk working offline after one visit.
 * Hand-written on purpose (small, no build-tool coupling). Bump VERSION to drop old caches.
 *
 * - Pages: network first (3 s timeout), then cache, then the offline page.
 * - /_next/static (hashed, immutable): cache first.
 * - Other same-origin GETs (icons, fonts, audio): stale-while-revalidate.
 * - /api and cross-origin requests are never cached.
 */
const VERSION = "v5";
const PAGES = `mirhaba-pages-${VERSION}`;
const ASSETS = `mirhaba-assets-${VERSION}`;
const PRECACHE = ["/tr", "/sq", "/tr/offline", "/sq/offline", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// The page sends the URLs it already loaded (JS/CSS chunks) so they're cached too.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_URLS" || !Array.isArray(event.data.urls)) return;
  const urls = event.data.urls.filter((u) => {
    try {
      const url = new URL(u);
      return url.origin === self.location.origin && !url.pathname.startsWith("/api");
    } catch {
      return false;
    }
  });
  event.waitUntil(caches.open(ASSETS).then((cache) => Promise.all(urls.map((u) => cache.add(u).catch(() => {})))));
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}

async function handleNavigation(request) {
  const cache = await caches.open(PAGES);
  try {
    const response = await Promise.race([fetch(request), timeout(3000)]);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const lang = new URL(request.url).pathname.startsWith("/sq") ? "sq" : "tr";
    return (await cache.match(`/${lang}/offline`)) ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(ASSETS)).put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached ?? network;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api")) return;
  // Next.js RSC payloads (client-side navigation/prefetch) go straight to the network.
  // Offline, the router then falls back to a full navigation, which the cache serves.
  if (request.headers.get("RSC") || url.searchParams.has("_rsc")) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
  } else if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
  } else if (!url.pathname.startsWith("/_next/")) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
