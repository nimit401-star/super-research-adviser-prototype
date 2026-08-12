#!/usr/bin/env python3
"""Publish the reviewed Choice cohort as a compact adviser-ranking dataset."""

import argparse
import json
from pathlib import Path

REQUIRED_PEER_GROUPS = {
    "defensive", "conservative", "balanced", "growth", "high-growth", "very-high-growth"
}

def publish_choice_dataset(report):
    if report.get("eligibleRecordCount") != len(report.get("records", [])):
        raise ValueError("eligible record count does not match records")
    if report.get("representativeFeeMismatchCount") != 0:
        raise ValueError("representative-member fee mismatches must be zero")
    groups = set(report.get("peerGroupCounts", {}))
    if groups != REQUIRED_PEER_GROUPS:
        raise ValueError("reviewed peer-group contract has changed")

    records = []
    pathways = set()
    for source in report["records"]:
        pathway = (source["productId"], source["menuId"], source["optionId"])
        if pathway in pathways:
            raise ValueError(f"duplicate Choice pathway: {pathway}")
        pathways.add(pathway)
        basis = source["feeBasis"]
        records.append({
            "productId": source["productId"],
            "menuId": source["menuId"],
            "optionId": source["optionId"],
            "rseName": source["rseName"],
            "productName": source["productName"],
            "menuName": source["menuName"],
            "optionName": source["optionName"],
            "peerGroup": source["peerGroup"],
            "growthAllocationPct": round(source["growthAllocationDecimal"] * 100, 4),
            "returns": {
                "3y": {"netReturnPct": round(source["return3yDecimal"] * 100, 4)},
                "5y": {"netReturnPct": round(source["return5yDecimal"] * 100, 4)}
            },
            "feeBasis": {
                "fixedAnnualDollars": round(basis["fixedAnnualDollars"], 6),
                "variableRateDecimal": round(basis["variableRateDecimal"], 10)
            },
            "sourceReportedZeroFee": bool(source.get("sourceReportedZeroFee"))
        })

    return {
        "datasetId": "apra-choice-diversified-ranking-v1",
        "reportingDate": report["reportingDate"],
        "sourceTable": report["sourceTable"],
        "rankingEnabled": True,
        "methodology": {
            "comparisonBoundary": "same Choice growth peer group only",
            "feeFormula": "fixedAnnualDollars + balance * variableRateDecimal",
            "returnPeriods": ["3y", "5y"],
            "pathwayIdentity": ["productId", "menuId", "optionId"]
        },
        "peerGroupCounts": report["peerGroupCounts"],
        "recordCount": len(records),
        "records": records
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="public/data/choice-cohort-audit.json")
    parser.add_argument("--output", default="public/data/choice-products.json")
    args = parser.parse_args()
    report = json.loads(Path(args.input).read_text(encoding="utf-8"))
    dataset = publish_choice_dataset(report)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(dataset, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"recordCount": dataset["recordCount"], "rankingEnabled": dataset["rankingEnabled"]}))

if __name__ == "__main__":
    main()
