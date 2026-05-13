/* Converge service worker.
 *
 * Goals (kept deliberately small):
 *   1. Make the app installable & launchable offline by serving the SPA shell
 *      from cache when the network is unavailable.
 *   2. Let users re-open note pages they have already viewed once, even
 *      offline, by caching successful PocketBase responses for individual
 *      note_pages records.
 *
 * Cache layout:
 *   converge-shell-v1   — index.html + hashed /assets/* (app shell)
 *   converge-notes-v1   — PB GET single-record responses for note_pages
 *
 * Bump CACHE_VERSION when the shell or note caching shape changes; the
 * activate handler removes any cache that doesn't match the current version.
 */

const CACHE_VERSION = "v1";
const SHELL_CACHE = `converge-shell-${CACHE_VERSION}`;
const NOTES_CACHE = `converge-notes-${CACHE_VERSION}`;
const ALL_CACHES = new Set([SHELL_CACHE, NOTES_CACHE]);

const APP_SHELL_URLS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
];

// Matches PB's default REST shape for a single note_pages record:
//   /api/collections/note_pages/records/<id>
// We accept an optional trailing slash and ignore query strings (callers
// frequently pass `?expand=...` etc.).
const NOTE_PAGE_RE =
  /\/api\/collections\/note_pages\/records\/[a-zA-Z0-9_-]+\/?$/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Use { cache: "reload" } so the install pre-cache always pulls fresh
      // copies rather than reusing a stale HTTP cache entry.
      await Promise.all(
        APP_SHELL_URLS.map((url) =>
          cache
            .add(new Request(url, { cache: "reload" }))
            .catch(() => {
              /* best-effort: missing optional asset shouldn't abort install */
            }),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => (ALL_CACHES.has(key) ? undefined : caches.delete(key))),
      );
      await self.clients.claim();
    })(),
  );
});

/** Stale-while-revalidate for fingerprinted /assets/* bundles. */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => undefined);
  return cached || (await networkPromise) || Response.error();
}

/** Navigation: try network, fall back to cached shell. */
async function handleNavigation(request) {
  try {
    const fresh = await fetch(request);
    // Keep / and index.html fresh for next offline launch.
    if (fresh && fresh.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put("/index.html", fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    const cached =
      (await cache.match(request)) ||
      (await cache.match("/index.html")) ||
      (await cache.match("/"));
    if (cached) return cached;
    return new Response(
      "<h1>Offline</h1><p>Converge is offline and the app shell isn't cached yet.</p>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}

/** Network-first with cache fallback for note_pages single-record GETs. */
async function handleNotePage(request) {
  const cache = await caches.open(NOTES_CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      // Strip any auth-ish query params before keying so subsequent reads
      // (which may omit ?expand=) still hit the cache.
      const cacheKey = noteCacheKey(request);
      cache.put(cacheKey, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch {
    const cacheKey = noteCacheKey(request);
    const cached = (await cache.match(cacheKey)) || (await cache.match(request));
    if (cached) return cached;
    throw new Error("offline and not cached");
  }
}

function noteCacheKey(request) {
  const url = new URL(request.url);
  return new Request(url.origin + url.pathname, { method: "GET" });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // SPA navigations.
  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Same-origin hashed assets (Vite output → /assets/*).
  if (url.origin === self.location.origin && url.pathname.startsWith("/assets/")) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Same-origin static shell files we explicitly pre-cached.
  if (
    url.origin === self.location.origin &&
    APP_SHELL_URLS.includes(url.pathname)
  ) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // PocketBase single note_page reads. PB usually runs on a different origin
  // (127.0.0.1:8090), so we match purely on the pathname shape.
  if (NOTE_PAGE_RE.test(url.pathname)) {
    event.respondWith(handleNotePage(request));
    return;
  }
});
