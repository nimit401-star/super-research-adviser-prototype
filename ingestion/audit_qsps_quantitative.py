#!/usr/bin/env python3
"""Inventory APRA QSPS quantitative tables before enabling Choice rankings."""

import argparse
import csv
import json
from pathlib import Path

IDENTIFIERS = (
    "Product Identifier",
    "Investment Menu Identifier",
    "Investment Option Identifier",
    "Fees and Costs Arrangement Identifier",
)


def audit(directory):
    reports = []
    for path in sorted(Path(directory).glob("*.csv")):
        with path.open(encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            headers = reader.fieldnames or []
            rows = list(reader)
        ids = [name for name in IDENTIFIERS if name in headers]
        reports.append({
            "file": path.name,
            "rowCount": len(rows),
            "headers": headers,
            "identifiers": ids,
            "usableForJoin": "Investment Option Identifier" in ids,
        })
    if not reports:
        raise ValueError("No QSPS CSV files found")
    option_tables = [r for r in reports if r["usableForJoin"]]
    if not option_tables:
        raise ValueError("No table exposes Investment Option Identifier")
    return {
        "datasetId": "apra-qsps-quantitative-contract-audit",
        "tableCount": len(reports),
        "optionJoinTableCount": len(option_tables),
        "rankingEnabled": False,
        "reason": "Choice ranking remains disabled until option, performance, fee and SAA joins pass reviewed contracts.",
        "tables": reports,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", required=True)
    parser.add_argument("--output", default="public/data/qsps-quantitative-audit.json")
    args = parser.parse_args()
    report = audit(args.input_dir)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: report[k] for k in ("tableCount", "optionJoinTableCount", "rankingEnabled")}, indent=2))


if __name__ == "__main__":
    main()
