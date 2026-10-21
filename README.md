# FormReady

Free exam-form toolkit that runs entirely in the browser. Files never leave the device.

- **Photo & signature** (`index.html`): exam presets (SSC, IBPS/SBI, UPSC, NEET, JEE/CUET, RRB, custom), drag/zoom crop, signature clean-up, name + date strip, JPEG fitted inside the KB range (upper limit counted as 1000 bytes/KB, lower as 1024, so it passes either way), 200 DPI written into the file.
- **Passport photo sheet** (`passport.html`): 35x45 mm, 2x2 inch or stamp size on 4x6 (borderless allowed) or A4 (5 mm printer margin), JPG at 300 DPI or PDF.
- **PDF tools** (`pdf.html`): images to PDF with a "keep under KB" limit, and merge PDFs.

## Editing

Pages are built from `_src/`: shared head, header and footer live in `_src/_head.html`, `_header.html`, `_footer.html`.

```
python build.py      # writes index.html, passport.html, pdf.html, privacy.html
python _icons.py     # redraws icons and assets/og.png
```

Exam sizes are in `assets/presets.js`. Limits change between notifications - review them each exam season.
Bump `CACHE` in `sw.js` when shipping changes.

Uses [pdf-lib](https://github.com/Hopding/pdf-lib) 1.17.1 (MIT, `assets/vendor`).
