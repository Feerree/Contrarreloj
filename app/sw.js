// ARCHIVO GENERADO por tools/build-sw.mjs — no editar a mano.
// Estrategia: precarga de todos los archivos y "cache first" (funciona 100% sin conexión).
const VERSION = '7df7e368dc';
const CACHE = 'contrarreloj-' + VERSION;
const ASSETS = [
  "./",
  "./css/styles.css",
  "./data/bank.js",
  "./fonts/bricolage.woff2",
  "./fonts/outfit.woff2",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/icon.svg",
  "./index.html",
  "./js/app.js",
  "./js/core/game.js",
  "./js/core/modes.js",
  "./js/core/random.js",
  "./js/core/rules.js",
  "./js/core/stats.js",
  "./js/core/storage.js",
  "./js/core/text.js",
  "./js/core/words.js",
  "./js/main.js",
  "./js/screens/bank.js",
  "./js/screens/board.js",
  "./js/screens/dice.js",
  "./js/screens/home.js",
  "./js/screens/play.js",
  "./js/screens/result.js",
  "./js/screens/rules.js",
  "./js/screens/settings.js",
  "./js/screens/setup.js",
  "./js/screens/stats.js",
  "./js/screens/victory.js",
  "./js/ui/board.js",
  "./js/ui/confetti.js",
  "./js/ui/dice.js",
  "./js/ui/dom.js",
  "./js/ui/feedback.js",
  "./manifest.webmanifest"
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('contrarreloj-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()));
    }),
  );
});
