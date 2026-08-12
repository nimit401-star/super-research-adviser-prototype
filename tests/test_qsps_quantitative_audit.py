import csv
import tempfile
import unittest
from pathlib import Path

from ingestion.audit_qsps_quantitative import audit


class AuditTests(unittest.TestCase):
    def write_csv(self, root, name, headers, rows):
        with (Path(root) / name).open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=headers)
            writer.writeheader()
            writer.writerows(rows)

    def test_identifies_option_join_tables_without_enabling_ranking(self):
        with tempfile.TemporaryDirectory() as root:
            self.write_csv(root, "Table 4.csv", ["Investment Option Identifier", "Net Return"], [{"Investment Option Identifier": "IO1", "Net Return": "7.1"}])
            report = audit(root)
            self.assertEqual(report["optionJoinTableCount"], 1)
            self.assertFalse(report["rankingEnabled"])

    def test_fails_closed_without_option_identifier(self):
        with tempfile.TemporaryDirectory() as root:
            self.write_csv(root, "Table 4.csv", ["Product Identifier"], [{"Product Identifier": "P1"}])
            with self.assertRaisesRegex(ValueError, "Investment Option Identifier"):
                audit(root)


if __name__ == "__main__":
    unittest.main()
