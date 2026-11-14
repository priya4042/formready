/* FormReady shared code: theme, language, cropper, JPEG size fitting. Everything runs in the browser. */
(function () {
  var FR = window.FR = {};
  var root = document.documentElement;
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  // language
  FR.lang = function () { return root.lang === "hi" ? "hi" : "en"; };
  FR.t = function (en, hi) { return FR.lang() === "hi" && hi ? hi : en; };
  var saved = store("fr-lang");
  if (saved === "hi" || saved === "en") root.lang = saved;
  var langListeners = [];
  FR.onLang = function (fn) { langListeners.push(fn); };
  // theme
  var th = store("fr-theme");
  if (th === "dark" || th === "light") root.setAttribute("data-theme", th);

  document.addEventListener("DOMContentLoaded", function () {
    var lb = document.getElementById("lang-btn");
    function paintLang() { if (lb) { lb.textContent = FR.lang() === "hi" ? "EN" : "हिं"; lb.title = FR.lang() === "hi" ? "Switch to English" : "हिंदी में देखें"; } }
    paintLang();
    if (lb) lb.addEventListener("click", function () {
      root.lang = FR.lang() === "hi" ? "en" : "hi"; store("fr-lang", root.lang); paintLang();
      langListeners.forEach(function (f) { f(); });
    });
    var tb = document.getElementById("theme-btn");
    if (tb) tb.addEventListener("click", function () {
      var dark = root.getAttribute("data-theme") === "dark" || (!root.getAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches);
      root.setAttribute("data-theme", dark ? "light" : "dark"); store("fr-theme", dark ? "light" : "dark");
    });
    var nt = document.getElementById("nav-btn"), nav = document.getElementById("nav");
    if (nt && nav) nt.addEventListener("click", function () { var o = nav.classList.toggle("open"); nt.setAttribute("aria-expanded", o); });
    var y = document.getElementById("year"); if (y) y.textContent = new Date().getFullYear();
    if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(function () {});
  });

  // loads a script once, for big libraries only needed on a button press
  FR.need = function (src) {
    FR._need = FR._need || {};
    return FR._need[src] = FR._need[src] || new Promise(function (ok, bad) { var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
  };
  // small helpers
  FR.$ = function (s, el) { return (el || document).querySelector(s); };
  FR.kb = function (bytes) { return (bytes / 1024).toFixed(1) + " KB"; };
  FR.toast = function (msg) {
    var t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove("show"); }, 2600);
  };
  FR.download = function (blob, name) {
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  };
  FR.loadImage = function (file) {
    return new Promise(function (ok, bad) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { ok(img); };
      img.onerror = function () { URL.revokeObjectURL(url); bad(new Error("not an image")); };
      img.src = url;
    });
  };
  FR.dropZone = function (zone, input, onFiles) {
    zone.addEventListener("click", function (e) { if (e.target !== input) input.click(); });
    zone.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
    input.addEventListener("change", function () { if (input.files.length) onFiles(Array.prototype.slice.call(input.files)); input.value = ""; });
    ["dragenter", "dragover"].forEach(function (ev) { zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add("over"); }); });
    ["dragleave", "drop"].forEach(function (ev) { zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove("over"); }); });
    zone.addEventListener("drop", function (e) { if (e.dataTransfer.files.length) onFiles(Array.prototype.slice.call(e.dataTransfer.files)); });
  };

  /* Cropper: a fixed-aspect frame; the picture is dragged and zoomed behind it. */
  FR.cropper = function (canvas, zoomInput) {
    var st = { img: null, rot: 0, zoom: 1, px: 0, py: 0, aw: 1, ah: 1 };
    var ctx = canvas.getContext("2d"), onChange = function () {};
    function dims() { return st.rot % 2 ? [st.img.naturalHeight, st.img.naturalWidth] : [st.img.naturalWidth, st.img.naturalHeight]; }
    function clamp(W, H) {
      var d = dims(), s = Math.max(W / d[0], H / d[1]) * st.zoom;
      var mx = Math.max(0, (d[0] * s - W) / (2 * W)), my = Math.max(0, (d[1] * s - H) / (2 * W));
      st.px = Math.min(mx, Math.max(-mx, st.px)); st.py = Math.min(my, Math.max(-my, st.py));
    }
    // draws the cropped picture into any W x H box; pan is stored relative to width so it scales
    function draw(c, W, H, x0, y0) {
      x0 = x0 || 0; y0 = y0 || 0;
      c.save(); c.fillStyle = "#fff"; c.fillRect(x0, y0, W, H);
      if (st.img) {
        c.beginPath(); c.rect(x0, y0, W, H); c.clip();
        var d = dims(), s = Math.max(W / d[0], H / d[1]) * st.zoom;
        c.imageSmoothingQuality = "high";
        c.translate(x0 + W / 2 + st.px * W, y0 + H / 2 + st.py * W); c.rotate(st.rot * Math.PI / 2);
        c.drawImage(st.img, -st.img.naturalWidth * s / 2, -st.img.naturalHeight * s / 2, st.img.naturalWidth * s, st.img.naturalHeight * s);
      }
      c.restore();
    }
    function paint() {
      var maxW = 360, maxH = 400, r = st.aw / st.ah, w = maxW, h = w / r;
      if (h > maxH) { h = maxH; w = h * r; }
      var dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.width = Math.round(w) + "px"; canvas.style.aspectRatio = st.aw + " / " + st.ah;
      clamp(canvas.width, canvas.height); draw(ctx, canvas.width, canvas.height);
    }
    var drag = null;
    canvas.addEventListener("pointerdown", function (e) { if (!st.img) return; drag = { x: e.clientX, y: e.clientY, px: st.px, py: st.py }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", function (e) {
      if (!drag) return; var w = canvas.getBoundingClientRect().width;
      st.px = drag.px + (e.clientX - drag.x) / w; st.py = drag.py + (e.clientY - drag.y) / w; paint();
    });
    canvas.addEventListener("pointerup", function () { if (drag) { drag = null; onChange(); } });
    canvas.addEventListener("pointercancel", function () { drag = null; });
    canvas.addEventListener("wheel", function (e) { if (!st.img) return; e.preventDefault(); setZoom(st.zoom * (e.deltaY < 0 ? 1.06 : 1 / 1.06)); onChange(); }, { passive: false });
    canvas.tabIndex = 0;
    canvas.addEventListener("keydown", function (e) {
      var k = { ArrowLeft: [-.01, 0], ArrowRight: [.01, 0], ArrowUp: [0, -.01], ArrowDown: [0, .01] }[e.key];
      if (k && st.img) { e.preventDefault(); st.px += k[0]; st.py += k[1]; paint(); onChange(); }
    });
    function setZoom(z) { st.zoom = Math.min(5, Math.max(1, z)); if (zoomInput) zoomInput.value = st.zoom; paint(); }
    if (zoomInput) zoomInput.addEventListener("input", function () { setZoom(+zoomInput.value); });
    if (zoomInput) zoomInput.addEventListener("change", function () { onChange(); });
    return {
      setImage: function (img) { st.img = img; st.rot = 0; st.zoom = 1; st.px = st.py = 0; if (zoomInput) zoomInput.value = 1; paint(); },
      setAspect: function (w, h) { st.aw = w; st.ah = h; if (st.img) paint(); },
      rotate: function () { st.rot = (st.rot + 1) % 4; st.px = st.py = 0; paint(); onChange(); },
      reset: function () { st.zoom = 1; st.px = st.py = 0; if (zoomInput) zoomInput.value = 1; paint(); onChange(); },
      draw: draw, hasImage: function () { return !!st.img; }, onChange: function (f) { onChange = f; }, repaint: paint
    };
  };

  /* Signature clean-up: paper becomes pure white, ink becomes dark and crisp. */
  FR.cleanInk = function (c, W, H) {
    var d = c.getImageData(0, 0, W, H), p = d.data, n = W * H, hist = new Uint32Array(256), i;
    for (i = 0; i < n; i++) hist[(p[i * 4] * 0.299 + p[i * 4 + 1] * 0.587 + p[i * 4 + 2] * 0.114) | 0]++;
    var acc = 0, paper = 255; for (i = 0; i < 256; i++) { acc += hist[i]; if (acc >= n * 0.6) { paper = i; break; } }
    var hi = Math.max(60, paper * 0.82), lo = Math.min(hi - 30, 70);
    for (i = 0; i < n; i++) {
      var k = i * 4, l = p[k] * 0.299 + p[k + 1] * 0.587 + p[k + 2] * 0.114;
      var v = l >= hi ? 255 : l <= lo ? 0 : Math.round((l - lo) / (hi - lo) * 255);
      p[k] = p[k + 1] = p[k + 2] = v;
    }
    c.putImageData(d, 0, 0);
  };

  function toBlob(canvas, q) { return new Promise(function (ok) { canvas.toBlob(ok, "image/jpeg", q); }); }

  // writes 200 DPI into the JFIF header so portals that read print size see sensible centimetres
  function setDpi(bytes, dpi) {
    if (bytes[2] === 0xFF && bytes[3] === 0xE0 && bytes[6] === 0x4A && bytes[7] === 0x46 && bytes[8] === 0x49 && bytes[9] === 0x46) {
      bytes[13] = 1; bytes[14] = dpi >> 8; bytes[15] = dpi & 255; bytes[16] = dpi >> 8; bytes[17] = dpi & 255;
    }
    return bytes;
  }
  // adds empty comment blocks after the header so a tiny file reaches the minimum size; the picture is unchanged
  function pad(bytes, extra) {
    var parts = [bytes.subarray(0, 2)], left = extra;
    while (left > 4) {
      var len = Math.min(65533, left - 2), seg = new Uint8Array(len + 2);
      seg[0] = 0xFF; seg[1] = 0xFE; seg[2] = len >> 8; seg[3] = len & 255; seg.fill(32, 4);
      parts.push(seg); left -= seg.length;
    }
    parts.push(bytes.subarray(2));
    return new Blob(parts, { type: "image/jpeg" });
  }

  /* Encode a canvas as JPEG between minKB and maxKB.
     Upper limit uses 1000 bytes per KB and lower limit 1024, so the file passes either way a portal counts. */
  FR.fitJpeg = async function (canvas, minKB, maxKB, dpi) {
    var maxB = Math.floor(maxKB * 1000), minB = Math.ceil(minKB * 1024);
    var lo = 0.08, hi = 1, best = null, bestQ = 0, b;
    b = await toBlob(canvas, hi);
    if (b.size <= maxB) { best = b; bestQ = hi; }
    else {
      for (var i = 0; i < 9; i++) {
        var q = (lo + hi) / 2; b = await toBlob(canvas, q);
        if (b.size <= maxB) { best = b; bestQ = q; lo = q; } else hi = q;
      }
      if (!best) { b = await toBlob(canvas, 0.08); if (b.size <= maxB) { best = b; bestQ = 0.08; } }
    }
    if (!best) return { blob: null, tooBig: true };
    var bytes = setDpi(new Uint8Array(await best.arrayBuffer()), dpi || 200), padded = false, out;
    if (bytes.length < minB) {
      var target = Math.min(maxB - 64, minB + 600);
      out = pad(bytes, target - bytes.length); padded = true;
    } else out = new Blob([bytes], { type: "image/jpeg" });
    return { blob: out, quality: bestQ, padded: padded };
  };
})();
