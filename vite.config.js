import { defineConfig } from "vite";

const BASE_PATH = "/SuperMartket/";

function offlineAppShell() {
  return {
    name: "supermartket-offline-app-shell",
    apply: "build",
    generateBundle(_, bundle) {
      const assets = Object.keys(bundle)
        .filter((fileName) => /\\.(?:js|css)$/.test(fileName))
        .map((fileName) => `${BASE_PATH}${fileName}`);
      const precacheUrls = [
        BASE_PATH,
        `${BASE_PATH}manifest.webmanifest`,
        `${BASE_PATH}icons/basket.svg`,
        `${BASE_PATH}icons/icon-192.png`,
        `${BASE_PATH}icons/icon-512.png`,
        ...assets,
      ];

      const serviceWorker = `
const CACHE_NAME = "supermartket-shell-v3";
const APP_BASE = ${JSON.stringify(BASE_PATH)};
const PRECACHE_URLS = ${JSON.stringify(precacheUrls)};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("supermartket-shell-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(APP_BASE)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!response.ok) return response;

          const copy = response.clone();
          return caches.open(CACHE_NAME)
            .then((cache) => cache.put(APP_BASE, copy))
            .then(() => response);
        })
        .catch(() => caches.match(APP_BASE))
    );
    return;
  }

  if (PRECACHE_URLS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;

        return fetch(request).then((response) => {
          if (!response.ok) return response;

          const copy = response.clone();
          return caches.open(CACHE_NAME)
            .then((cache) => cache.put(request, copy))
            .then(() => response);
        });
      })
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
  base: BASE_PATH,
  plugins: [offlineAppShell()],
});
