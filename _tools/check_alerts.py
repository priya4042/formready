"""Collect admit card / result / answer key / notice alerts from official exam sites.

Usage:
  python _tools/check_alerts.py           write candidates to _tools/alerts_candidates.json
  python _tools/check_alerts.py --apply   also merge them into data/app.json (and the app copy)

Standard library only, so the GitHub Actions runner needs nothing extra.
"""

import argparse
import datetime as dt
import gzip
import hashlib
import html
import http.cookiejar
import json
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zlib
from pathlib import Path

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36")
TIMEOUT = 20
SITE_BUDGET = 150   # seconds per site, so one slow site cannot use up the whole run
RUN_BUDGET = 900    # seconds for all sites (the workflow allows 20 minutes)
MAX_AGE_DAYS = 60
MAX_ALERTS = 60
IST = dt.timezone(dt.timedelta(hours=5, minutes=30))

SITE_DIR = Path(__file__).resolve().parent.parent
APP_JSON = SITE_DIR / "data" / "app.json"
APP_COPY = SITE_DIR.parent / "formready_app" / "assets" / "data" / "app.json"
CANDIDATES = Path(__file__).resolve().parent / "alerts_candidates.json"

EXAM_LABEL = {
    "ssc": "SSC", "upsc": "UPSC", "ibps": "IBPS", "sbi": "SBI", "neet": "NEET",
    "jee": "JEE", "cuet": "CUET", "ugcnet": "UGC NET", "rrb": "RRB", "nta": "NTA",
}
KIND_HI = {
    "admit": "एडमिट कार्ड जारी",
    "result": "रिज़ल्ट जारी",
    "answerkey": "आंसर की जारी",
    "notice": "नया नोटिस",
}
# nbsp, replacement char, dashes, curly quotes and ellipsis to plain ASCII
PUNCT = {0xA0: " ", 0xFFFD: "'", 0x2013: "-", 0x2014: "-", 0x2018: "'", 0x2019: "'",
         0x201C: '"', 0x201D: '"', 0x2026: "..."}
ACRONYMS = {"RRB", "CEN", "CBT", "CBAT", "CBTST", "ALP", "NTPC", "JE", "DV", "PET", "PST", "RPF", "SI", "UGC",
            "NET", "JEE", "NEET", "CUET", "SSC", "UPSC", "IBPS", "SBI", "CGL", "CHSL", "MTS", "GD", "PWBD", "OMR",
            "NTA", "CSIR", "PO", "RRBS", "CRP", "SPL", "II", "III", "IV", "UG", "PG", "NDA", "CDS", "CAPF"}
SKIP_WORDS = re.compile(r"tender|empanel|consultan|refund|departmental|duplicate score|vision certificate", re.I)

TODAY = dt.datetime.now(IST).date()
report = []  # one line per site for the summary


def log(msg):
    print(msg, flush=True)


# ---------- fetching ----------

class BudgetUsed(Exception):
    """A site took longer than SITE_BUDGET; it is skipped and reported."""


class Fetcher:
    """urllib with cookies, gzip, one retry, and an unverified-TLS fallback per host."""

    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.unverified_hosts = set()
        self.deadline = None

    def _check_budget(self):
        if self.deadline and time.time() > self.deadline:
            raise BudgetUsed("time budget for this site used up")

    def _opener(self, verify):
        ctx = ssl.create_default_context() if verify else ssl._create_unverified_context()
        return urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.jar),
            urllib.request.HTTPSHandler(context=ctx))

    def get(self, url, referer=None, accept="text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8"):
        host = urllib.parse.urlsplit(url).hostname or ""
        headers = {"User-Agent": UA, "Accept": accept,
                   "Accept-Language": "en-IN,en;q=0.9", "Accept-Encoding": "gzip, deflate"}
        if referer:
            headers["Referer"] = referer
        verify = host not in self.unverified_hosts
        last = None
        for attempt in range(2):
            self._check_budget()
            try:
                with self._opener(verify).open(urllib.request.Request(url, headers=headers), timeout=TIMEOUT) as r:
                    body = bytearray()
                    while True:
                        chunk = r.read(65536)
                        if not chunk:
                            break
                        body += chunk
                        self._check_budget()
                    return self._decode(bytes(body), r.headers)
            except (urllib.error.HTTPError, BudgetUsed):
                raise
            except Exception as e:  # noqa: BLE001
                last = e
                if verify and _is_cert_error(e):
                    log(f"  ! TLS verification failed for {host} ({_short(e)}); retrying without verification")
                    self.unverified_hosts.add(host)
                    verify = False
                    continue
                if attempt == 0:
                    time.sleep(3)
                    continue
                raise
        raise last

    @staticmethod
    def _decode(body, headers):
        enc = (headers.get("Content-Encoding") or "").lower()
        if body[:2] == b"\x1f\x8b" or enc == "gzip":
            body = gzip.decompress(body)
        elif enc == "deflate":
            try:
                body = zlib.decompress(body)
            except zlib.error:
                body = zlib.decompress(body, -zlib.MAX_WBITS)
        charset = headers.get_content_charset() or "utf-8"
        try:
            return body.decode(charset)
        except (LookupError, UnicodeDecodeError):
            return body.decode("utf-8", "replace")


def _is_cert_error(e):
    reason = getattr(e, "reason", e)
    return isinstance(reason, ssl.SSLCertVerificationError) or "CERTIFICATE_VERIFY_FAILED" in str(e)


def _is_timeout(e):
    return "timed out" in str(e).lower() or isinstance(getattr(e, "reason", e), TimeoutError)


def _short(e):
    if isinstance(e, urllib.error.HTTPError):
        return f"HTTP {e.code}"
    return f"{type(e).__name__}: {str(getattr(e, 'reason', e))[:120]}"


# ---------- text helpers ----------

def clean(text):
    text = html.unescape(re.sub(r"<[^>]+>", " ", text or ""))
    text = text.translate(PUNCT)
    text = re.sub(r"\s+", " ", text).strip(" -|:")
    text = re.sub(r"\s*-?\s*\breg(?:\.|d\.?)?$", "", text, flags=re.I)
    text = re.sub(r"^click here to (?:view|download)(?: and download)?\s+", "", text, flags=re.I)
    letters = [c for c in text if c.isalpha()]
    if len(letters) > 20 and sum(c.isupper() for c in letters) / len(letters) > 0.7:
        # shouting titles: lower-case them, then restore known acronyms
        text = re.sub(r"[a-z]+", lambda m: m.group(0).upper() if m.group(0).upper() in ACRONYMS else m.group(0),
                      text.lower())
    text = text.strip(" -.")
    return text[:1].upper() + text[1:]


def trim(text, n=110):
    if len(text) <= n:
        return text
    cut = text[:n - 3].rsplit(" ", 1)[0]
    return cut.rstrip(" ,;:-(") + "..."


def kind_of(title):
    t = title.lower()
    if "answer key" in t or "answer-key" in t or "answerkey" in t:
        return "answerkey"
    if re.search(r"admit card|e-admit|hall ticket|call letter|admission certificate", t):
        return "admit"
    if re.search(r"city intimation|intimation .*city|examination city", t):
        return "notice"
    if re.search(r"\bresults?\b|\bmarks\b|score ?card|\bscores\b|cut-?off", t):
        return "result"
    if "notice" in t:
        return "notice"
    return None


def exam_of(title, default):
    t = title.upper()
    if "CSIR" in t:
        return "nta"
    if re.search(r"UGC[\s-]*NET", t):
        return "ugcnet"
    for key, pat in (("neet", r"\bNEET\b"), ("jee", r"\bJEE\b"), ("cuet", r"\bCUET\b"),
                     ("sbi", r"\bSBI\b"), ("ibps", r"\bIBPS\b"), ("rrb", r"\bRRB\b"),
                     ("upsc", r"\bUPSC\b"), ("ssc", r"\bSSC\b")):
        if re.search(pat, t):
            return key
    return default


def valid_date(y, m, d):
    try:
        day = dt.date(int(y), int(m), int(d))
    except ValueError:
        return None
    if day > TODAY + dt.timedelta(days=1) or day < dt.date(2015, 1, 1):
        return None
    return day


def make_alert(source, title, url, date, default_exam, kind=None):
    title = clean(title)
    if not title or SKIP_WORDS.search(title):
        return None
    kind = kind or kind_of(title)
    if not kind:
        return None
    if date is None:
        date = TODAY
    if (TODAY - date).days > MAX_AGE_DAYS:
        return None
    exam = exam_of(title, default_exam)
    en = trim(title)
    hi = f"{EXAM_LABEL.get(exam, exam.upper())}: {KIND_HI[kind]} - {en}"
    digest = hashlib.sha1(f"{url}|{en.lower()}".encode("utf-8")).hexdigest()[:6]
    return {"id": f"{exam}-{digest}", "exam": exam, "kind": kind, "en": en, "hi": hi,
            "date": date.isoformat(), "url": url, "_source": source}


def https(url):
    # these hosts serve the same files over https
    for host in ("cdnbbsr.s3waas.gov.in", "nta.ac.in", "www.upsc.gov.in", "upsc.gov.in"):
        if url.startswith(f"http://{host}/"):
            return "https://" + url[len("http://"):]
    return url


def links(page, base):
    """Yield (absolute href, inner html) for every <a> on the page."""
    page = re.sub(r"<script.*?</script>|<style.*?</style>", "", page, flags=re.S | re.I)
    for m in re.finditer(r"<a\b([^>]*)>(.*?)</a>", page, re.S | re.I):
        href = re.search(r"""href\s*=\s*["']([^"']+)["']""", m.group(1), re.I)
        if not href:
            continue
        h = html.unescape(href.group(1)).strip()
        if h.startswith(("#", "javascript:", "mailto:")):
            continue
        yield https(urllib.parse.urljoin(base, h).replace(" ", "%20")), m.group(2)


# ---------- sites ----------

def site_ssc(f):
    api = "https://ssc.gov.in/api/general-website/portal/records"
    attrs = "id,headline,examId,examYear,contentType,redirectUrl,startDate,endDate,language,createdAt"
    out, seen = [], set()
    # specific lists first so their kind wins over the generic notice board
    for ctype, kind in (("answer-key", "answerkey"), ("admit-card", "admit"),
                        ("results", "result"), ("notice-boards", None)):
        q = urllib.parse.urlencode({"page": 1, "limit": 30, "contentType": ctype, "key": "createdAt",
                                    "order": "DESC", "isAttachment": "true", "language": "english",
                                    "attributes": attrs})
        data = json.loads(f.get(f"{api}?{q}", referer="https://ssc.gov.in/", accept="application/json"))
        if str(data.get("statusCode")) != "200":
            raise RuntimeError(f"SSC API said {data.get('statusCode')}: {data.get('error')}")
        for rec in data.get("data") or []:
            title = clean(rec.get("headline"))
            key = re.sub(r"\W+", "", title.lower())
            if not title or key in seen:
                continue
            url = (rec.get("redirectUrl") or "").strip()
            atts = rec.get("attachments") or []
            if not url and atts:
                url = "https://ssc.gov.in/api/attachment/" + atts[-1]["path"].replace("\\", "/")
            if not url:
                continue
            url = url.replace(" ", "%20")
            created = rec.get("createdAt") or ""
            day = None
            if created:
                stamp = dt.datetime.fromisoformat(created.replace("Z", "+00:00")).astimezone(IST)
                day = stamp.date()
            if kind == "result" and kind_of(title) not in ("result", "answerkey", "admit"):
                kind_here = "result"
            else:
                kind_here = kind_of(title) if kind in (None, "result") else kind
            a = make_alert("ssc", title, url, day, "ssc", kind_here)
            if a:
                seen.add(key)
                out.append(a)
    return out


def _upsc_date_from_pdf(url):
    name = urllib.parse.unquote(url.rsplit("/", 1)[-1])
    for m in re.finditer(r"(?<!\d)(\d{2})(\d{2})(\d{4}|\d{2})(?!\d)", name):
        d, mth, y = m.groups()
        y = int(y) + 2000 if len(y) == 2 else int(y)
        day = valid_date(y, mth, d)
        if day:
            return day
    return None


def site_upsc(f):
    base = "https://www.upsc.gov.in/"
    page = f.get(base)
    start = page.find("whats-new-marq")
    block = page[start:page.find("</section", start)] if start >= 0 else ""
    if not block:
        raise RuntimeError("What's New block not found on the home page")
    out = []
    for url, inner in links(block, base):
        title = clean(inner)
        if not title or title.lower().startswith("view all") or not kind_of(title):
            continue
        pdf = url if url.lower().endswith(".pdf") else None
        if not pdf and "/whats-new/" in url:
            try:
                detail = f.get(url, referer=base)
                m = re.search(r'href="([^"]+\.pdf)"', detail, re.I)
                pdf = urllib.parse.urljoin(url, m.group(1)) if m else None
            except Exception as e:  # noqa: BLE001
                log(f"  upsc detail failed: {url} ({_short(e)})")
        day = _upsc_date_from_pdf(pdf) if pdf else None
        a = make_alert("upsc", title, url, day, "upsc")
        if a:
            out.append(a)
    return out


def site_ibps(f):
    base = "https://www.ibps.in/"
    page = f.get(base)
    out = []
    for card in re.split(r'<div class="custom-card">', page)[1:]:
        head = re.search(r'heading-details[^>]*>(.*?)</h3>', card, re.S)
        posted = re.search(r"Posted on\s*(\d{1,2})\s+([A-Za-z]{3})[a-z]*,?\s*(\d{4})", card)
        sub = re.search(r'<a href="([^"]*)"[^>]*>\s*<p class="sub-heading"[^>]*>(.*?)</p>', card, re.S)
        if not sub:
            continue
        title = clean(sub.group(2))
        if head and clean(head.group(1)) and clean(head.group(1)) not in title:
            title = f"{clean(head.group(1))}: {title}"
        if "IBPS" not in title.upper():
            title = "IBPS " + title
        day = None
        if posted:
            try:
                day = dt.datetime.strptime(" ".join(posted.groups()), "%d %b %Y").date()
            except ValueError:
                day = None
        a = make_alert("ibps", title, urllib.parse.urljoin(base, html.unescape(sub.group(1))), day, "ibps")
        if a:
            out.append(a)
    return out


def _s3waas_date(url):
    m = re.search(r"/uploads/(\d{4})/(\d{2})/(\d{4})(\d{2})(\d{2})\d*\.pdf$", url, re.I)
    if not m:
        return None, None
    up_y, up_m, y, mth, d = m.groups()
    return valid_date(y, mth, d), valid_date(up_y, up_m, 1)


def site_nta_portal(name, base, default_exam):
    """NTA exam sites on the S3WaaS template: notices are PDF links with the date in the file name."""
    def run(f):
        page = f.get(base)
        out, seen = [], set()
        for url, inner in links(page, base):
            if "/uploads/" not in url or not url.lower().endswith(".pdf") or url in seen:
                continue
            seen.add(url)
            day, upload_month = _s3waas_date(url)
            if day is None and upload_month and (TODAY - upload_month).days > MAX_AGE_DAYS:
                continue
            a = make_alert(name, inner, url, day, default_exam)
            if a:
                out.append(a)
        return out
    return run


def site_nta_main(f):
    base = "https://nta.ac.in/"
    page = f.get(base)
    start = page.find("latestPart")
    block = page[start:page.find("</marquee>", start)] if start >= 0 else ""
    if not block:
        raise RuntimeError("'Latest @ NTA' block not found")
    out = []
    for p in re.findall(r"<p>(.*?)</p>", block, re.S):
        content = re.search(r"<content[^>]*>(.*?)</content>", p, re.S)
        a_tag = re.search(r"""<a\b[^>]*href=["']([^"']+)["'][^>]*>(.*?)</a>""", p, re.S)
        if not a_tag:
            continue
        url = https(urllib.parse.urljoin(base, html.unescape(a_tag.group(1))).replace(" ", "%20"))
        title = clean(content.group(1)) if content else clean(a_tag.group(2))
        day = None
        m = re.search(r"Notice_(\d{4})(\d{2})(\d{2})", url)
        if m:
            day = valid_date(*m.groups())
        else:
            day = _s3waas_date(url)[0]
        a = make_alert("nta", title, url, day, "nta")
        if a:
            out.append(a)
    return out


RRB_CATEGORIES = {"E-Call Letters": "admit", "Exam Results": "result",
                  "City Intimation (Exam)": "notice", "Special Notice on Examination": "notice"}


def site_rrb(f):
    base = "https://rrb.indianrailways.gov.in/chandigarh"
    page = f.get(base)  # also sets the cookies the detail pages need
    groups = {}
    for m in re.finditer(r'<li><a\s+href="(/getdata\?[^"]+)">(.*?)</a></li>', page, re.S):
        href = html.unescape(m.group(1))
        q = urllib.parse.parse_qs(urllib.parse.urlsplit(href).query)
        cat = (q.get("category") or [""])[0]
        pub = re.search(r"\((\d{2})-(\d{2})-(\d{4})\)", m.group(2))
        if cat not in RRB_CATEGORIES or not pub:
            continue
        day = valid_date(pub.group(3), pub.group(2), pub.group(1))
        if not day or (TODAY - day).days > MAX_AGE_DAYS:
            continue
        groups.setdefault(href, day)
    out, seen = [], set()
    # newest groups first; cap the detail fetches
    for href, _ in sorted(groups.items(), key=lambda kv: kv[1], reverse=True)[:15]:
        url = urllib.parse.urljoin(base, href).replace(" ", "%20")
        try:
            detail = f.get(url, referer=base)
        except Exception as e:  # noqa: BLE001
            log(f"  rrb detail failed: {url} ({_short(e)})")
            continue
        if "Request Rejected" in detail[:2000]:
            log(f"  rrb detail rejected by firewall: {url}")
            continue
        for row in re.findall(r'<tr class="publicR">(.*?)</tr>', detail, re.S):
            cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)
            if len(cells) < 5:
                continue
            cen, cat, desc = clean(cells[1]), clean(cells[2]), clean(cells[3])
            pub = re.search(r"(\d{2})-(\d{2})-(\d{4})", cells[4])
            day = valid_date(pub.group(3), pub.group(2), pub.group(1)) if pub else None
            ext = re.search(r"confirmAndOpen\('([^']+)'\)", row)
            # documents and detail pages need the site's firewall cookie, so only external links are direct
            link = ext.group(1).replace(" ", "%20") if ext else base
            title = f"RRB CEN {cen}: {desc}"
            if title in seen:
                continue
            seen.add(title)
            a = make_alert("rrb", title, link, day, "rrb", RRB_CATEGORIES.get(cat) or kind_of(desc))
            if a:
                out.append(a)
    return out


SITES = [
    ("SSC", "https://ssc.gov.in/api/general-website/portal/records", site_ssc),
    ("UPSC", "https://www.upsc.gov.in/", site_upsc),
    ("IBPS", "https://www.ibps.in/", site_ibps),
    ("NTA", "https://nta.ac.in/", site_nta_main),
    ("NEET", "https://neet.nta.nic.in/", site_nta_portal("neet", "https://neet.nta.nic.in/", "neet")),
    ("JEE Main", "https://jeemain.nta.nic.in/", site_nta_portal("jee", "https://jeemain.nta.nic.in/", "jee")),
    ("CUET", "https://cuet.nta.nic.in/", site_nta_portal("cuet", "https://cuet.nta.nic.in/", "cuet")),
    ("UGC NET", "https://ugcnet.nta.nic.in/", site_nta_portal("ugcnet", "https://ugcnet.nta.nic.in/", "ugcnet")),
    ("RRB", "https://rrb.indianrailways.gov.in/chandigarh", site_rrb),
]


# ---------- app.json ----------

def dump_app_json(data):
    """Same layout as the hand-written file: top-level keys indented, list items one per line."""
    def one(v):
        return json.dumps(v, ensure_ascii=False)
    parts = []
    for key, value in data.items():
        if isinstance(value, list):
            if value:
                rows = ",\n".join("    " + one(item) for item in value)
                parts.append(f"  {one(key)}: [\n{rows}\n  ]")
            else:
                parts.append(f"  {one(key)}: []")
        else:
            parts.append(f"  {one(key)}: {one(value)}")
    return "{\n" + ",\n".join(parts) + "\n}\n"


def merge(existing, fresh):
    # existing entries win, so hand-edited titles survive; ids match because they come from url and the raw title
    keep, keys = [], set()
    for a in list(existing) + list(fresh):
        pair = (a.get("url"), a.get("en", "").lower())
        if a.get("id") in keys or pair in keys:
            continue
        keys.update((a.get("id"), pair))
        keep.append({k: a[k] for k in ("id", "exam", "kind", "en", "hi", "date", "url") if k in a})
    keep.sort(key=lambda a: a.get("date", ""), reverse=True)  # stable, so ties keep their order
    return keep[:MAX_ALERTS]


def apply(candidates):
    raw = APP_JSON.read_bytes().decode("utf-8")
    data = json.loads(raw)
    before = data.get("alerts", [])
    alerts = merge(before, candidates)
    if alerts == before:
        log("app.json: no new alerts, file left as is")
        return
    out = {}
    for key, value in data.items():
        out[key] = value
    out["alerts"] = alerts
    # never move "updated" backwards
    if TODAY.isoformat() > str(out.get("updated", "")):
        out["updated"] = TODAY.isoformat()
    text = dump_app_json(out)
    if not raw.endswith("\n"):
        text = text.rstrip("\n")
    json.loads(text)
    APP_JSON.write_bytes(text.encode("utf-8"))
    log(f"app.json: {len(alerts)} alerts ({len(alerts) - len(before):+d}), updated={out['updated']}")
    if APP_COPY.parent.is_dir():
        APP_COPY.write_bytes(APP_JSON.read_bytes())
        log(f"copied to {APP_COPY}")


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--apply", action="store_true", help="merge candidates into data/app.json")
    args = ap.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    f = Fetcher()
    candidates = []
    started = time.time()
    for name, url, fn in SITES:
        log(f"- {name}: {url}")
        if time.time() - started > RUN_BUDGET:
            report.append(f"{name:9} SKIPPED: run time budget used up")
            continue
        f.deadline = time.time() + SITE_BUDGET
        try:
            items = fn(f)
            host = urllib.parse.urlsplit(url).hostname
            note = " (unverified TLS)" if host in f.unverified_hosts else ""
            report.append(f"{name:9} ok{note}: {len(items)} candidate(s)")
            for a in items:
                log(f"    {a['date']} {a['kind']:9} {a['en']}")
            candidates.extend(items)
        except Exception as e:  # noqa: BLE001
            report.append(f"{name:9} FAILED: {_short(e)}")
            log(f"    failed: {_short(e)}")

    candidates.sort(key=lambda a: a["date"], reverse=True)
    CANDIDATES.write_text(json.dumps(candidates, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    log(f"\n{len(candidates)} candidate(s) written to {CANDIDATES}")

    code = 0
    if args.apply:
        try:
            apply(candidates)
        except (OSError, ValueError) as e:
            log(f"app.json could not be read or written: {e}")
            code = 1

    log("\nSummary")
    for line in report:
        log("  " + line)
    if f.unverified_hosts:
        log("  TLS fallback used for: " + ", ".join(sorted(f.unverified_hosts)))
    return code


if __name__ == "__main__":
    sys.exit(main())
