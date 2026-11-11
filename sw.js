/* Service worker: hanya cache kerangka aplikasi (app.html). Data (Supabase) tidak pernah di-cache. */
var VERSION = "kasadust-v2";
var LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js";
var SHELL = ["app.html", "manifest.json", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(VERSION).then(function (c) {
      var jobs = SHELL.map(function (u) {
        return c.add(new Request(u, { cache: "reload" })).catch(function () {});
      });
      jobs.push(
        fetch(LIB, { mode: "cors", credentials: "omit", cache: "reload" })
          .then(function (r) { if (r && r.ok) return c.put(LIB, r); })
          .catch(function () {})
      );
      return Promise.all(jobs);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (ks) {
        return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

function cacheApp(r) {
  if (r && r.ok) { var cp = r.clone(); caches.open(VERSION).then(function (c) { c.put("app.html", cp); }); }
  return r;
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);

  // Pustaka Supabase dari jsDelivr: cache-first (versi dikunci, jadi aman).
  if (req.url === LIB) {
    e.respondWith(
      caches.match(LIB).then(function (hit) {
        return hit || fetch(req).then(function (r) {
          if (r && r.ok) { var cp = r.clone(); caches.open(VERSION).then(function (c) { c.put(LIB, cp); }); }
          return r;
        });
      })
    );
    return;
  }

  // Selain file se-origin (Supabase, dll): jangan disentuh.
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/sw.js") return;

  if (req.mode === "navigate") {
    // Halaman aplikasi: network-first, jatuh ke cache saat offline.
    if (url.pathname === "/app.html") {
      e.respondWith(
        fetch(req).then(cacheApp).catch(function () { return caches.match("app.html"); })
      );
      return;
    }
    // Alamat utama: normalnya landing. Hanya saat offline (misal shortcut lama yang mulai dari "/"), tampilkan aplikasi.
    if (url.pathname === "/") {
      e.respondWith(
        fetch(req).catch(function () { return caches.match("app.html"); })
      );
    }
    return;
  }

  // Ikon dan manifest: cache dulu, perbarui di belakang layar.
  e.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (r) {
        if (r && r.ok) { var cp = r.clone(); caches.open(VERSION).then(function (c) { c.put(req, cp); }); }
        return r;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
