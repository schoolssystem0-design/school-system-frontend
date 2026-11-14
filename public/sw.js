/*
 * Tirvex Tech School System: lets the app open with no internet.
 *
 * - App pages (HTML) are fetched from the network first; the last copy is used only when offline.
 * - Build files (/_next/static, brand images) never change once published, so they are served from the cache.
 * - API calls (/api/...) are never stored here: offline data is kept by the app itself and removed on sign-out.
 */
const VERSION = "v1";
const PAGES = `pages-${VERSION}`;
const ASSETS = `assets-${VERSION}`;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [PAGES, ASSETS];
      for (const name of await caches.keys()) if (!keep.includes(name)) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

const isAsset = (url) =>
  url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/") || /\.(png|ico|svg|webp|woff2?)$/.test(url.pathname);

/** Keeps a page and the build files it loads. */
async function storePage(url, response) {
  const pages = await caches.open(PAGES);
  await pages.put(url, response.clone());
  const html = await response.text();
  const files = new Set(html.match(/\/_next\/static\/[^"'\\)\s]+/g) || []);
  const assets = await caches.open(ASSETS);
  await Promise.all(
    [...files].map(async (file) => {
      if (await assets.match(file)) return;
      try {
        const r = await fetch(file);
        if (r.ok) await assets.put(file, r);
      } catch {
        // offline or gone: skip
      }
    }),
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (isAsset(url)) {
    event.respondWith(
      (async () => {
        const assets = await caches.open(ASSETS);
        const hit = await assets.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) await assets.put(request, response.clone());
        return response;
      })(),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok && response.type === "basic") event.waitUntil(storePage(url.pathname, response.clone()));
          return response;
        } catch {
          const pages = await caches.open(PAGES);
          return (
            (await pages.match(url.pathname)) ||
            (await pages.match("/app")) ||
            new Response(
              "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'><title>Offline</title>" +
                "<body style='font-family:system-ui;padding:2rem;text-align:center'><h1>No internet</h1>" +
                "<p>This page has not been opened on this device yet. Go back, or try again when the connection is back.</p></body>",
              { headers: { "Content-Type": "text/html; charset=utf-8" } },
            )
          );
        }
      })(),
    );
  }
});

/** The app asks to keep pages for offline use (e.g. today's work screens). */
self.addEventListener("message", (event) => {
  if (event.data?.type !== "cache-pages") return;
  event.waitUntil(
    Promise.all(
      (event.data.urls || []).map(async (path) => {
        try {
          const response = await fetch(path, { credentials: "same-origin" });
          if (response.ok) await storePage(path, response);
        } catch {
          // offline: try next time
        }
      }),
    ),
  );
});

/** Signing out: forget stored pages too. */
self.addEventListener("message", (event) => {
  if (event.data?.type === "sign-out") event.waitUntil(caches.delete(PAGES));
});
