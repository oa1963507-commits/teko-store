"""Regression tests for TEKO lossless ZIP import (no user artwork in repository)."""
import base64
import hashlib
import importlib.util
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "import_gallery.py"
SPEC = importlib.util.spec_from_file_location("teko_gallery_import", SCRIPT)
MOD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MOD)
PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwC"
    "AAAAC0lEQVR42mP8/x8AAwMCAO+/3S0AAAAASUVORK5CYII="
)


class GalleryImportTests(unittest.TestCase):
    def test_92_images_are_imported_without_reencoding(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "catalog").mkdir()
            original = [{"id": "g" + str(i), "title": str(i), "kind": "text"} for i in range(1, 5)]
            (root / "catalog/gallery.json").write_text(
                json.dumps({"version": 1, "items": original}), encoding="utf8"
            )
            archive_path = root / "معرض الصور.zip"
            with zipfile.ZipFile(archive_path, "w") as archive:
                for i in range(92):
                    archive.writestr("معرض الصور/Layer " + str(i) + ".png", PNG)
            old = (MOD.ROOT, MOD.ARCHIVE, MOD.PUBLIC_ASSETS, MOD.CATALOG)
            try:
                MOD.ROOT = root
                MOD.ARCHIVE = archive_path
                MOD.PUBLIC_ASSETS = root / "assets/design-gallery"
                MOD.CATALOG = root / "catalog/gallery.json"
                self.assertEqual(MOD.import_gallery(), 92)
                items = json.loads(MOD.CATALOG.read_text(encoding="utf8"))["items"]
                self.assertEqual(items[:4], original)
                self.assertEqual(len(items), 96)
                self.assertEqual(len(list(MOD.PUBLIC_ASSETS.glob("*.png"))), 92)
                self.assertEqual(len({item["id"] for item in items}), 96)
                self.assertTrue(all(item["kind"] == "image" for item in items[4:]))
                for item in items[4:]:
                    raw = (root / item["src"]).read_bytes()
                    self.assertEqual(raw, PNG)
                    self.assertEqual(hashlib.sha256(raw).hexdigest(), item["sha256"])
                self.assertFalse(archive_path.exists())
                self.assertEqual(MOD.import_gallery(), 0)
            finally:
                MOD.ROOT, MOD.ARCHIVE, MOD.PUBLIC_ASSETS, MOD.CATALOG = old

    def test_directory_traversal_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "catalog").mkdir()
            (root / "catalog/gallery.json").write_text('{"items":[]}', encoding="utf8")
            archive_path = root / "معرض الصور.zip"
            with zipfile.ZipFile(archive_path, "w") as archive:
                for i in range(91):
                    archive.writestr("images/image-" + str(i) + ".png", PNG)
                archive.writestr("../outside.png", PNG)
            old = (MOD.ROOT, MOD.ARCHIVE, MOD.PUBLIC_ASSETS, MOD.CATALOG)
            try:
                MOD.ROOT, MOD.ARCHIVE = root, archive_path
                MOD.PUBLIC_ASSETS = root / "assets/design-gallery"
                MOD.CATALOG = root / "catalog/gallery.json"
                with self.assertRaises(ValueError):
                    MOD.import_gallery()
                self.assertFalse((root / "assets/design-gallery").exists())
                self.assertTrue(archive_path.exists())
            finally:
                MOD.ROOT, MOD.ARCHIVE, MOD.PUBLIC_ASSETS, MOD.CATALOG = old


if __name__ == "__main__":
    unittest.main()
