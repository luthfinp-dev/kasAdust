/* Service worker: kerangka aplikasi tersedia offline. Data Supabase tidak pernah disimpan di sini. */
var VERSION = "v2";
var CACHE = "bydust-shell-" + VERSION;
var SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js";
var SHELL = ["./", "manifest.json", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];

function offlinePage() {
  var html = '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title>' +
    '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#012b1a;color:#eef3ee;font:16px/1.5 -apple-system,system-ui,sans-serif;text-align:center;padding:24px}a{display:inline-block;margin-top:16px;padding:10px 20px;border-radius:12px;background:#d4ecd9;color:#173323;text-decoration:none;font-weight:600}</style></head>' +
    '<body><div><h1 style="font-size:1.3rem;margin:0 0 8px">Tidak ada koneksi</h1><p style="margin:0;opacity:.8">Aplikasi belum tersimpan di perangkat ini. Hubungkan internet, lalu coba lagi.</p><a href="./">Muat ulang</a></div></body></html>';
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // best effort: satu file gagal tidak membatalkan pemasangan
      return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }))
        .then(function () {
          return c.add(new Request(SUPABASE_JS, { mode: "cors", credentials: "omit" })).catch(function () {});
        });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k.indexOf("bydust-shell-") === 0 && k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);

  // Pustaka Supabase dari CDN: cache dulu (integritas tetap dicek browser lewat atribut SRI).
  if (req.url === SUPABASE_JS) {
    e.respondWith(
      caches.match(SUPABASE_JS).then(function (hit) {
        return hit || fetch(new Request(SUPABASE_JS, { mode: "cors", credentials: "omit" })).then(function (res) {
          if (res && res.ok) { var cp = res.clone(); caches.open(CACHE).then(function (c) { c.put(SUPABASE_JS, cp); }); }
          return res;
        });
      })
    );
    return;
  }

  // Selain itu hanya file milik sendiri. API Supabase, login, dan semua domain lain tidak disentuh.
  if (url.origin !== self.location.origin) return;

  // Halaman: jaringan dulu supaya update dari Vercel langsung muncul, cache hanya jika offline.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) { var cp = res.clone(); caches.open(CACHE).then(function (c) { c.put("./", cp); }); }
        return res;
      }).catch(function () {
        return caches.match("./").then(function (hit) { return hit || offlinePage(); });
      })
    );
    return;
  }

  // Ikon dan manifest: cache dulu, perbarui di belakang layar.
  if (/\.(png|json|ico|svg)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(function (hit) {
        var net = fetch(req).then(function (res) {
          if (res && res.ok) { var cp = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, cp); }); }
          return res;
        }).catch(function () { return hit; });
        return hit || net;
      })
    );
  }
});
