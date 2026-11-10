import { defineConfig } from "vite";

function offlineAppShell() {
  return {
    name: "supermartket-offline-app-shell",
    apply: "build",
    generateBundle(_, bundle) {
      const assets = Object.keys(bundle)
        .filter((fileName) => /\.(?:js|css)$/.test(fileName))
        .map((fileName) => `/${fileName}`);
      const precacheUrls = ["/", "/manifest.webmanifest", "/icons/basket.svg", ...assets];

      const serviceWorker = `
const CACHE_NAME = "supermartket-shell-v1";
const PRECACHE_URLS = ${JSON.stringify(precacheUrls)};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
        return response;
      }).catch(() => caches.match("/"))
    );
    return;
  }

  if (PRECACHE_URLS.includes(url.pathname) || url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      }))
    );
  }
});
`;

      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: serviceWorker,
      });
    },
  };
}

export default defineConfig({
  plugins: [offlineAppShell()],
});