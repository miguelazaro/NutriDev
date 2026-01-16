const CACHE = "nutridev-v6"; 

const STATIC_FILES = [
  "/paciente_pwa/offline.html",
  "/css/output.css?v=1",
  "/paciente_pwa/manifest.json",
  "/paciente_pwa/icons/icon-192.png",
  "/paciente_pwa/icons/icon-512.png"
];

// -----------------------------
// INSTALL
// -----------------------------
self.addEventListener("install", event => {
  console.log("[SW] Install event");
  event.waitUntil(
    caches.open(CACHE).then(cache => {
      console.log("[SW] Caching static files");
      return cache.addAll(STATIC_FILES);
    })
  );
  self.skipWaiting();
});

// -----------------------------
// ACTIVATE
// -----------------------------
self.addEventListener("activate", event => {
  console.log("[SW] Activate event");
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(k => {
          if (k !== CACHE) {
            console.log("[SW] Deleting old cache:", k);
            return caches.delete(k);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// -----------------------------
// FETCH
// -----------------------------
self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);
  const isPwaPath = url.pathname.startsWith("/paciente_pwa/");
  const isGlobalAsset = url.pathname.startsWith("/css/") || url.pathname.startsWith("/assets/");
  const isImage = req.destination === "image" || url.pathname.match(/\.(jpg|jpeg|png|webp|svg|gif)$/i);
  if (!isPwaPath && !isGlobalAsset && !isImage) {
    return;
  }

  event.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => {
        console.warn("[SW] Offline → buscando en cache:", req.url);

        return caches.match(req, { ignoreSearch: false }).then(match => {
          if (match) {
            return match;
          }

          if (req.mode === 'navigate') {
            console.log("[SW] Navegación fallida → mostrando OFFLINE page");
            return caches.match("/paciente_pwa/offline.html");
          }
          return null;
        });
      })
  );
});
