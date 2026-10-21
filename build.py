# Builds the pages: fills the shared head, header and footer into every _src page.
import os, re
R = os.path.dirname(os.path.abspath(__file__)); S = os.path.join(R, "_src")
rd = lambda n: open(os.path.join(S, n), encoding="utf-8").read()
head, header, footer = rd("_head.html"), rd("_header.html"), rd("_footer.html")
for f in sorted(os.listdir(S)):
    if f.startswith("_") or not f.endswith(".html"): continue
    page = f if f != "index.html" else "./"
    h = re.sub(r' aria-current="page"', "", header)
    i = h.index('<nav class="nav"')
    h = h[:i] + h[i:].replace(f'<a href="{page}">', f'<a href="{page}" aria-current="page">', 1)
    out = rd(f).replace("{{HEAD}}", head).replace("{{HEADER}}", h).replace("{{FOOTER}}", footer)
    open(os.path.join(R, f), "w", encoding="utf-8", newline="\n").write(out)
    print("built", f)
