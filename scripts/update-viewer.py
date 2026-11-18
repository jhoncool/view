#!/usr/bin/env python3
"""Copy the standalone house viewer and adapt its links for public hosting."""

import argparse
import hashlib
import re
import json
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

# Export only numbered print sheets and the visible page of each original.
# Full-resolution scans load on demand. Keep the source PDFs in house.
project = re.search(r'<script id="project-data" type="application/json">(.*?)</script>', html, re.S)
if not project:
    raise SystemExit("Missing viewer data")
data = json.loads(project.group(1))
source_root = args.source.resolve().parent
sheets = data["sheets"]
manifest = json.loads((source_root / "data/house/print-sheets/manifest.json").read_text())
if set(manifest["sheets"]) != {f"{s['source_id']}:{s['pdf_page']}" for s in sheets}:
    raise SystemExit("Print inventory differs from the sheet catalogue")
assets = [manifest["album"]]
if manifest["album"] != data["print_album"]:
    raise SystemExit("The viewer points to a different album. Rebuild it first.")
for key, record in manifest["sheets"].items():
    for edition, index in [("source", "print_sheets"), ("revision", "revisions")]:
        if edition in record:
            asset = record[edition]
            if data[index][key]["pdf"] != asset["file"]:
                raise SystemExit(f"Stale {edition} path for {key}")
            assets.append(asset)
for asset in assets:
    rel = Path(asset["file"])
    if (rel.parent.as_posix() not in {"data/house/print-sheets", "data/house/revised-sheets"}
            or rel.suffix != ".pdf"):
        raise SystemExit(f"Unexpected print file {rel}")
    contents = (source_root / rel).read_bytes()
    if hashlib.sha256(contents).hexdigest() != asset["sha256"]:
        raise SystemExit(f"Print file has changed: {rel}")
    target = ROOT / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(contents)

for sheet in sheets:
    key = f"{sheet['source_id']}:{sheet['pdf_page']}"
    scan = manifest["sheets"][key]["scan"]
    rel = Path(scan["file"])
    if (rel.parent.as_posix() != "data/house/print-sheets/scans" or rel.suffix != ".webp"
            or data["print_sheets"][key]["scan"] != str(rel)):
        raise SystemExit(f"Unexpected scan path for {key}")
    contents = (source_root / rel).read_bytes()
    if hashlib.sha256(contents).hexdigest() != scan["sha256"]:
        raise SystemExit(f"Scan has changed: {rel}")
    (ROOT / rel).parent.mkdir(parents=True, exist_ok=True)
    (ROOT / rel).write_bytes(contents)

destination = ROOT / "index.html"
destination.write_text(html, encoding="utf-8")
print(f"Source SHA-256: {hashlib.sha256(source).hexdigest()}")
print(f"Public SHA-256: {hashlib.sha256(destination.read_bytes()).hexdigest()}")
print(f"Wrote {destination} ({destination.stat().st_size} bytes)")
