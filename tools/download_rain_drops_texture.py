#!/usr/bin/env python3
"""Download the seamless CC0 rain-droplet normal map for the device demo."""

from __future__ import annotations

import io
import sys
import urllib.error
import urllib.request
import zipfile
from pathlib import Path


# TextureCan's CC0 Rain Droplet PBR pack. Use the OpenGL tangent-space map,
# which matches Three.js normal-map conventions. Only that map goes in the site.
URL = "https://www.texturecan.com/downloads/others_0004/others_0004_1k_zau8QF.zip"
NORMAL_MAP = "others_0004_normal_opengl_1k.png"
DESTINATION = Path(__file__).resolve().parents[1] / "device-demo" / "rain_drops_normal.png"
USER_AGENT = "SpecElectronicsTextureSetup/1.0"


def main() -> int:
    DESTINATION.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(URL, headers={"User-Agent": USER_AGENT})
    try:
        print(f"Downloading the 1K seamless rain-droplet map for {DESTINATION.parent}")
        archive_data = io.BytesIO()
        with urllib.request.urlopen(request, timeout=60) as response:
            total = int(response.headers.get("Content-Length", "0"))
            downloaded = 0
            while chunk := response.read(128 * 1024):
                archive_data.write(chunk)
                downloaded += len(chunk)
                if total:
                    percent = downloaded * 100 // total
                    print(f"\rProgress: {percent:3d}% ({downloaded:,}/{total:,} bytes)", end="", flush=True)
                else:
                    print(f"\rDownloaded: {downloaded:,} bytes", end="", flush=True)

        with zipfile.ZipFile(archive_data) as archive:
            image = archive.read(NORMAL_MAP)
        if not image.startswith(b"\x89PNG\r\n\x1a\n"):
            raise RuntimeError("The archive entry is not a PNG normal map.")

        temporary = DESTINATION.with_suffix(".png.part")
        temporary.write_bytes(image)
        temporary.replace(DESTINATION)
        print(f"\nSaved {DESTINATION} ({DESTINATION.stat().st_size:,} bytes)")
        return 0
    except (OSError, urllib.error.URLError, TimeoutError, zipfile.BadZipFile, KeyError, RuntimeError) as error:
        print(f"\nTexture download failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
