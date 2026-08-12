#!/usr/bin/env python3
"""Audit record-level eligibility for a diversified Choice option cohort."""

import argparse
import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path


IDENTITY_FIELDS = (
    "Product Identifier",
    "Investment Menu Identifier",
    "Investment Option Identifier",
)


def normalise_header(value):
    return re.sub(r"\s+", " ", (value or "").strip()).casefold()


def clean(value):
    value = (value or "").strip()
    return value or None


def read_rows(path):
    with Path(path).open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        aliases = {normalise_header(header): header for header in (reader.fieldnames or [])}
        return aliases, list(reader)


def field(row, aliases, name):
    source = aliases.get(normalise_header(name))
    return clean(row.get(source)) if source else None


def latest_period(rows, aliases):
    periods = [field(row, aliases, "Period") for row in rows]
    periods = [period for period in periods if period]
    if not periods:
        raise ValueError("quantitative table contains no reporting period")
    return max(periods)


def is_choice_accumulation(row, aliases):
    product_type = (field(row, aliases, "Superannuation Product Type") or "").casefold()
    phase = (field(row, aliases, "Product Phase") or "").casefold()
    return "choice" in product_type and "accumulation" in phase


def is_diversified(row, aliases):
    category = (field(row, aliases, "Investment Option Category") or "").casefold()
    return "multi-sector" in category or "multi sector" in category


def unique_saa_rows(directory, reporting_date):
    joined = defaultdict(list)
    for path in sorted(Path(directory).glob("QSPS Table 8*.csv")):
        aliases, rows = read_rows(path)
        if normalise_header("Investment Option Identifier") not in aliases:
            continue
        for row in rows:
            option_id = field(row, aliases, "Investment Option Identifier")
            period = field(row, aliases, "Period")
            if option_id and period == reporting_date:
                joined[(option_id, period)].append((row, aliases, path.name))
    return joined


def audit_choice_cohort(directory):
    performance_path = Path(directory) / "QSPS Table 5a.csv"
    if not performance_path.exists():
        raise ValueError("QSPS Table 5a.csv is required for Choice accumulation performance")

    aliases, rows = read_rows(performance_path)
    missing = [name for name in IDENTITY_FIELDS if normalise_header(name) not in aliases]
    if missing:
        raise ValueError(f"Choice performance identity contract failed; missing: {missing}")

    reporting_date = latest_period(rows, aliases)
    saa = unique_saa_rows(directory, reporting_date)
    exclusions = Counter()
    candidates = []

    current_rows = [row for row in rows if field(row, aliases, "Period") == reporting_date]
    for row in current_rows:
        if not is_choice_accumulation(row, aliases):
            exclusions["notChoiceAccumulation"] += 1
            continue
        if not is_diversified(row, aliases):
            exclusions["notDiversifiedMultiSector"] += 1
            continue

        identity = {name: field(row, aliases, name) for name in IDENTITY_FIELDS}
        if not all(identity.values()):
            exclusions["incompleteIdentity"] += 1
            continue

        option_key = (identity["Investment Option Identifier"], reporting_date)
        saa_matches = saa.get(option_key, [])
        if len(saa_matches) != 1:
            exclusions["missingOrAmbiguousAssetAllocation"] += 1
            continue

        saa_row, saa_aliases, _ = saa_matches[0]
        return_3y = field(row, aliases, "Three-year net return (rep member) - Annualised")
        return_5y = field(row, aliases, "Five-year net return (rep member) - Annualised")
        total_fee = field(row, aliases, "Total Fees and Costs (rep member)")
        growth_weight = field(saa_row, saa_aliases, "Growth asset weighting")
        growth_band = field(saa_row, saa_aliases, "Growth asset band")

        missing_metrics = []
        if not (return_3y or return_5y):
            missing_metrics.append("multiPeriodReturn")
        if not total_fee:
            missing_metrics.append("representativeMemberFee")
        if not (growth_weight or growth_band):
            missing_metrics.append("growthAllocation")
        if missing_metrics:
            exclusions["missing:" + ",".join(missing_metrics)] += 1
            continue

        candidates.append({
            "productId": identity["Product Identifier"],
            "menuId": identity["Investment Menu Identifier"],
            "optionId": identity["Investment Option Identifier"],
            "rseName": field(row, aliases, "RSE name"),
            "productName": field(row, aliases, "Superannuation Product Name"),
            "menuName": field(row, aliases, "Investment Menu Name"),
            "optionName": field(row, aliases, "Investment Option / Lifecycle Stage Name"),
            "optionType": field(row, aliases, "Investment Option Type"),
            "optionCategory": field(row, aliases, "Investment Option Category"),
            "return3yPct": return_3y,
            "return5yPct": return_5y,
            "representativeMemberFee": total_fee,
            "growthAllocationPct": growth_weight,
            "growthBand": growth_band,
        })

    duplicate_keys = [
        key for key, count in Counter(
            (item["productId"], item["menuId"], item["optionId"]) for item in candidates
        ).items() if count > 1
    ]
    if duplicate_keys:
        raise ValueError(f"duplicate eligible Choice pathways: {duplicate_keys[:5]}")

    candidates.sort(key=lambda item: (
        (item["rseName"] or "").casefold(),
        (item["productName"] or "").casefold(),
        (item["optionName"] or "").casefold(),
        item["optionId"],
    ))
    return {
        "datasetId": "apra-choice-diversified-cohort-audit",
        "reportingDate": reporting_date,
        "sourceTable": "QSPS Table 5a.csv",
        "currentPerformanceRowCount": len(current_rows),
        "eligibleRecordCount": len(candidates),
        "exclusionCounts": dict(sorted(exclusions.items())),
        "rankingEnabled": False,
        "reason": "Choice ranking remains disabled until this record-level cohort is reviewed and its fee basis is aligned with the adviser balance comparison.",
        "records": candidates,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", required=True)
    parser.add_argument("--output", default="public/data/choice-cohort-audit.json")
    args = parser.parse_args()
    report = audit_choice_cohort(args.input_dir)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({key: report[key] for key in (
        "reportingDate", "currentPerformanceRowCount", "eligibleRecordCount", "rankingEnabled"
    )}, indent=2))


if __name__ == "__main__":
    main()
