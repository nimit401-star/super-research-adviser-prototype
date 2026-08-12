import csv
import tempfile
import unittest
from pathlib import Path

from ingestion.audit_choice_cohort import audit_choice_cohort


PERFORMANCE_HEADERS = [
    "Product Identifier", "Investment Menu Identifier", "Investment Option Identifier",
    "Period", "Superannuation Product Name", "Superannuation Product Type", "Product Phase",
    "Investment Menu Name", "Investment Option / Lifecycle Stage Name", "Investment Option Type",
    "Investment Option Category", "RSE name",
    "Three-year net return \n(rep member) - Annualised",
    "Five-year net return \n(rep member) - Annualised",
    "Total Fees and Costs\n(rep member)",
]
SAA_HEADERS = [
    "Investment Option Identifier", "Period", "Growth asset weighting", "Growth asset band",
]


class ChoiceCohortAuditTests(unittest.TestCase):
    def write_csv(self, root, name, headers, rows):
        with (Path(root) / name).open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=headers)
            writer.writeheader()
            writer.writerows(rows)

    def performance_row(self, **overrides):
        row = {
            "Product Identifier": "P1", "Investment Menu Identifier": "M1",
            "Investment Option Identifier": "O1", "Period": "2026-03-31",
            "Superannuation Product Name": "Choice Product", "Superannuation Product Type": "Choice",
            "Product Phase": "Accumulation", "Investment Menu Name": "Core",
            "Investment Option / Lifecycle Stage Name": "Balanced", "Investment Option Type": "Trustee directed",
            "Investment Option Category": "Multi-sector", "RSE name": "Example Fund",
            "Three-year net return \n(rep member) - Annualised": "7.1",
            "Five-year net return \n(rep member) - Annualised": "6.8",
            "Total Fees and Costs\n(rep member)": "560",
        }
        row.update(overrides)
        return row

    def test_includes_only_complete_diversified_choice_accumulation_rows(self):
        with tempfile.TemporaryDirectory() as root:
            self.write_csv(root, "QSPS Table 5a.csv", PERFORMANCE_HEADERS, [
                self.performance_row(),
                self.performance_row(**{"Investment Option Identifier": "O2", "Investment Option Category": "Cash"}),
            ])
            self.write_csv(root, "QSPS Table 8b.csv", SAA_HEADERS, [{
                "Investment Option Identifier": "O1", "Period": "2026-03-31",
                "Growth asset weighting": "70", "Growth asset band": "60-80",
            }])
            report = audit_choice_cohort(root)
            self.assertEqual(report["eligibleRecordCount"], 1)
            self.assertEqual(report["records"][0]["optionId"], "O1")
            self.assertFalse(report["rankingEnabled"])
            self.assertEqual(report["exclusionCounts"]["notDiversifiedMultiSector"], 1)

    def test_fails_closed_when_asset_allocation_join_is_ambiguous(self):
        with tempfile.TemporaryDirectory() as root:
            self.write_csv(root, "QSPS Table 5a.csv", PERFORMANCE_HEADERS, [self.performance_row()])
            duplicate = {"Investment Option Identifier": "O1", "Period": "2026-03-31", "Growth asset weighting": "70", "Growth asset band": "60-80"}
            self.write_csv(root, "QSPS Table 8b.csv", SAA_HEADERS, [duplicate])
            self.write_csv(root, "QSPS Table 8c.csv", SAA_HEADERS, [duplicate])
            report = audit_choice_cohort(root)
            self.assertEqual(report["eligibleRecordCount"], 0)
            self.assertEqual(report["exclusionCounts"]["missingOrAmbiguousAssetAllocation"], 1)


if __name__ == "__main__":
    unittest.main()
