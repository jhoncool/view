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
    parser.add_argument("source", nargs="?", type=Path)
    parser.add_argument("--out-dir", type=Path, default=root)
    options = parser.parse_args()
    command = [sys.executable, str(house / "tools/build_pages.py"), "--out-dir", str(options.out_dir)]
    if options.source is not None:
        command.extend(["--source", str(options.source)])
    subprocess.run(command, check=True)


if __name__ == "__main__":
    main()
