// Guarda la app en el celular para que funcione sin internet.
// Nunca descarga nada por su cuenta: las actualizaciones bajan solo cuando la app lo pide
// (botón "Actualizar", o sola si el teléfono avisa que está en Wi-Fi).
const CACHE = "mente";
self.addEventListener("install", e => {
  e.waitUntil(fetch("version.json", { cache: "reload" }).then(r => r.json()).then(v =>
    caches.open(CACHE).then(c => Promise.all(v.files.map(f => fetch(f, { cache: "reload" }).then(r => { if (!r.ok) throw new Error(f); return c.put(f === "./" ? "index.html" : f, r); })))))
    .then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  const u = new URL(req.url);
  if (u.pathname.endsWith("version.json") || u.searchParams.has("upd")) return;
  const key = req.mode === "navigate" ? "index.html" : req;
  e.respondWith(caches.match(key, { ignoreSearch: true }).then(hit => hit || fetch(req)));
});
