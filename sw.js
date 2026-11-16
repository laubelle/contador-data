const VERSAO = "v1";
const ARQUIVOS = [
  "./", "index.html", "editar.html", "app.js", "style.css",
  "manifest.json", "imagem.png", "imagem2.png", "selo.png",
  "icon-192.png", "icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(nomes.filter(n => n !== VERSAO).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(guardado => {
      if (guardado) return guardado;
      return fetch(e.request).then(resp => {
        if (resp.ok) {
          const copia = resp.clone();
          caches.open(VERSAO).then(c => c.put(e.request, copia));
        }
        return resp;
      });
    })
  );
});