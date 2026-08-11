#!/usr/bin/env python3
"""Validate and normalise APRA's MySuper CPPP CSV using only Python stdlib."""

import argparse
import csv
import hashlib
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


REQUIRED_HEADERS = {
    "rse_licensee", "rse_name", "mysuper_product_name",
    "single_strategy_lifecycle_indicator", "lifecycle_stage_name",
    "strategic_growth_asset_allocation", "performance_test_measure",
    "pass_fail_indicator", "lookback_period_years",
    "3_year_net_investment_return_nir_p_a",
    "5_year_net_investment_return_nir_p_a",
    "7_year_net_investment_return_nir_p_a",
    "10_year_net_investment_return_nir_p_a",
    "total_fees_and_costs_charged_10_000_account_balance",
    "total_fees_and_costs_charged_25_000_account_balance",
    "total_fees_and_costs_charged_50_000_account_balance",
    "total_fees_and_costs_charged_100_000_account_balance",
    "total_fees_and_costs_charged_250_000_account_balance"
}

MISSING_MARKERS = {"", "-", "n/a", "na", "not available", "not assessed", "*"}


def clean_text(value):
    value = (value or "").strip()
    return None if value.lower() in MISSING_MARKERS else value


def number(value, *, percentage=False, integer=False):
    value = clean_text(value)
    if value is None:
        return None
    parsed = float(value.replace(",", ""))
    if percentage:
        parsed *= 100
    return int(parsed) if integer else round(parsed, 6)


def slug(value):
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def make_product_id(row):
    parts = [row["rse_name"], row["mysuper_product_name"], row.get("lifecycle_stage_name") or "single-strategy"]
    readable = slug("-".join(parts))[:80]
    digest = hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()[:10]
    return f"{readable}-{digest}"


def percent_pair(row, columns, labels):
    return {label: number(row.get(column), percentage=True) for label, column in zip(labels, columns)}


def normalise(row, mapping):
    identity = {target: clean_text(row.get(source)) for target, source in mapping["identity"].items()}
    numeric = {
        "memberAssets": number(row.get(mapping["numeric"]["memberAssets"])),
        "memberAccounts": number(row.get(mapping["numeric"]["memberAccounts"]), integer=True),
        "growthAllocationPct": number(row.get(mapping["numeric"]["growthAllocationPct"]), percentage=True),
        "performanceTestMeasurePct": number(row.get(mapping["numeric"]["performanceTestMeasurePct"]), percentage=True),
        "lookbackYears": number(row.get(mapping["numeric"]["lookbackYears"]), integer=True)
    }
    returns = {
        period: percent_pair(row, columns, ["netInvestmentReturnPct", "netReturn50kPct"])
        for period, columns in mapping["returns"].items()
    }
    fees = {
        band: percent_pair(row, columns, ["administrationPct", "totalPct"])
        for band, columns in mapping["fees"].items()
    }
    critical = {
        "growthAllocationPct": numeric["growthAllocationPct"],
        "totalFee50kPct": fees["50k"]["totalPct"],
        "return3yPct": returns["3y"]["netInvestmentReturnPct"]
    }
    missing = [key for key, value in critical.items() if value is None]
    gross_of_tax = any("†" in (value or "") for value in row.values())
    return {
        "productId": make_product_id(row),
        **identity,
        **numeric,
        "performanceTestResult": clean_text(row.get(mapping["performanceTestResult"])),
        "returns": returns,
        "fees": fees,
        "flags": {
            "grossOfTax": gross_of_tax,
            "insufficientHistory": numeric["lookbackYears"] is None or numeric["lookbackYears"] < 3,
            "missingFields": missing
        }
    }


def build(input_path, output_dir, config_path, mapping_path, ingested_at=None):
    config = json.loads(Path(config_path).read_text(encoding="utf-8"))
    mapping = json.loads(Path(mapping_path).read_text(encoding="utf-8"))
    source_bytes = Path(input_path).read_bytes()
    checksum = hashlib.sha256(source_bytes).hexdigest()
    with Path(input_path).open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        headers = reader.fieldnames or []
        missing_headers = sorted(REQUIRED_HEADERS - set(headers))
        unexpected_headers = sorted(set(headers) - REQUIRED_HEADERS)
        if missing_headers:
            raise ValueError(f"APRA header contract failed; missing: {missing_headers}")
        rows = list(reader)

    products, rejected, excluded = [], [], []
    for index, row in enumerate(rows, start=2):
        try:
            if not all(clean_text(row.get(key)) for key in ("rse_name", "mysuper_product_name")):
                raise ValueError("missing required product identity")
            if (clean_text(row.get("single_strategy_lifecycle_indicator")) == "Lifecycle"
                    and clean_text(row.get("lifecycle_stage_name")) is None):
                excluded.append({"row": index, "reason": "aggregate lifecycle product row; stage rows retained"})
                continue
            product = normalise(row, mapping)
            growth = product["growthAllocationPct"]
            if growth is not None and not 0 <= growth <= 100:
                raise ValueError("growth allocation outside 0–100%")
            products.append(product)
        except (ValueError, TypeError) as error:
            rejected.append({"row": index, "reason": str(error)})

    id_counts = Counter(product["productId"] for product in products)
    duplicate_ids = sorted(key for key, count in id_counts.items() if count > 1)
    critical_fields = {
        "growthAllocationPct": lambda p: p["growthAllocationPct"],
        "totalFee50kPct": lambda p: p["fees"]["50k"]["totalPct"],
        "return3yPct": lambda p: p["returns"]["3y"]["netInvestmentReturnPct"]
    }
    null_rates = {
        field: round(sum(getter(p) is None for p in products) / len(products), 4) if products else 1
        for field, getter in critical_fields.items()
    }
    scorable_count = sum(not p["flags"]["missingFields"] for p in products)
    gate_failures = []
    if len(products) < config["minimum_record_count"]:
        gate_failures.append("record count below configured minimum")
    if duplicate_ids:
        gate_failures.append("duplicate product identifiers found")
    if scorable_count < config["minimum_record_count"]:
        gate_failures.append("scorable record count below configured minimum")
    for field, rate in null_rates.items():
        if rate > config["critical_null_rate_limits"][field]:
            gate_failures.append(f"{field} null rate exceeds configured limit")

    timestamp = ingested_at or datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    metadata = {
        "datasetId": config["dataset_id"], "sourceName": config["source_name"],
        "sourceUrl": config["source_page_url"], "downloadUrl": config["download_url"],
        "reportingDate": config["reporting_date"], "publishedDate": config["published_date"],
        "ingestedAt": timestamp, "schemaVersion": config["schema_version"],
        "recordCount": len(products), "checksumSha256": checksum
    }
    validation = {
        "status": "pass" if not gate_failures else "fail",
        "sourceRowCount": len(rows), "acceptedRecordCount": len(products),
        "scorableRecordCount": scorable_count, "rejectedRecordCount": len(rejected),
        "excludedAggregateRowCount": len(excluded),
        "headerCount": len(headers), "missingRequiredHeaders": missing_headers,
        "additionalSourceHeaders": unexpected_headers,
        "duplicateProductIds": duplicate_ids, "criticalNullRates": null_rates,
        "gateFailures": gate_failures, "rejectedRows": rejected, "excludedRows": excluded
    }
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    for name, payload in (("products.json", products), ("metadata.json", metadata), ("validation.json", validation)):
        (output / name).write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    if gate_failures:
        raise ValueError("; ".join(gate_failures))
    return metadata, validation


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", default="public/data")
    parser.add_argument("--config", default="config/source.json")
    parser.add_argument("--mapping", default="ingestion/mappings/cppp_mysuper.json")
    parser.add_argument("--ingested-at")
    args = parser.parse_args()
    metadata, validation = build(args.input, args.output, args.config, args.mapping, args.ingested_at)
    print(json.dumps({"metadata": metadata, "validation": validation}, indent=2))


if __name__ == "__main__":
    main()
