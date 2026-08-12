# Superannuation Research — Adviser Prototype

Browser-only V0.1 prototype using APRA public MySuper and Quarterly Superannuation Product Statistics data. It supports adviser research; it does not recommend a fund or replace professional judgement.

## Current scope

- Adviser-only, visual-first research workflow
- APRA 2025 MySuper CPPP plus a validated diversified Choice accumulation cohort
- Deterministic and explainable Research Match Score
- Static application architecture with no client data storage
- GitHub Actions ingestion and validation; no local tools or paid APIs required
- Separate MySuper and Choice methodologies, balance-adjusted fees and current-vs-shortlist comparison\n- Controlled official disclosure-document links with visible unverified states\n- Printable adviser research summary\n- Cloudflare Pages deployment target

## Browser-only workflow

1. Open the repository on GitHub.
2. Select **Actions → Refresh APRA MySuper data → Run workflow**.
3. The workflow downloads the current configured APRA CSV, validates it, and produces a pull-request branch.
4. Review `public/data/validation.json` and the workflow summary.
5. Merge the pull request only when all quality gates pass.

The first ingestion is pinned to the published 2025 file. Updating the configured source is a reviewed change, not an automatic jump to an unknown APRA edition.

## Generated outputs

- `public/data/products.json` — normalised product and lifecycle-stage records
- `public/data/metadata.json` — source, dates, checksum and schema version
- `public/data/validation.json` — counts, null rates, duplicates, warnings and rejected rows

## Safety boundary

Use synthetic research inputs only. The repository and app do not store client names, dates of birth, contact details, TFNs or advice records. APRA data does not cover every factor relevant to product suitability, including insurance and service quality.

## Repository map

```text
.github/workflows/refresh-apra-data.yml
config/source.json
ingestion/transform.py
ingestion/mappings/cppp_mysuper.json
public/data/*.json
tests/test_transform.py
docs/Task_001_Data_Feasibility_and_Prototype_Architecture.md
docs/Task_002_Repository_Skeleton_and_First_APRA_Ingestion.md
```



## Demo-ready boundary

Quantitative comparison is limited to accumulation-stage MySuper records and validated diversified Choice options. Choice comparisons stay within the same audited growth peer group. Defined-benefit, retirement-income, single-sector and incomplete records may be searchable but are not ranked.

APRA is the quantitative source. Official provider PDS, investment guides and TMDs are a verification layer and are never mixed into the score. Advisers must verify the exact product → menu → option pathway, eligibility, insurance, tax and switching consequences before finalising advice.

## Prototype coverage

- MySuper: deterministic 100-point Research Match Score
- Choice: 50% balance-adjusted fee efficiency + 50% net return within one growth peer group
- 325 validated Choice product/menu/option pathways, presented as 224 distinct underlying options
- 3-year and 5-year Choice return periods
- No retirement-income, defined-benefit, insurance or personalised-advice ranking
