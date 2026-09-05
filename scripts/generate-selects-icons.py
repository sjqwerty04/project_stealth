#!/usr/bin/env python3
"""Rasterize the selectsfilm.com mark into PWA / Apple / favicon PNGs."""

from io import BytesIO
from pathlib import Path

import cairosvg
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"

# Same mark as https://selectsfilm.com/favicon.svg, drawn in a larger
# viewBox so Apple's rounded home-screen mask doesn't clip the shear.
ICON_SVG = """\
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0a0a0b"/>
  <g transform="translate(96,96) skewX(-13.5)">
    <rect x="0" y="32" width="48" height="320" fill="#efede9"/>
    <rect x="80" y="32" width="48" height="320" fill="#efede9"/>
    <rect x="160" y="32" width="48" height="320" fill="#ff3b14"/>
    <rect x="240" y="32" width="48" height="320" fill="#efede9"/>
    <rect x="320" y="32" width="48" height="320" fill="#efede9"/>
  </g>
</svg>
"""

FAVICON_SVG = (PUBLIC / "favicon.svg").read_text()


def svg_to_png(svg: str, size: int) -> Image.Image:
    png = cairosvg.svg2png(
        bytestring=svg.encode("utf-8"),
        output_width=size,
        output_height=size,
        background_color="#0a0a0b",
    )
    return Image.open(BytesIO(png)).convert("RGBA")


def main() -> None:
    icon_512 = svg_to_png(ICON_SVG, 512)
    icon_512.save(PUBLIC / "pwa-512x512.png", "PNG")
    icon_512.resize((192, 192), Image.Resampling.LANCZOS).save(
        PUBLIC / "pwa-192x192.png", "PNG"
    )
    icon_512.resize((180, 180), Image.Resampling.LANCZOS).save(
        PUBLIC / "apple-touch-icon.png", "PNG"
    )
    icon_512.resize((180, 180), Image.Resampling.LANCZOS).save(
        PUBLIC / "selects-icon.png", "PNG"
    )
    icon_512.resize((180, 180), Image.Resampling.LANCZOS).save(
        PUBLIC / "selects-logo.png", "PNG"
    )

    fav32 = svg_to_png(FAVICON_SVG, 32)
    fav32.save(PUBLIC / "favicon-32.png", "PNG")
    fav48 = svg_to_png(FAVICON_SVG, 48)
    fav32.save(
        PUBLIC / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=[
            fav32.resize((16, 16), Image.Resampling.LANCZOS),
            fav48,
        ],
    )
    print("wrote icons in", PUBLIC)


if __name__ == "__main__":
    main()
