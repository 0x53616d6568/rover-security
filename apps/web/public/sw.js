const CACHE_NAME = "roverx-tiles-v1";
const TILE_HOSTS = ["tile.openstreetmap.org"];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isTile = TILE_HOSTS.some((host) => url.hostname.includes(host)) && url.pathname.match(/\.(png|jpg|jpeg|webp)$/);
  if (!isTile) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            cache.put(event.request, response.clone());
          }
          return response;
        }).catch(() => cached);
      })
    )
  );
});