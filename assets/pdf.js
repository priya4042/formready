/* Images to PDF (with a size limit) and merge PDFs, using pdf-lib in the browser. */
(function () {
  var $ = FR.$, P = window.PDFLib, imgs = [], pdfs = [];

  // tabs
  var tabs = [$("#t-img"), $("#t-merge")];
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { sel(i); });
    t.addEventListener("keydown", function (e) { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { var j = (i + 1) % 2; sel(j); tabs[j].focus(); } });
  });
  function sel(i) {
    tabs.forEach(function (t, k) { t.setAttribute("aria-selected", k === i); t.tabIndex = k === i ? 0 : -1; $("#" + t.getAttribute("aria-controls")).hidden = k !== i; });
  }

  function list(ul, arr, label, onChange) {
    ul.innerHTML = "";
    arr.forEach(function (it, i) {
      var li = document.createElement("li");
      li.innerHTML = (it.thumb ? '<img class="th" alt="" src="' + it.thumb + '">' : '<span class="th">PDF</span>') +
        '<span class="nm"></span><span class="ctl">' +
        '<button type="button" data-a="up" aria-label="Move up">&#8593;</button><button type="button" data-a="down" aria-label="Move down">&#8595;</button><button type="button" data-a="del" aria-label="Remove">&#10005;</button></span>';
      var nm = li.querySelector(".nm"); nm.textContent = it.name;
      var sm = document.createElement("small"); sm.textContent = label(it); nm.appendChild(sm);
      li.querySelector(".ctl").addEventListener("click", function (e) {
        var a = e.target.getAttribute("data-a"); if (!a) return;
        if (a === "del") arr.splice(i, 1);
        if (a === "up" && i > 0) arr.splice(i - 1, 0, arr.splice(i, 1)[0]);
        if (a === "down" && i < arr.length - 1) arr.splice(i + 1, 0, arr.splice(i, 1)[0]);
        list(ul, arr, label, onChange); onChange();
      });
      ul.appendChild(li);
    });
    onChange();
  }

  /* ---------- images to PDF ---------- */
  function paintImgs() { list($("#i-list"), imgs, function (it) { return it.img.naturalWidth + " x " + it.img.naturalHeight + " px, " + FR.kb(it.size); }, function () { $("#i-go").disabled = !imgs.length; $("#i-out").textContent = ""; }); }
  FR.dropZone($("#i-drop"), $("#i-file"), async function (files) {
    for (var i = 0; i < files.length; i++) {
      try { var img = await FR.loadImage(files[i]); imgs.push({ name: files[i].name, size: files[i].size, img: img, thumb: img.src }); }
      catch (e) { FR.toast(files[i].name + FR.t(" is not a picture.", " फ़ोटो नहीं है।")); }
    }
    paintImgs();
  });

  function encode(it, scale, q, clean) {
    var w = it.img.naturalWidth, h = it.img.naturalHeight, s = Math.min(1, 2200 / Math.max(w, h)) * scale;
    var c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
    var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(it.img, 0, 0, c.width, c.height);
    if (clean) FR.cleanInk(x, c.width, c.height);
    return new Promise(function (ok) { c.toBlob(function (b) { b.arrayBuffer().then(function (ab) { ok({ ab: ab, w: c.width, h: c.height }); }); }, "image/jpeg", q); });
  }
  async function makePdf(scale, q) {
    var doc = await P.PDFDocument.create(), a4 = $("#i-page").value === "a4", clean = $("#i-look").value === "clean";
    for (var i = 0; i < imgs.length; i++) {
      var e = await encode(imgs[i], scale, q, clean), im = await doc.embedJpg(e.ab);
      if (a4) {
        var W = 595.28, H = 841.89, m = 28, k = Math.min((W - 2 * m) / e.w, (H - 2 * m) / e.h);
        var pg = doc.addPage([W, H]); pg.drawImage(im, { x: (W - e.w * k) / 2, y: (H - e.h * k) / 2, width: e.w * k, height: e.h * k });
      } else {
        var pt = 72 / 150, p2 = doc.addPage([e.w * pt, e.h * pt]); p2.drawImage(im, { x: 0, y: 0, width: e.w * pt, height: e.h * pt });
      }
    }
    doc.setProducer("FormReady"); doc.setCreator("FormReady");
    return doc.save();
  }
  $("#i-go").addEventListener("click", async function () {
    var btn = this, out = $("#i-out"), maxKB = +$("#i-max").value || 0;
    btn.disabled = true; out.style.color = ""; out.textContent = FR.t("Making your PDF...", "PDF बन रही है...");
    try {
      // step down quality, then pixels, until the PDF fits the limit
      var steps = [[1, .85], [1, .7], [.85, .6], [.7, .5], [.6, .42], [.5, .36], [.4, .3], [.32, .26]], bytes = null, k = 0;
      for (; k < steps.length; k++) {
        bytes = await makePdf(steps[k][0], steps[k][1]);
        if (!maxKB || bytes.length <= maxKB * 1000) break;
        out.textContent = FR.t("Shrinking to fit " + maxKB + " KB...", maxKB + " KB में लाने के लिए छोटा कर रहे हैं...");
      }
      FR.download(new Blob([bytes], { type: "application/pdf" }), "documents.pdf");
      var fits = !maxKB || bytes.length <= maxKB * 1000;
      out.style.color = fits ? "" : "var(--stamp)";
      out.textContent = fits
        ? FR.t("Done: " + imgs.length + " pages, " + FR.kb(bytes.length) + ".", "हो गया: " + imgs.length + " पेज, " + FR.kb(bytes.length) + "।")
        : FR.t("Smallest possible is " + FR.kb(bytes.length) + ". Split the pages into two PDFs or remove a page.", "सबसे छोटी " + FR.kb(bytes.length) + " बनी। पेज दो PDF में बाँटें या कोई पेज हटाएँ।");
    } catch (e) { out.style.color = "var(--stamp)"; out.textContent = FR.t("Could not make the PDF: ", "PDF नहीं बन सकी: ") + e.message; }
    btn.disabled = false;
  });

  /* ---------- merge PDFs ---------- */
  function paintPdfs() { list($("#m-list"), pdfs, function (it) { return it.pages + FR.t(" pages, ", " पेज, ") + FR.kb(it.ab.byteLength); }, function () { $("#m-go").disabled = pdfs.length < 2; $("#m-out").textContent = ""; }); }
  FR.dropZone($("#m-drop"), $("#m-file"), async function (files) {
    for (var i = 0; i < files.length; i++) {
      try {
        var ab = await files[i].arrayBuffer(), d = await P.PDFDocument.load(ab, { ignoreEncryption: true });
        pdfs.push({ name: files[i].name, ab: ab, pages: d.getPageCount() });
      } catch (e) { FR.toast(files[i].name + FR.t(" could not be read as a PDF.", " PDF की तरह नहीं पढ़ी जा सकी।")); }
    }
    paintPdfs();
  });
  $("#m-go").addEventListener("click", async function () {
    var btn = this, out = $("#m-out"); btn.disabled = true; out.style.color = "";
    try {
      var doc = await P.PDFDocument.create(), total = 0;
      for (var i = 0; i < pdfs.length; i++) {
        var src = await P.PDFDocument.load(pdfs[i].ab, { ignoreEncryption: true });
        (await doc.copyPages(src, src.getPageIndices())).forEach(function (p) { doc.addPage(p); total++; });
      }
      var bytes = await doc.save();
      FR.download(new Blob([bytes], { type: "application/pdf" }), "merged.pdf");
      out.textContent = FR.t("Done: " + total + " pages, " + FR.kb(bytes.length) + ".", "हो गया: " + total + " पेज, " + FR.kb(bytes.length) + "।");
    } catch (e) { out.style.color = "var(--stamp)"; out.textContent = FR.t("Could not merge: ", "जोड़ नहीं सके: ") + e.message; }
    btn.disabled = pdfs.length < 2;
  });
})();
