#!/usr/bin/env python3
"""Download a studio HDRI and a seamless metal normal map from Poly Haven."""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


API = "https://api.polyhaven.com"
OUTPUT = Path.cwd() / "textures"
USER_AGENT = "DeviceTextureSetup/1.0 (urllib.request)"


def get_json(url: str):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def collect_urls(value, path=()):
    """Yield API URLs with their nested quality/format labels."""
    if isinstance(value, dict):
        for key, child in value.items():
            yield from collect_urls(child, path + (str(key).lower(),))
    elif isinstance(value, list):
        for child in value:
            yield from collect_urls(child, path)
    elif isinstance(value, str) and value.startswith(("https://", "http://")):
        yield "/".join(path), value


def polyhaven_file(asset_id: str, predicate, description: str) -> str:
    url = f"{API}/files/{urllib.parse.quote(asset_id)}"
    files = get_json(url)
    matches = [(labels, direct_url) for labels, direct_url in collect_urls(files)
               if predicate(labels, direct_url)]
    if not matches:
        raise RuntimeError(f"No {description} download was found for '{asset_id}'.")
    # Prefer a 1K JPG normal for a compact, browser-friendly download.
    matches.sort(key=lambda item: ("1k" not in item[0], "jpg" not in item[0], len(item[0])))
    return matches[0][1]


def download(url: str, destination: Path) -> None:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    print(f"\nDownloading {destination.name}")
    print(f"Source: {url}")
    with urllib.request.urlopen(request, timeout=60) as response:
        total = int(response.headers.get("Content-Length", "0"))
        downloaded = 0
        with destination.open("wb") as output:
            while chunk := response.read(128 * 1024):
                output.write(chunk)
                downloaded += len(chunk)
                if total:
                    percent = downloaded * 100 // total
                    print(f"\r  Progress: {percent:3d}% ({downloaded:,}/{total:,} bytes)",
                          end="", flush=True)
                else:
                    print(f"\r  Downloaded: {downloaded:,} bytes", end="", flush=True)
    print(f"\nSaved: {destination} ({destination.stat().st_size:,} bytes)")


def main() -> int:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    try:
        hdri_url = polyhaven_file(
            "studio_small_09",
            lambda labels, url: ".hdr" in url.lower() and "1k" in labels,
            "1K HDRI",
        )

        # Use an actual brushed-metal asset where available. Fall back to the
        # Poly Haven metal plate normal if the brushed asset is unavailable.
        try:
            normal_url = polyhaven_file(
                "brushed_metal",
                lambda labels, url: "nor_gl" in labels and ".jpg" in url.lower() and "1k" in labels,
                "1K JPG OpenGL normal map",
            )
        except (urllib.error.HTTPError, RuntimeError):
            print("Brushed metal map is unavailable; using the CC0 metal_plate_02 normal map.")
            normal_url = polyhaven_file(
                "metal_plate_02",
                lambda labels, url: "nor_gl" in labels and ".jpg" in url.lower() and "1k" in labels,
                "1K JPG OpenGL normal map",
            )

        download(hdri_url, OUTPUT / "studio.hdr")
        download(normal_url, OUTPUT / "brushed_normal.jpg")
        print("\nTexture downloads complete.")
        return 0
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, RuntimeError) as error:
        print(f"Download failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
