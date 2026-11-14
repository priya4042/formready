// Network first so updates show at once; cached copy when offline.
var CACHE = "formready-v2";
var CORE = ["./", "index.html", "passport.html", "pdf.html", "privacy.html", "assets/app.css", "assets/common.js", "assets/presets.js",
  "assets/resizer.js", "assets/passport.js", "assets/pdf.js", "assets/vendor/pdf-lib.min.js", "assets/icon.svg", "assets/icon-192.png"];
self.addEventListener("install", function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).then(function (r) {
    if (r.ok && (new URL(e.request.url).origin === location.origin || e.request.url.indexOf("fonts.") > -1)) { var cp = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, cp); }); }
    return r;
  }).catch(function () { return caches.match(e.request, { ignoreSearch: true }).then(function (m) { return m || caches.match("./"); }); }));
});
