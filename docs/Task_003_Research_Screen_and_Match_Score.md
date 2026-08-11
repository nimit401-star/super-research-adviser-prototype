# Task 003 — Adviser Research Screen and Research Match Score

**Status:** Implemented

## Outcome

V0.1 now has a responsive, visual-first Research screen that reads the validated APRA JSON directly. Advisers can select a growth range, account balance and historical return period, then inspect ranked research matches and expand the five-part score explanation.

No client identifiers, research inputs or results are sent to a server or stored in the browser.

## Deterministic score (100 points)

| Component | Weight | Rule |
| --- | ---: | --- |
| Growth-range fit | 35 | Full points within the selected range; subtract 1.75 points for each percentage point outside it, floored at zero. |
| Fee efficiency | 25 | Lower selected-balance total fee receives the higher percentile rank within the comparable universe. |
| Net return | 25 | Higher selected-period net return at $50k receives the higher percentile rank within the comparable universe. |
| APRA performance test | 10 | Pass = 10, Fail = 0, not assessed = 5 and visibly flagged. |
| Data completeness | 5 | Proportion present across growth, fee, return, APRA result and APRA measure. |

Comparable products must have growth allocation, the selected balance fee and selected return-period data. Missing values are excluded rather than treated as zero. Ties use the average percentile rank; final score ties sort by product name.

## Acceptance criteria

- [x] Research inputs are concise and contain no client-identifying fields.
- [x] Results use real normalised APRA product records.
- [x] Score is deterministic, capped at 100 and visibly decomposable.
- [x] Results are labelled research matches, not recommendations.
- [x] Lifecycle stages remain distinct comparable records.
- [x] Responsive layout works without a build step or paid dependency.
- [x] Automated score contract tests cover weights, ordering, bounds and missing critical data.

## Next task

Task 004 should add the Compare workspace for up to three selected research matches, including side-by-side fee, growth, returns, APRA status and data caveats.
