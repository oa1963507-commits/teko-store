#!/usr/bin/env python3
"""Import the original TEKO gallery ZIP without modifying PNG bytes.

The uploaded original archive is named معرض الصور.zip at repo root.
The release workflow automatically imports 92 images and removes the archive
from the repository, keeping the public gallery JSON and the original artwork.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
import unicodedata
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "معرض الصور.zip"
PUBLIC_ASSETS = ROOT / "assets" / "design-gallery"
CATALOG = ROOT / "catalog" / "gallery.json"
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
MAX_FILES = 250
MAX_TOTAL = 150 * 1024 * 1024
MAX_SINGLE = 15 * 1024 * 1024


def slugify(name: str) -> str:
    name = name.replace("♥", " heart ").replace("❤", " heart ")
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "design"


def identity(original: str, number: int) -> tuple[str, str]:
    stem = Path(original).stem.strip()
    if re.fullmatch(r"[a-zA-Z]♥(?: copy(?:-\d+)?)?", stem):
        match = re.match(r"([a-zA-Z])♥", stem)
        title = match.group(1).upper() + " ♥"
        if "copy" in stem:
            title += " · نسخة إضافية"
        if re.search(r"-\d+$", stem):
            title += " " + stem.rsplit("-", 1)[-1]
        return title, "حروف وقلوب"
    if stem.lower().startswith("layer") or stem.lower() in ("vector smart object",):
        return f"تصميم {number:03d}", "تصميمات متنوعة"
    if "♥" in stem or "❤" in stem:
        return stem.replace(" copy", " · نسخة إضافية"), "حروف وقلوب"
    if any(token in stem.lower() for token in ("love", "arms", "hero", "world", "dich")):
        return stem.replace("_", " ")[:78], "عبارات وكابلز"
    return stem.replace("_", " ")[:78], "تصميمات متنوعة"


def import_gallery() -> int:
    if not ARCHIVE.exists():
        print("TEKO gallery: no upload archive; nothing to import.")
        return 0

    with zipfile.ZipFile(ARCHIVE) as archive:
        entries = [item for item in archive.infolist() if not item.is_dir()]
        if not entries:
            raise ValueError("The uploaded archive has no images")
        if len(entries) > MAX_FILES:
            raise ValueError("Too many assets in uploaded archive")
        if len(entries) != 92:
            raise ValueError(f"Expected exactly 92 artwork images, got {len(entries)}")
        if sum(item.file_size for item in entries) > MAX_TOTAL:
            raise ValueError("Uploaded image archive is too large")
        if any(item.file_size > MAX_SINGLE for item in entries):
            raise ValueError("An artwork image exceeds the size limit")

        # Collect every image and validate the complete archive before any writes.
        prepared = []
        seen_ids: set[str] = set()
        seen_names: set[str] = set()
        for position, entry in enumerate(entries, start=1):
            name = entry.filename
            if (not name.lower().endswith(".png") or name.startswith("/")
                    or "\\" in name or ".." in Path(name).parts
                    or (entry.external_attr >> 16) & 0o170000 == 0o120000):
                raise ValueError(f"Unsafe or non-PNG image entry: {name!r}")
            data = archive.read(entry)  # also verifies the ZIP CRC
            if not data.startswith(PNG_MAGIC):
                raise ValueError(f"Invalid PNG signature: {name!r}")
            digest = hashlib.sha256(data).hexdigest()
            # Distinct original filenames remain independent, even if visually similar.
            image_id = f"img-{position:03d}-{digest[:10]}"
            short = slugify(Path(name).stem)
            # The number makes case-sensitive and same-name originals collision safe.
            target_name = f"{position:03d}-{short}.png"
            if image_id in seen_ids or target_name in seen_names:
                raise ValueError("Duplicated import identity or target name")
            seen_ids.add(image_id)
            seen_names.add(target_name)
            title, category = identity(name, position)
            prepared.append((target_name, data, {
                "id": image_id,
                "title": title,
                "category": category,
                "kind": "image",
                "src": f"assets/design-gallery/{target_name}",
                "originalName": name.rsplit("/", 1)[-1],
                "sha256": digest,
                "featured": False,
            }))

    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    old_items = catalog.get("items", [])
    if not isinstance(old_items, list):
        raise ValueError("Public TEKO catalog must have an items array")
    old_ids = {item.get("id") for item in old_items if isinstance(item, dict)}
    # Never alter the original four typography designs or existing gallery items.
    new_items = [entry for _, _, entry in prepared if entry["id"] not in old_ids]
    PUBLIC_ASSETS.mkdir(parents=True, exist_ok=True)
    for target_name, data, entry in prepared:
        dest = PUBLIC_ASSETS / target_name
        if dest.exists():
            existing_digest = hashlib.sha256(dest.read_bytes()).hexdigest()
            if existing_digest != entry["sha256"]:
                raise ValueError(f"Existing asset conflicts with upload: {target_name}")
        else:
            dest.write_bytes(data)
    catalog["items"] = old_items + new_items
    CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    ARCHIVE.unlink()
    print(f"TEKO gallery imported {len(prepared)} original PNG files; "
          f"added {len(new_items)} catalog entries; total {len(catalog['items'])} items.")
    return len(new_items)


if __name__ == "__main__":
    try:
        import_gallery()
    except (OSError, ValueError, zipfile.BadZipFile, json.JSONDecodeError) as exc:
        print(f"TEKO GALLERY IMPORT FAILED: {exc}", file=sys.stderr)
        raise SystemExit(1)
