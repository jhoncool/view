#!/usr/bin/env python3
"""Build the current house viewer and synchronize the GitHub Pages checkout."""

import argparse
from pathlib import Path
import subprocess
import sys


def main():
    root = Path(__file__).resolve().parents[1]
    house = root.parent / "house"
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", nargs="?", type=Path, default=house / "index.html")
    parser.add_argument("--out-dir", type=Path, default=root)
    options = parser.parse_args()
    subprocess.run(
        [sys.executable, str(house / "tools/build_pages.py"),
         "--source", str(options.source), "--out-dir", str(options.out_dir)],
        check=True,
    )


if __name__ == "__main__":
    main()
