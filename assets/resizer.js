/* Photo and signature resizer: preset -> crop -> JPEG inside the KB range. */
(function () {
  var $ = FR.$, EX = window.FR_EXAMS;
  var exSel = $("#exam"), docSel = $("#doc"), spec = $("#spec");
  var cur = { w: 200, h: 230, min: 20, max: 50 }, blob = null, job = 0, timer = null;
  var crop = FR.cropper($("#crop"), $("#zoom"));

  function name(o) { return FR.t(o.en, o.hi); }
  function exam() { return EX.filter(function (e) { return e.id === exSel.value; })[0] || EX[0]; }
  function doc() { var e = exam(); return e.docs.filter(function (d) { return d.id === docSel.value; })[0] || e.docs[0]; }

  function fillExams() {
    var v = exSel.value;
    exSel.innerHTML = EX.map(function (e) { return '<option value="' + e.id + '">' + name(e) + "</option>"; }).join("");
    if (v) exSel.value = v;
  }
  function fillDocs() {
    var v = docSel.value, e = exam();
    docSel.innerHTML = e.docs.map(function (d) { return '<option value="' + d.id + '">' + name(d) + "</option>"; }).join("");
    if (v && e.docs.some(function (d) { return d.id === v; })) docSel.value = v;
  }
  function paintSpec() {
    var e = exam();
    spec.innerHTML = "<b>" + name(doc()) + "</b>" +
      '<span class="chip">' + cur.w + " x " + cur.h + " px</span>" +
      '<span class="chip">' + cur.min + " - " + cur.max + " KB</span>" +
      '<span class="chip">JPG</span>' +
      "<small>" + (e.note ? FR.t(e.note[0], e.note[1]) + " " : "") +
      FR.t("Check the official notification for the latest limits.", "नवीनतम सीमा के लिए आधिकारिक नोटिफ़िकेशन ज़रूर देखें।") + "</small>";
  }
  function applyPreset() {
    var d = doc();
    cur = { w: d.w, h: d.h, min: d.min, max: d.max };
    $("#w").value = cur.w; $("#h").value = cur.h; $("#min").value = cur.min; $("#max").value = cur.max;
    $("#ink").checked = !!d.ink;
    crop.setAspect(cur.w, cur.h); paintSpec(); schedule();
    try { localStorage.setItem("fr-pick", exSel.value + "|" + docSel.value); } catch (e) {}
  }

  function sizeTable() {
    var rows = "";
    EX.forEach(function (e) {
      if (e.id === "custom") return;
      e.docs.forEach(function (d, i) {
        rows += "<tr><td>" + (i ? "" : name(e)) + "</td><td>" + name(d) + "</td><td>" + d.w + " x " + d.h + "</td><td>" + d.min + " - " + d.max + " KB</td></tr>";
      });
    });
    $("#size-table tbody").innerHTML = rows;
  }

  // the image that goes into the file: crop, optional name/date strip, optional ink clean-up
  function render() {
    var c = document.createElement("canvas"); c.width = cur.w; c.height = cur.h;
    var x = c.getContext("2d"), nd = $("#namedate").checked, ph = nd ? Math.round(cur.h * 0.8) : cur.h;
    crop.draw(x, cur.w, ph);
    if ($("#ink").checked) FR.cleanInk(x, cur.w, ph);
    if (nd) {
      var nm = $("#nd-name").value.trim(), dt = $("#nd-date").value, sh = cur.h - ph;
      x.fillStyle = "#fff"; x.fillRect(0, ph, cur.w, sh);
      x.fillStyle = "#000"; x.textAlign = "center"; x.textBaseline = "middle";
      var fs = Math.max(8, Math.floor(sh * 0.36));
      if (dt) { var p = dt.split("-"); dt = p[2] + "/" + p[1] + "/" + p[0]; }
      var lines = [nm.toUpperCase(), dt].filter(Boolean);
      lines.forEach(function (l, i) {
        var f = fs; x.font = "600 " + f + "px Hind, Arial, sans-serif";
        while (f > 7 && x.measureText(l).width > cur.w - 6) { f--; x.font = "600 " + f + "px Hind, Arial, sans-serif"; }
        x.fillText(l, cur.w / 2, ph + sh * (lines.length === 1 ? .5 : i ? .72 : .3));
      });
    }
    return c;
  }

  function schedule() { clearTimeout(timer); timer = setTimeout(build, 180); }
  async function build() {
    if (!crop.hasImage()) return;
    var my = ++job, c = render(), r = await FR.fitJpeg(c, cur.min, cur.max, 200);
    if (my !== job) return;
    $("#empty").hidden = true; $("#result").hidden = false;
    var stamp = $("#stamp"), verdict = $("#verdict"), needle = $("#needle");
    $("#slot-title").textContent = name(exam()).split(" (")[0] + ", " + name(doc());
    $("#f-px").textContent = cur.w + " x " + cur.h;
    $("#f-cm").textContent = (cur.w / 200 * 2.54).toFixed(1) + " x " + (cur.h / 200 * 2.54).toFixed(1) + " cm";
    var scaleMax = cur.max * 1.35;
    $("#band").style.left = (cur.min / scaleMax * 100) + "%"; $("#band").style.width = ((cur.max - cur.min) / scaleMax * 100) + "%";
    $("#tick-max").textContent = Math.round(scaleMax) + " KB";
    stamp.classList.remove("show");
    if (!r.blob) {
      blob = null; $("#dl").disabled = true; $("#f-size").textContent = FR.t("too large", "बहुत बड़ी");
      needle.style.left = "100%"; needle.className = "ruler-needle"; $("#needle-l").textContent = "> " + cur.max + " KB";
      stamp.textContent = FR.t("Too big", "बहुत बड़ी"); stamp.className = "stamp bad";
      verdict.className = "note warn";
      verdict.textContent = FR.t("This many pixels cannot fit under " + cur.max + " KB. Lower the width and height, or raise the max KB.",
        "इतने पिक्सेल " + cur.max + " KB में नहीं आ सकते। चौड़ाई-ऊँचाई कम करें या अधिकतम KB बढ़ाएँ।");
    } else {
      blob = r.blob; $("#dl").disabled = false;
      var kb = blob.size / 1024;
      $("#f-size").textContent = kb.toFixed(1) + " KB";
      needle.style.left = Math.min(100, kb / scaleMax * 100) + "%"; needle.className = "ruler-needle ok";
      $("#needle-l").textContent = kb.toFixed(1) + " KB";
      stamp.textContent = FR.t("Ready", "तैयार"); stamp.className = "stamp ok";
      verdict.className = "note";
      verdict.textContent = r.padded
        ? FR.t("Picture was smaller than " + cur.min + " KB even at best quality, so blank space was added inside the file to reach the minimum.",
               "सबसे अच्छी क्वालिटी पर भी फ़ोटो " + cur.min + " KB से कम थी, इसलिए न्यूनतम तक पहुँचने के लिए फ़ाइल में खाली जगह जोड़ी गई।")
        : FR.t("Saved at " + Math.round(r.quality * 100) + "% quality, inside the " + cur.min + " - " + cur.max + " KB range.",
               Math.round(r.quality * 100) + "% क्वालिटी पर सेव, " + cur.min + " - " + cur.max + " KB के अंदर।");
    }
    var img = $("#out-img"); if (img._u) URL.revokeObjectURL(img._u);
    img._u = URL.createObjectURL(r.blob || await new Promise(function (ok) { c.toBlob(ok, "image/jpeg", .5); })); img.src = img._u;
    requestAnimationFrame(function () { stamp.classList.add("show"); });
  }

  async function open(files) {
    try {
      var img = await FR.loadImage(files[0]);
      $("#drop").hidden = true; $("#editor").hidden = false;
      crop.setAspect(cur.w, cur.h); crop.setImage(img); schedule();
    } catch (e) { FR.toast(FR.t("That file could not be opened as a picture.", "यह फ़ाइल फ़ोटो की तरह नहीं खुल सकी।")); }
  }

  FR.dropZone($("#drop"), $("#file"), open);
  crop.onChange(schedule);
  $("#rot").addEventListener("click", function () { crop.rotate(); });
  $("#reset").addEventListener("click", function () { crop.reset(); });
  $("#change").addEventListener("click", function () { $("#file").click(); });
  $("#ink").addEventListener("change", schedule);
  $("#namedate").addEventListener("change", function () { $("#nd-flds").hidden = !this.checked; schedule(); });
  $("#nd-name").addEventListener("input", schedule); $("#nd-date").addEventListener("change", schedule);
  ["w", "h", "min", "max"].forEach(function (k) {
    $("#" + k).addEventListener("change", function () {
      var w = Math.max(20, Math.min(4000, +$("#w").value || cur.w)), h = Math.max(20, Math.min(4000, +$("#h").value || cur.h));
      var mn = Math.max(1, +$("#min").value || 1), mx = Math.max(mn + 1, +$("#max").value || cur.max);
      cur = { w: w, h: h, min: mn, max: mx };
      $("#w").value = w; $("#h").value = h; $("#min").value = mn; $("#max").value = mx;
      crop.setAspect(w, h); paintSpec(); schedule();
    });
  });
  $("#dl").addEventListener("click", function () {
    if (!blob) return;
    FR.download(blob, exSel.value + "-" + docSel.value + "-" + cur.w + "x" + cur.h + ".jpg");
    FR.toast(FR.t("Saved to your downloads", "डाउनलोड में सेव हो गई"));
  });
  exSel.addEventListener("change", function () { fillDocs(); applyPreset(); });
  docSel.addEventListener("change", applyPreset);
  FR.onLang(function () { fillExams(); fillDocs(); paintSpec(); sizeTable(); if (crop.hasImage()) build(); });

  fillExams();
  try { var p = (localStorage.getItem("fr-pick") || "").split("|"); if (p[0]) { exSel.value = p[0]; } } catch (e) {}
  if (!exSel.value) exSel.selectedIndex = 0;
  fillDocs();
  try { if (p && p[1]) docSel.value = p[1]; } catch (e) {}
  if (!docSel.value) docSel.selectedIndex = 0;
  applyPreset(); sizeTable();
})();
