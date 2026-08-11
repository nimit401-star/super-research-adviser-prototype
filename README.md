# Superannuation Research — Adviser Prototype

Browser-only V0.1 prototype using APRA public MySuper data. It supports adviser research; it does not recommend a fund or replace professional judgement.

## Current scope

- Adviser-only, visual-first research workflow
- APRA 2025 MySuper CPPP as the initial source
- Deterministic and explainable Research Match Score
- Static application architecture with no client data storage
- GitHub Actions ingestion and validation; no local tools or paid APIs required
- Cloudflare Pages deployment target

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

