import json
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path

from ingestion.publish_choice_dataset import publish_choice_dataset

class PublishChoiceDatasetTests(unittest.TestCase):
    def report(self):
        groups = ["defensive", "conservative", "balanced", "growth", "high-growth", "very-high-growth"]
        records = []
        for index, group in enumerate(groups):
            records.append({
                "productId": f"p{index}", "menuId": f"m{index}", "optionId": f"o{index}",
                "rseName": "Fund", "productName": "Product", "menuName": "Menu",
                "optionName": group, "peerGroup": group, "growthAllocationDecimal": 0.1 + index * 0.16,
                "return3yDecimal": 0.06, "return5yDecimal": 0.07,
                "feeBasis": {"fixedAnnualDollars": 100, "variableRateDecimal": 0.005},
                "sourceReportedZeroFee": False
            })
        return {
            "reportingDate": "2026-03-31", "sourceTable": "QSPS Table 5a.csv",
            "eligibleRecordCount": len(records), "records": records,
            "representativeFeeMismatchCount": 0,
            "peerGroupCounts": {group: 1 for group in groups}
        }

    def test_publishes_reviewed_contract(self):
        dataset = publish_choice_dataset(self.report())
        self.assertTrue(dataset["rankingEnabled"])
        self.assertEqual(dataset["recordCount"], 6)
        self.assertEqual(dataset["records"][0]["growthAllocationPct"], 10)
        self.assertEqual(dataset["records"][0]["returns"]["5y"]["netReturnPct"], 7)

    def test_fails_closed_on_fee_mismatch(self):
        report = self.report()
        report["representativeFeeMismatchCount"] = 1
        with self.assertRaises(ValueError):
            publish_choice_dataset(report)

    def test_fails_closed_on_duplicate_pathway(self):
        report = self.report()
        report["records"][1]["productId"] = report["records"][0]["productId"]
        report["records"][1]["menuId"] = report["records"][0]["menuId"]
        report["records"][1]["optionId"] = report["records"][0]["optionId"]
        with self.assertRaises(ValueError):
            publish_choice_dataset(report)

if __name__ == "__main__":
    unittest.main()
