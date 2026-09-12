/*
 * Zik Pass service worker - honest offline shell.
 *
 * Policy:
 *  - Precache only a tiny static shell (offline page, icons, manifest).
 *  - Static build assets (/_next/static, images, fonts): cache-first, they are
 *    content-hashed and immutable.
 *  - Navigations: network-first. On failure, serve a previously-seen copy of
 *    that exact page if we have one, otherwise the branded /offline page.
 *  - Runtime-cache a navigation response ONLY for a short allowlist of
 *    non-sensitive customer routes, and never when the URL carries a token or
 *    handoff parameter.
 *  - Never touch /api/*, the clerk/affiliate routes, or anything with a
 *    token-bearing query string. Offline age verification and payment are not
 *    possible and must not appear to work.
 *  - Versioned: bump SW_VERSION to roll the caches; activate() deletes the rest.
 */

const SW_VERSION = "v4";
const STATIC_CACHE = `zikpass-static-${SW_VERSION}`;
const PAGE_CACHE = `zikpass-pages-${SW_VERSION}`;
const KEEP = new Set([STATIC_CACHE, PAGE_CACHE]);

const PRECACHE = [
  "/offline",
  "/manifest.webmanifest",
  "/icons/zikpass-192.svg",
  "/icons/zikpass-512.svg"
];

// Customer routes safe to keep for offline viewing (they hold no PII - any
// credential lives in IndexedDB, not the HTML).
const CACHEABLE_PAGES = ["/home", "/find", "/pass", "/help", "/about", "/card"];

// Never cache or serve-from-cache these path prefixes.
const NEVER = ["/vault", "/retail-demo", "/api/", "/verify", "/affiliate-demo", "/app/handoff", "/issuer", "/store"];

const SENSITIVE_PARAMS = ["handoff_token", "token", "code", "request_id", "session_id"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !KEEP.has(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isSensitive(url) {
  if (NEVER.some((prefix) => url.pathname.startsWith(prefix))) return true;
  return SENSITIVE_PARAMS.some((param) => url.searchParams.has(param));
}

function isCacheablePage(url) {
  return CACHEABLE_PAGES.includes(url.pathname);
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:png|jpg|jpeg|svg|webp|woff2?|ico)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isSensitive(url)) return; // straight to network, never cached
  // Next development chunks reuse filenames. Caching them serves stale code
  // over fresh server HTML and causes hydration failures after an edit.
  if (url.pathname.startsWith("/_next/") &&
      !/[-.][a-f0-9]{8,}\.(?:js|css|woff2?)$/.test(url.pathname)) return;

  // Static, immutable assets: cache-first.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  // Navigations: network-first, honest offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && isCacheablePage(url)) {
            const copy = response.clone();
            caches.open(PAGE_CACHE).then((cache) => cache.put(url.pathname, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(url.pathname);
          if (cached) return cached;
          const offline = await caches.match("/offline");
          return (
            offline ||
            new Response("<h1>Offline</h1><p>Reconnect to use Zik Pass.</p>", {
              headers: { "Content-Type": "text/html" },
              status: 503
            })
          );
        })
    );
  }
});
