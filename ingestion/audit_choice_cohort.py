#!/usr/bin/env python3
"""Audit record-level eligibility and balance-aligned fees for Choice peers."""

import argparse
import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

IDENTITY_FIELDS = ("Product Identifier", "Investment Menu Identifier", "Investment Option Identifier")
PEER_GROUPS = ((0.0, 0.2, "defensive"), (0.2, 0.4, "conservative"),
               (0.4, 0.6, "balanced"), (0.6, 0.75, "growth"),
               (0.75, 0.9, "high-growth"), (0.9, 1.0, "very-high-growth"))
FEE_COMPONENTS = (
    ("Investment Fees and Costs$", "Investment Fees and Costs%"),
    ("Investment Costs - Indirect Costs/ ICR$", "Investment Costs - Indirect Costs/ ICR%"),
    ("Other Investment Fees  and Costs$", "Other Investment Fees  and Costs%"),
    ("Transaction Fees and Costs$", "Transaction Fees and Costs%"),
    ("Transaction Costs - Indirect Costs/ ICR$", "Transaction Costs - Indirect Costs/ ICR%"),
    ("Other Transaction Fees  and Costs$", "Other Transaction Fees  and Costs%"),
    ("Administration Fees and Costs$", "Administration Fees and Costs%"),
    ("Administration Costs - Indirect Costs/ ICR$", "Administration Costs - Indirect Costs/ ICR%"),
    ("Other Administration Fees  and Costs$", "Other Administration Fees  and Costs%"),
    ("Advice fees$", "Advice fees%"),
    ("Advice fees - Indirect Costs/ ICR\n$", "Advice fees - Indirect Costs/ ICR\n%"),
    ("Other Advice Fees and Costs$", "Other Advice Fees and Costs%"),
)
STANDARD_BALANCES = (10000, 25000, 50000, 100000, 250000)
REPRESENTATIVE_BALANCE = 50000
FEE_TOLERANCE = 1e-8

def normalise_header(value): return re.sub(r"\s+", " ", (value or "").strip()).casefold()
def clean(value):
    value = (value or "").strip()
    return value or None
def read_rows(path):
    with Path(path).open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return {normalise_header(h): h for h in (reader.fieldnames or [])}, list(reader)
def field(row, aliases, name):
    source = aliases.get(normalise_header(name))
    return clean(row.get(source)) if source else None
def decimal(value):
    try: return float(value) if value is not None else None
    except (TypeError, ValueError): return None
def latest_period(rows, aliases):
    periods = [field(row, aliases, "Period") for row in rows]
    periods = [p for p in periods if p]
    if not periods: raise ValueError("quantitative table contains no reporting period")
    return max(periods)
def is_choice_accumulation(row, aliases):
    return "choice" in (field(row, aliases, "Superannuation Product Type") or "").casefold() and "accumulation" in (field(row, aliases, "Product Phase") or "").casefold()
def is_diversified(row, aliases):
    category = (field(row, aliases, "Investment Option Category") or "").casefold()
    return "multi-sector" in category or "multi sector" in category
def peer_group(growth_weight):
    if growth_weight is None or growth_weight <= 0 or growth_weight > 1: return None
    return next((name for lower, upper, name in PEER_GROUPS if lower < growth_weight <= upper), None)
def unique_saa_rows(directory, reporting_date):
    joined = defaultdict(list)
    for path in sorted(Path(directory).glob("QSPS Table 8*.csv")):
        aliases, rows = read_rows(path)
        if normalise_header("Investment Option Identifier") not in aliases: continue
        for row in rows:
            option_id, period = field(row, aliases, "Investment Option Identifier"), field(row, aliases, "Period")
            if option_id and period == reporting_date: joined[(option_id, period)].append((row, aliases, path.name))
    return joined
def fee_basis(row, aliases):
    fixed, variable = 0.0, 0.0
    for dollar_name, rate_name in FEE_COMPONENTS:
        dollar, rate = decimal(field(row, aliases, dollar_name)), decimal(field(row, aliases, rate_name))
        if dollar is None or rate is None: return None
        fixed += dollar
        variable += rate
    return {"fixedAnnualDollars": fixed, "variableRateDecimal": variable}
def annual_fee_at_balance(basis, balance):
    return basis["fixedAnnualDollars"] + balance * basis["variableRateDecimal"]

def audit_choice_cohort(directory):
    performance_path = Path(directory) / "QSPS Table 5a.csv"
    if not performance_path.exists(): raise ValueError("QSPS Table 5a.csv is required for Choice accumulation performance")
    aliases, rows = read_rows(performance_path)
    required = (*IDENTITY_FIELDS, "Total Fees and Costs (rep member)")
    missing = [name for name in required if normalise_header(name) not in aliases]
    missing += [name for pair in FEE_COMPONENTS for name in pair if normalise_header(name) not in aliases]
    if missing: raise ValueError(f"Choice performance fee contract failed; missing: {missing}")
    reporting_date, exclusions, candidates = latest_period(rows, aliases), Counter(), []
    saa = unique_saa_rows(directory, reporting_date)
    current_rows = [row for row in rows if field(row, aliases, "Period") == reporting_date]
    for row in current_rows:
        if not is_choice_accumulation(row, aliases): exclusions["notChoiceAccumulation"] += 1; continue
        if not is_diversified(row, aliases): exclusions["notDiversifiedMultiSector"] += 1; continue
        identity = {name: field(row, aliases, name) for name in IDENTITY_FIELDS}
        if not all(identity.values()): exclusions["incompleteIdentity"] += 1; continue
        saa_matches = saa.get((identity["Investment Option Identifier"], reporting_date), [])
        if len(saa_matches) != 1: exclusions["missingOrAmbiguousAssetAllocation"] += 1; continue
        saa_row, saa_aliases, _ = saa_matches[0]
        return_3y = decimal(field(row, aliases, "Three-year net return (rep member) - Annualised"))
        return_5y = decimal(field(row, aliases, "Five-year net return (rep member) - Annualised"))
        total_fee = decimal(field(row, aliases, "Total Fees and Costs (rep member)"))
        growth_weight = decimal(field(saa_row, saa_aliases, "Growth asset weighting"))
        basis = fee_basis(row, aliases)
        missing_metrics = []
        for name, value in (("return3y", return_3y), ("return5y", return_5y), ("representativeMemberFee", total_fee), ("growthAllocation", growth_weight), ("feeComponents", basis)):
            if value is None: missing_metrics.append(name)
        if missing_metrics: exclusions["missing:" + ",".join(missing_metrics)] += 1; continue
        if not (-1 <= return_3y <= 1 and -1 <= return_5y <= 1): exclusions["invalidReturnDecimal"] += 1; continue
        if basis["fixedAnnualDollars"] < 0 or not (0 <= basis["variableRateDecimal"] <= 0.1): exclusions["invalidFeeComponents"] += 1; continue
        calculated_rep_rate = annual_fee_at_balance(basis, REPRESENTATIVE_BALANCE) / REPRESENTATIVE_BALANCE
        if abs(calculated_rep_rate - total_fee) > FEE_TOLERANCE: exclusions["representativeFeeMismatch"] += 1; continue
        group = peer_group(growth_weight)
        if group is None: exclusions["invalidOrZeroGrowthAllocation"] += 1; continue
        fee_examples = {str(balance): round(annual_fee_at_balance(basis, balance), 2) for balance in STANDARD_BALANCES}
        candidates.append({
            "productId": identity["Product Identifier"], "menuId": identity["Investment Menu Identifier"], "optionId": identity["Investment Option Identifier"],
            "rseName": field(row, aliases, "RSE name"), "productName": field(row, aliases, "Superannuation Product Name"), "menuName": field(row, aliases, "Investment Menu Name"),
            "optionName": field(row, aliases, "Investment Option / Lifecycle Stage Name"), "optionType": field(row, aliases, "Investment Option Type"), "optionCategory": field(row, aliases, "Investment Option Category"),
            "return3yDecimal": return_3y, "return5yDecimal": return_5y, "growthAllocationDecimal": growth_weight,
            "growthBand": field(saa_row, saa_aliases, "Growth asset band"), "peerGroup": group,
            "feeBasis": basis, "annualFeeExamples": fee_examples, "sourceReportedZeroFee": fee_examples["50000"] == 0,
        })
    pathways = Counter((x["productId"], x["menuId"], x["optionId"]) for x in candidates)
    duplicates = [key for key, count in pathways.items() if count > 1]
    if duplicates: raise ValueError(f"duplicate eligible Choice pathways: {duplicates[:5]}")
    option_counts = Counter(x["optionId"] for x in candidates)
    peer_counts = Counter(x["peerGroup"] for x in candidates)
    candidates.sort(key=lambda x: ((x["rseName"] or "").casefold(), (x["productName"] or "").casefold(), (x["optionName"] or "").casefold(), x["optionId"]))
    return {"datasetId":"apra-choice-diversified-peer-group-audit", "reportingDate":reporting_date,
            "sourceTable":"QSPS Table 5a.csv", "currentPerformanceRowCount":len(current_rows), "eligibleRecordCount":len(candidates),
            "peerGroupCounts":dict(sorted(peer_counts.items())), "sharedOptionIdCount":sum(1 for c in option_counts.values() if c > 1),
            "sourceReportedZeroFeeCount":sum(1 for x in candidates if x["sourceReportedZeroFee"]), "representativeFeeMismatchCount":exclusions.get("representativeFeeMismatch", 0),
            "exclusionCounts":dict(sorted(exclusions.items())), "feeMethod":{"representativeBalance":REPRESENTATIVE_BALANCE,"formula":"fixedAnnualDollars + balance * variableRateDecimal","standardBalances":list(STANDARD_BALANCES)},
            "units":{"returns":"decimal annualised net return; multiply by 100 for display percent","feeVariableRate":"decimal annual rate","feeFixed":"annual Australian dollars","growthAllocation":"decimal allocation; multiply by 100 for display percent"},
            "rankingEnabled":False, "reason":"Balance-aligned Choice fees are validated; ranking remains disabled until the generated cohort and adviser-facing peer-group integration are reviewed.", "records":candidates}

def main():
    parser=argparse.ArgumentParser(); parser.add_argument("--input-dir",required=True); parser.add_argument("--output",default="public/data/choice-cohort-audit.json"); args=parser.parse_args()
    report=audit_choice_cohort(args.input_dir); output=Path(args.output); output.parent.mkdir(parents=True,exist_ok=True); output.write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print(json.dumps({k:report[k] for k in ("reportingDate","currentPerformanceRowCount","eligibleRecordCount","peerGroupCounts","sharedOptionIdCount","sourceReportedZeroFeeCount","representativeFeeMismatchCount","rankingEnabled")},indent=2))
if __name__ == "__main__": main()
