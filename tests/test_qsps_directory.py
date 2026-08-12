import csv
import tempfile
import unittest
from pathlib import Path

from ingestion.transform_qsps_directory import REQUIRED_HEADERS, build


class QspsDirectoryTests(unittest.TestCase):
    def test_latest_period_is_selected(self):
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder) / "table1a.csv"
            headers = sorted(REQUIRED_HEADERS)
            with source.open("w", encoding="utf-8", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=headers)
                writer.writeheader()
                for index in range(701):
                    row = {header: "" for header in headers}
                    row.update({
                        "Product Identifier": f"old-{index}", "Period": "2025-12-31",
                        "RSE name": "Old Fund", "Superannuation Product Name": f"Old {index}",
                    })
                    writer.writerow(row)
                for index in range(701):
                    row = {header: "" for header in headers}
                    row.update({
                        "Product Identifier": f"new-{index}", "Period": "2026-03-31",
                        "RSE name": "Current Fund", "RSE ABN": "123",
                        "Superannuation Product Name": f"Current {index}",
                        "Superannuation Product Type": "Choice Product",
                        "Superannuation Product Phase Type": "Accumulation",
                    })
                    writer.writerow(row)
            metadata = build(source, Path(folder) / "products.json", Path(folder) / "metadata.json")
            self.assertEqual(metadata["reportingDate"], "2026-03-31")
            self.assertEqual(metadata["recordCount"], 701)

    def test_missing_header_fails_closed(self):
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder) / "bad.csv"
            source.write_text("Period\n2026-03-31\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "header contract failed"):
                build(source, Path(folder) / "products.json", Path(folder) / "metadata.json")


if __name__ == "__main__":
    unittest.main()
