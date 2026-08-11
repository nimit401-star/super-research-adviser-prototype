import csv
import json
import tempfile
import unittest
from pathlib import Path

from ingestion.transform import REQUIRED_HEADERS, build


ROOT = Path(__file__).resolve().parents[1]


class TransformTests(unittest.TestCase):
    def test_real_source_outputs_passed_validation(self):
        validation = json.loads((ROOT / "public/data/validation.json").read_text())
        self.assertEqual(validation["status"], "pass")
        self.assertGreaterEqual(validation["scorableRecordCount"], 40)
        self.assertEqual(validation["duplicateProductIds"], [])

    def test_missing_header_fails_closed(self):
        with tempfile.TemporaryDirectory() as folder:
            csv_path = Path(folder) / "bad.csv"
            headers = sorted(REQUIRED_HEADERS - {"rse_name"})
            with csv_path.open("w", newline="", encoding="utf-8") as handle:
                csv.DictWriter(handle, fieldnames=headers).writeheader()
            with self.assertRaisesRegex(ValueError, "header contract failed"):
                build(csv_path, Path(folder) / "out", ROOT / "config/source.json", ROOT / "ingestion/mappings/cppp_mysuper.json")


if __name__ == "__main__":
    unittest.main()

