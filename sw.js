// Imperion – Service Worker (Paket 8): macht die Web-App offline spielbar.
// Online: immer die neueste Fassung vom Server (höchstens 4 s warten, sonst aus dem Speicher und im
// Hintergrund aktualisieren). Offline: alles aus dem Speicher.
const CACHE = "imperion-1";
const DATEIEN = ["./", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(namen => Promise.all(namen.filter(n => n.startsWith("imperion-") && n !== CACHE).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  // Alle Seitenaufrufe (./ und index.html) teilen sich einen Eintrag.
  const seite = req.mode === "navigate" || /\/(index\.html)?$/.test(new URL(req.url).pathname);
  const schluessel = seite ? new URL("./", self.registration.scope).href : req;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const netz = fetch(req, { cache: "no-cache" }).then(antwort => {
      if (antwort.ok) cache.put(schluessel, antwort.clone());
      return antwort;
    });
    const gespeichert = await cache.match(schluessel);
    if (!gespeichert) return netz;
    const warte = new Promise(r => setTimeout(() => r(null), 4000));
    try {
      const schnell = await Promise.race([netz, warte]);
      if (schnell && schnell.ok) return schnell;
    } catch (err) { /* offline */ }
    e.waitUntil(netz.catch(() => {}));
    return gespeichert;
  })());
});
