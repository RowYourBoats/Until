// Self-destructing service worker. The offline-PWA app shell was superseded by
// Google Drive sync; its cache-first worker kept serving stale builds after
// redeploys. This stub replaces any installed worker, wipes its caches, and
// unregisters, then reloads open clients onto the network. Keep this file
// deployed — deleting it would leave old workers in control indefinitely.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) => client.navigate(client.url));
    })()
  );
});
