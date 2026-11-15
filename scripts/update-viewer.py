#!/usr/bin/env python3
"""Copy the standalone house viewer and adapt its links for public hosting."""

import argparse
import hashlib
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("source", nargs="?", type=Path, default=ROOT.parent / "house" / "index.html")
args = parser.parse_args()
source = args.source.read_bytes()
html = source.decode("utf-8")

robots = '<meta name="robots" content="noindex, nofollow, noimageindex">'
if '<meta name="robots"' not in html:
    if html.count('<meta charset="utf-8">') != 1:
        raise SystemExit("Expected a single UTF-8 declaration; inspect the source before publishing.")
    html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">' + robots, 1)
elif robots not in html:
    raise SystemExit("The source has a different robots policy; inspect it before publishing.")

# The public repository contains embedded previews, not the source PDFs or 300 dpi archive.
public_links = '''function sourceLinks(s,p){const i=pageInfo(s,p);return `<div class="dialog-links"><a href="${DATA.images[sheetKey(s,p)]}" download="${s}-page-${p}-preview.jpg">Скачать превью листа</a><span>${esc(i.filename)} · ${esc(i.sheet||'информационное приложение')}</span></div><p class="tiny muted">Превью исходного листа встроено в HTML. Оригинальные PDF и изображения 300 dpi хранятся в рабочем архиве проекта.</p>`;}'''
html, count = re.subn(r"^function sourceLinks\(s,p\)\{[^\n]*$", lambda _: public_links, html, flags=re.MULTILINE)
if count != 1:
    raise SystemExit("Expected a single sourceLinks function; inspect the source before publishing.")

destination = ROOT / "index.html"
destination.write_text(html, encoding="utf-8")
print(f"Source SHA-256: {hashlib.sha256(source).hexdigest()}")
print(f"Public SHA-256: {hashlib.sha256(destination.read_bytes()).hexdigest()}")
print(f"Wrote {destination} ({destination.stat().st_size} bytes)")
