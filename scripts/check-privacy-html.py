#!/usr/bin/env python3

from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "public/privacy.html"
REACT = ROOT / "src/screens/PrivacyScreen.tsx"
VERCEL = ROOT / "vercel.json"
NEEDLES = (
    "film journal",
    "Firebase Authentication",
    "shivjethi04@gmail.com",
)


def main() -> None:
    html = HTML.read_text()
    react = REACT.read_text()
    errors: list[str] = []
    if "<div id=\"root\">" in html or "index-" in html:
        errors.append(f"{HTML} looks like the SPA shell, not a privacy policy")
    for needle in NEEDLES:
        if needle not in html:
            errors.append(f"{HTML} is missing {needle!r}")
        if needle not in react:
            errors.append(f"{REACT} is missing {needle!r}")

    rewrites = json.loads(VERCEL.read_text()).get("rewrites") or []
    privacy_idx = next(
        (
            i
            for i, rule in enumerate(rewrites)
            if rule.get("source") == "/privacy" and rule.get("destination") == "/privacy.html"
        ),
        None,
    )
    if privacy_idx is None:
        errors.append(f"{VERCEL} is missing a /privacy -> /privacy.html rewrite")
    catch_idx = next(
        (i for i, rule in enumerate(rewrites) if rule.get("destination") == "/index.html"),
        None,
    )
    if privacy_idx is not None and catch_idx is not None and privacy_idx > catch_idx:
        errors.append(f"{VERCEL} SPA catch-all precedes the /privacy rewrite")

    if errors:
        raise SystemExit("\n".join(errors))
    print(f"{HTML} is crawlable privacy HTML")


if __name__ == "__main__":
    main()
