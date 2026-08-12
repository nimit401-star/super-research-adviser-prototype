#!/usr/bin/env python3
"""Build a current APRA product directory from QSPS Table 1a."""

import argparse
import csv
import json
from collections import Counter
from pathlib import Path


REQUIRED_HEADERS = {
    "Product Identifier", "Period", "RSE name", "RSE ABN",
    "Superannuation Product Name", "Superannuation Product Type",
    "Superannuation Product Category Type", "Superannuation Product Phase Type",
    "Open To New Members Superannuation Product Indicator",
    "Open To Public Superannuation Product Indicator",
    "Superannuation Product End Date", "Product Disclosure Statement URL",
}


def clean(value):
    value = (value or "").strip()
    return value or None


def build(input_path, output_path, metadata_path):
    with Path(input_path).open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        headers = set(reader.fieldnames or [])
        missing = sorted(REQUIRED_HEADERS - headers)
        if missing:
            raise ValueError(f"QSPS Table 1a header contract failed; missing: {missing}")
        rows = list(reader)

    periods = [clean(row["Period"]) for row in rows if clean(row["Period"])]
    if not periods:
        raise ValueError("QSPS Table 1a contains no reporting periods")
    reporting_date = max(periods)
    current = [row for row in rows if clean(row["Period"]) == reporting_date]

    products = []
    for row in current:
        product_id = clean(row["Product Identifier"])
        fund_name = clean(row["RSE name"])
        product_name = clean(row["Superannuation Product Name"])
        if not all((product_id, fund_name, product_name)):
            continue
        products.append({
            "productId": product_id,
            "rseName": fund_name,
            "rseAbn": clean(row["RSE ABN"]),
            "productName": product_name,
            "productType": clean(row["Superannuation Product Type"]),
            "productCategory": clean(row["Superannuation Product Category Type"]),
            "productPhase": clean(row["Superannuation Product Phase Type"]),
            "openToNewMembers": clean(row["Open To New Members Superannuation Product Indicator"]),
            "openToPublic": clean(row["Open To Public Superannuation Product Indicator"]),
            "productEndDate": clean(row["Superannuation Product End Date"]),
            "pdsUrl": clean(row["Product Disclosure Statement URL"]),
            "reportingDate": reporting_date,
        })

    duplicate_ids = [key for key, count in Counter(p["productId"] for p in products).items() if count > 1]
    if duplicate_ids:
        raise ValueError(f"duplicate current product identifiers: {duplicate_ids[:5]}")
    if len(products) < 700:
        raise ValueError(f"unexpectedly small current product directory: {len(products)}")

    products.sort(key=lambda p: (p["rseName"].casefold(), p["productName"].casefold(), p["productId"]))
    metadata = {
        "datasetId": "apra-qsps-product-directory",
        "sourceName": "APRA Quarterly Superannuation Product Statistics - Table 1a",
        "sourceUrl": "https://www.apra.gov.au/news-and-publications/quarterly-superannuation-product-statistics",
        "reportingDate": reporting_date,
        "recordCount": len(products),
        "countsByProductType": dict(sorted(Counter(p["productType"] or "Not stated" for p in products).items())),
        "schemaVersion": "1.0.0",
    }
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    Path(output_path).write_text(json.dumps(products, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    Path(metadata_path).write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return metadata


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", default="public/data/product-directory.json")
    parser.add_argument("--metadata", default="public/data/product-directory-metadata.json")
    args = parser.parse_args()
    print(json.dumps(build(args.input, args.output, args.metadata), indent=2))


if __name__ == "__main__":
    main()
