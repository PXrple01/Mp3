/* Offline-Speicher: immer zuerst das Netz fragen, ohne Netz die gespeicherte Kopie nehmen. */
const CACHE = "julipod-v2";
const SHELL = [
  "./", "index.html", "styles.css", "config.js",
  "js/sprite.js", "js/synth.js", "js/lines.js", "js/app.js", "fonts/fonts.css",
  "manifest.webmanifest", "icons/icon.svg", "icons/apple-touch-icon.png", "songs/playlist.json"
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  if (!same) return;
  if (/\.(mp3|m4a|aac|wav|ogg|oga|opus|flac)$/i.test(url.pathname)) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && (res.ok || res.type === "opaque")) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || (req.mode === "navigate" ? caches.match("index.html") : Response.error())))
  );
});
