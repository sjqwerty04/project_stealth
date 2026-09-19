#!/usr/bin/env python3

from __future__ import annotations

import struct
import sys
from pathlib import Path

ICON = (
    Path(__file__).resolve().parents[1]
    / "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
)


def inspect_png(path: Path) -> tuple[int, int, int, bool]:
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit(f"{path} is not a PNG")
    width = height = color = None
    has_trns = False
    offset = 8
    while offset < len(data):
        length = struct.unpack(">I", data[offset : offset + 4])[0]
        chunk_type = data[offset + 4 : offset + 8]
        chunk = data[offset + 8 : offset + 8 + length]
        if chunk_type == b"IHDR":
            width, height, _bit, color, _comp, _filt, _inter = struct.unpack(
                ">IIBBBBB", chunk
            )
        elif chunk_type == b"tRNS":
            has_trns = True
        elif chunk_type == b"IEND":
            break
        offset += 12 + length
    if width is None or height is None or color is None:
        raise SystemExit(f"{path} has no IHDR")
    return width, height, color, has_trns


def main() -> None:
    width, height, color, has_trns = inspect_png(ICON)
    errors: list[str] = []
    if (width, height) != (1024, 1024):
        errors.append(f"size {width}x{height}, expected 1024x1024")
    if color != 2:
        errors.append(f"PNG color type {color}, expected 2 (RGB, no alpha)")
    if has_trns:
        errors.append("tRNS chunk present")
    if errors:
        raise SystemExit(f"{ICON}: " + "; ".join(errors))
    print(f"{ICON} is 1024x1024 RGB")


if __name__ == "__main__":
    main()
