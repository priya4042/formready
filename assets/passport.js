/* Passport photo sheet: one framed photo repeated on 4 x 6 or A4 at 300 DPI with cut lines. */
(function () {
  var $ = FR.$, DPI = 300, MM = DPI / 25.4;
  var PAPER = { "4x6": [101.6, 152.4], a4: [210, 297] };
  var crop = FR.cropper($("#crop"), $("#zoom")), sheet = $("#sheet"), timer = null;

  function photo() { var p = $("#psize").value.split("x"); return [+p[0], +p[1]]; }
  // best grid; 4 x 6 may turn sideways and go borderless, A4 keeps a 5 mm printer margin
  function layout() {
    var ps = PAPER[$("#paper").value], ph = photo(), best = null;
    var opts = $("#paper").value === "a4" ? [ps] : [ps, [ps[1], ps[0]]];
    ($("#paper").value === "a4" ? [[2, 5]] : [[2, 2.5], [1, 1], [0, 0]]).forEach(function (sp) {
      opts.forEach(function (p) {
        var cols = Math.floor((p[0] - 2 * sp[1] + sp[0]) / (ph[0] + sp[0]) + 1e-9), rows = Math.floor((p[1] - 2 * sp[1] + sp[0]) / (ph[1] + sp[0]) + 1e-9);
        if (!best || cols * rows > best.cols * best.rows) best = { W: p[0], H: p[1], cols: cols, rows: rows, gap: sp[0] };
      });
    });
    best.pw = ph[0]; best.ph = ph[1]; return best;
  }
  function fillCount() {
    var L = layout(), max = L.cols * L.rows, sel = $("#count"), full = !sel.value || sel.selectedIndex === 0, v = full ? max : +sel.value;
    var html = ""; for (var n = max; n >= 1; n--) if (n === max || n % 2 === 0 || n === 1) html += '<option value="' + n + '">' + n + (n === max ? FR.t(" (full sheet)", " (पूरी शीट)") : "") + "</option>";
    $("#count").innerHTML = html; $("#count").value = Math.min(v, max); if (!$("#count").value) $("#count").value = max;
  }

  function draw() {
    var L = layout(), n = +$("#count").value || L.cols * L.rows;
    var W = Math.round(L.W * MM), H = Math.round(L.H * MM), pw = Math.round(L.pw * MM), ph = Math.round(L.ph * MM), g = L.gap * MM;
    sheet.width = W; sheet.height = H;
    var x = sheet.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, W, H);
    var gw = L.cols * pw + (L.cols - 1) * g, gh = L.rows * ph + (L.rows - 1) * g, ox = (W - gw) / 2, oy = (H - gh) / 2;
    var b = $("#border").checked ? Math.round(0.8 * MM) : 0, nd = $("#namedate").checked;
    // draw one photo, then copy it
    var one = document.createElement("canvas"); one.width = pw; one.height = ph;
    var o = one.getContext("2d"); o.fillStyle = "#fff"; o.fillRect(0, 0, pw, ph);
    var stripH = nd ? Math.round(ph * 0.16) : 0;
    crop.draw(o, pw - 2 * b, ph - 2 * b - stripH, b, b);
    if (nd) {
      var nm = $("#nd-name").value.trim().toUpperCase(), dt = $("#nd-date").value;
      if (dt) { var p = dt.split("-"); dt = p[2] + "/" + p[1] + "/" + p[0]; }
      o.fillStyle = "#000"; o.textAlign = "center"; o.textBaseline = "middle";
      var lines = [nm, dt].filter(Boolean), fs = Math.round(stripH * 0.38);
      lines.forEach(function (l, i) {
        var f = fs; o.font = "600 " + f + "px Hind, Arial, sans-serif";
        while (f > 8 && o.measureText(l).width > pw - 2 * b - 8) { f--; o.font = "600 " + f + "px Hind, Arial, sans-serif"; }
        o.fillText(l, pw / 2, ph - b - stripH + stripH * (lines.length === 1 ? .5 : i ? .74 : .28));
      });
    }
    var k = 0;
    for (var r = 0; r < L.rows && k < n; r++) for (var c = 0; c < L.cols && k < n; c++, k++) {
      var px = ox + c * (pw + g), py = oy + r * (ph + g);
      x.drawImage(one, px, py);
      x.strokeStyle = "#bbb"; x.lineWidth = 2; x.setLineDash([10, 8]); x.strokeRect(px - g / 2 + (g ? 0 : 1), py - g / 2 + (g ? 0 : 1), pw + g - (g ? 0 : 2), ph + g - (g ? 0 : 2)); x.setLineDash([]);
    }
    $("#empty").hidden = true; $("#result").hidden = false;
    $("#sheet-info").textContent = FR.t(n + " photos of " + L.pw + " x " + L.ph + " mm on " + ($("#paper").value === "a4" ? "A4" : "4 x 6 inch") + " at 300 DPI.",
      L.pw + " x " + L.ph + " mm की " + n + " फ़ोटो, " + ($("#paper").value === "a4" ? "A4" : "4 x 6 इंच") + " पर, 300 DPI।");
  }
  function schedule() { if (!crop.hasImage()) return; clearTimeout(timer); timer = setTimeout(draw, 120); }

  function jpgBlob(q) { return new Promise(function (ok) { sheet.toBlob(ok, "image/jpeg", q); }); }
  $("#dl-jpg").addEventListener("click", async function () {
    var b = await jpgBlob(.95), bytes = new Uint8Array(await b.arrayBuffer());
    if (bytes[2] === 0xFF && bytes[3] === 0xE0) { bytes[13] = 1; bytes[14] = 1; bytes[15] = 44; bytes[16] = 1; bytes[17] = 44; } // 300 DPI
    FR.download(new Blob([bytes], { type: "image/jpeg" }), "passport-photos-" + $("#psize").value + "mm-" + $("#paper").value + ".jpg");
  });
  $("#dl-pdf").addEventListener("click", async function () {
    await FR.need("assets/vendor/pdf-lib.min.js");
    var L = layout(), doc = await PDFLib.PDFDocument.create(), pt = 72 / 25.4;
    var img = await doc.embedJpg(await (await jpgBlob(.95)).arrayBuffer());
    var pg = doc.addPage([L.W * pt, L.H * pt]); pg.drawImage(img, { x: 0, y: 0, width: L.W * pt, height: L.H * pt });
    FR.download(new Blob([await doc.save()], { type: "application/pdf" }), "passport-photos-" + $("#psize").value + "mm-" + $("#paper").value + ".pdf");
  });

  function aspect() { var p = photo(); crop.setAspect(p[0], p[1] - ($("#namedate").checked ? p[1] * 0.16 : 0)); }
  FR.dropZone($("#drop"), $("#file"), async function (files) {
    try { var img = await FR.loadImage(files[0]); $("#drop").hidden = true; $("#editor").hidden = false; aspect(); crop.setImage(img); schedule(); }
    catch (e) { FR.toast(FR.t("That file could not be opened as a picture.", "यह फ़ाइल फ़ोटो की तरह नहीं खुल सकी।")); }
  });
  crop.onChange(schedule);
  $("#rot").addEventListener("click", function () { crop.rotate(); });
  $("#change").addEventListener("click", function () { $("#file").click(); });
  $("#psize").addEventListener("change", function () { aspect(); fillCount(); schedule(); });
  $("#paper").addEventListener("change", function () { fillCount(); schedule(); });
  $("#count").addEventListener("change", schedule);
  $("#border").addEventListener("change", schedule);
  $("#namedate").addEventListener("change", function () { $("#nd-flds").hidden = !this.checked; aspect(); schedule(); });
  $("#nd-name").addEventListener("input", schedule); $("#nd-date").addEventListener("change", schedule);
  FR.onLang(function () { fillCount(); schedule(); });
  fillCount();
})();
