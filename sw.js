const CACHE = "transalumnos-v2";

self.addEventListener("install", (e) => {
  self.skipWaiting(); // 🔥 fuerza instalación inmediata

  e.waitUntil(
    caches.open(CACHE).then((cache) => {
      return cache.addAll([
        "/",
        "/index.html",
        "/style.css",
        "/app.js",
        "/manifest.json",
        "/icono.png"
      ]);
    })
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim()); // 🔥 toma control de la app
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => {
      return res || fetch(e.request);
    })
  );
});