import csv
import tempfile
import unittest
from pathlib import Path

from ingestion.audit_choice_cohort import annual_fee_at_balance, audit_choice_cohort

FEE_HEADERS = [
    "Investment Fees and Costs$", "Investment Fees and Costs%", "Investment Costs - Indirect Costs/ ICR$", "Investment Costs - Indirect Costs/ ICR%",
    "Other Investment Fees  and Costs$", "Other Investment Fees  and Costs%", "Transaction Fees and Costs$", "Transaction Fees and Costs%",
    "Transaction Costs - Indirect Costs/ ICR$", "Transaction Costs - Indirect Costs/ ICR%", "Other Transaction Fees  and Costs$", "Other Transaction Fees  and Costs%",
    "Administration Fees and Costs$", "Administration Fees and Costs%", "Administration Costs - Indirect Costs/ ICR$", "Administration Costs - Indirect Costs/ ICR%",
    "Other Administration Fees  and Costs$", "Other Administration Fees  and Costs%", "Advice fees$", "Advice fees%",
    "Advice fees - Indirect Costs/ ICR\n$", "Advice fees - Indirect Costs/ ICR\n%", "Other Advice Fees and Costs$", "Other Advice Fees and Costs%",
]
PERFORMANCE_HEADERS = ["Product Identifier", "Investment Menu Identifier", "Investment Option Identifier", "Period", "Superannuation Product Name", "Superannuation Product Type", "Product Phase", "Investment Menu Name", "Investment Option / Lifecycle Stage Name", "Investment Option Type", "Investment Option Category", "RSE name", "Three-year net return \n(rep member) - Annualised", "Five-year net return \n(rep member) - Annualised", "Total Fees and Costs\n(rep member)", *FEE_HEADERS]
SAA_HEADERS = ["Investment Option Identifier", "Period", "Growth asset weighting", "Growth asset band"]

class ChoiceCohortAuditTests(unittest.TestCase):
    def write_csv(self, root, name, headers, rows):
        with (Path(root)/name).open("w",newline="",encoding="utf-8") as handle:
            writer=csv.DictWriter(handle,fieldnames=headers); writer.writeheader(); writer.writerows(rows)
    def performance_row(self, **overrides):
        row={"Product Identifier":"P1","Investment Menu Identifier":"M1","Investment Option Identifier":"O1","Period":"2026-03-31","Superannuation Product Name":"Choice Product","Superannuation Product Type":"Choice","Product Phase":"Accumulation","Investment Menu Name":"Core","Investment Option / Lifecycle Stage Name":"Balanced","Investment Option Type":"Trustee directed","Investment Option Category":"Multi-sector","RSE name":"Example Fund","Three-year net return \n(rep member) - Annualised":"0.071","Five-year net return \n(rep member) - Annualised":"0.068","Total Fees and Costs\n(rep member)":"0.0056"}
        row.update({h:"0" for h in FEE_HEADERS}); row["Administration Fees and Costs$"]="30"; row["Administration Fees and Costs%"]="0.005"; row.update(overrides); return row
    def saa(self, growth="0.70"): return {"Investment Option Identifier":"O1","Period":"2026-03-31","Growth asset weighting":growth,"Growth asset band":"60% - 75%"}
    def run_audit(self, rows, saa_rows=None):
        with tempfile.TemporaryDirectory() as root:
            self.write_csv(root,"QSPS Table 5a.csv",PERFORMANCE_HEADERS,rows); self.write_csv(root,"QSPS Table 8b.csv",SAA_HEADERS,saa_rows or [self.saa()]); return audit_choice_cohort(root)
    def test_aligns_fixed_and_percentage_fees_to_selected_balance(self):
        report=self.run_audit([self.performance_row()]); record=report["records"][0]
        self.assertEqual(record["feeBasis"],{"fixedAnnualDollars":30.0,"variableRateDecimal":0.005})
        self.assertEqual(annual_fee_at_balance(record["feeBasis"],100000),530)
        self.assertEqual(record["annualFeeExamples"]["25000"],155)
        self.assertEqual(report["representativeFeeMismatchCount"],0)
    def test_fails_closed_when_components_do_not_match_apra_representative_fee(self):
        report=self.run_audit([self.performance_row(**{"Total Fees and Costs\n(rep member)":"0.006"})])
        self.assertEqual(report["eligibleRecordCount"],0); self.assertEqual(report["exclusionCounts"]["representativeFeeMismatch"],1)
    def test_requires_both_returns_and_valid_growth(self):
        report=self.run_audit([self.performance_row(**{"Five-year net return \n(rep member) - Annualised":""})])
        self.assertEqual(report["exclusionCounts"]["missing:return5y"],1)
        report=self.run_audit([self.performance_row()], [self.saa("0")])
        self.assertEqual(report["exclusionCounts"]["invalidOrZeroGrowthAllocation"],1)
    def test_tracks_source_reported_zero_fee_without_overriding_it(self):
        overrides={h:"0" for h in FEE_HEADERS}; overrides["Total Fees and Costs\n(rep member)"]="0"
        report=self.run_audit([self.performance_row(**overrides)])
        self.assertEqual(report["sourceReportedZeroFeeCount"],1); self.assertTrue(report["records"][0]["sourceReportedZeroFee"])
    def test_fails_closed_when_asset_allocation_join_is_ambiguous(self):
        report=self.run_audit([self.performance_row()], [self.saa(),self.saa()])
        self.assertEqual(report["exclusionCounts"]["missingOrAmbiguousAssetAllocation"],1)

if __name__ == "__main__": unittest.main()
