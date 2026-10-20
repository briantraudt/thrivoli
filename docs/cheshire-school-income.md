# Reported school income

The protected financial dashboard reads a `school-income-audit-v1` payload from
`cheshire_intake_document.validation.school_income_audit`. This uses the existing
`school_billing` / `existing_source` / `incomplete` envelope and `source-audit-v1`
validator, with null requested month, reported month and storage path.
The existing finance-reader and portal-member RLS policy remains unchanged.

Owner clarification supersedes the earlier request for school-to-clinic mappings.
A narrow presentation adapter corrects legacy school-audit scope/request text
without modifying the original audit or its deterministic import/replay payload.
Verified therapist labor for school work is needed for school profit. Clinics
absorb all non-therapist overhead; school-to-clinic assignment is not required.

The original workbook stays in private Library. A source-specific offline
extractor retains school labels, source row/cell coordinates, hours and income
cell states, formulas and cached results, period intervals, source controls,
review notes and the original hash/Library version. Actual source files, audits,
SQL, amounts and school detail must stay outside this public repository.
Only synthetic fixtures belong in tests.

## Source observations and period selection

Schools is an independent profit center alongside the clinic choices. The school
source card appears under Schools and All profit centers, and is hidden for
individual clinics. Its period selector still applies. Currency,
accounting basis, hours meaning and source mappings remain null. No school label
becomes a district or therapist identifier. Reported school income
is displayed separately from PracticePro payments, accounting revenue, labor and
profit; it does not create normalized metric batches or satisfy monthly coverage.

Numeric detail subtotals preserve signed values and explicit zero. Blank, dash
and error cells remain distinct, and an interval with no numeric cells displays
unknown. Source control formulas never become additional facts.
Repeated labels retain their source row identities.

When Schools is selected, an adjacent School dropdown lists every school source
row for the reporting year, including rows whose selected-period amounts are
blank. Options are keyed by source hash, year and original row. Repeated names
include their worksheet/cell reference; aliases and repeated rows are not merged.
All schools is the default. The selection persists across same-year month and
MTD/YTD changes, including their transient loading states. Options and amounts
stay hidden during loading. Selection resets when the verified source/year
changes, a ready response has no usable source, or access is denied. Clinic and
All profit centers views ignore the school-row selection.

Selecting a school filters its workbook subtotal, cell counts, period table and
source-row detail together. Original controls and review notes remain explicitly
workbook-wide evidence. Monthly normalized invoices currently lack retained
school/therapist dimensions, so their all-school subtotal is withheld for an
individual school rather than attributed to that school.

The adjacent Therapist selector displays **Therapist data needed** and is disabled.
The current dashboard payload provides no verified school-to-therapist roster or
school-specific labor facts. Enabling therapist selection needs a reviewed,
minimized school/therapist breakdown with stable identifiers, source provenance,
matching work-time/payroll periods and supported cost treatment. Neither source
hours nor payroll names are used to infer those relationships. School labor and
profit remain unavailable; this presentation change adds no allocation, schema,
access, source imports or accounting facts.

July/August is one two-month interval, included once in YTD only after August.
Neither July nor August MTD receives an invented split; July YTD excludes the
combined interval with an explanation. An ambiguous leading December remains
unassigned and is excluded from calendar-period subtotals. Partial numeric
coverage never establishes a complete month or year.

## Reviewed private ingestion

1. Retrieve and inspect the original through private Library. Confirm financial
   aggregates only, source identity, supported headers and exceptions.
2. Run `scripts/extract-school-income.py` in the existing spreadsheet runtime,
   with input/output outside the repository. It performs no network requests or
   formula evaluation. Unsupported layout, precision, hidden content, sensitive
   markers, uncached formulas and unlabeled detail with values fail closed.
3. Validate the audit against the original. Independently review the exact
   payload and source cells; screening markers alone are not privacy approval.
4. Run `scripts/prepare-school-income-import.mjs` with the audit, original and
   private output prefix. It rechecks the original hash, size and filename,
   strictly validates the minimized contract, and produces private JSON/SQL.
5. Recheck the intended existing project, RLS, matching hash and overlapping
   source years before executing the reviewed SQL through authorized access.

The insert is a single transaction under an advisory lock. The existing unique
index also guards source type/month/hash. An identical replay is a no-op even
with newly prepared UUIDs/timestamps. A conflicting same-hash source or another
active school audit covering the same year is rejected; no records are updated,
deleted or superseded automatically. SQL recomputes leaf totals/counts before
insertion. No schema, permissions or source-selection rules are changed.

Read back the stored audit, compare it with the reviewed payload, verify source
counts/totals and confirm normalized metric batches remain unchanged. Then test
the deployed protected view at the released revision, including MTD/YTD, the
combined interval, missing periods, source details, scope and access gates.

## Checks

- JavaScript parser, source-selection, SQL transaction and protected UI tests:
  `node --experimental-strip-types --test tests/cheshire-school-income*.test.mjs`
- Synthetic extraction checks in the existing Python/openpyxl runtime:
  `python3 tests/school_income_extractor_test.py`
- Existing regression suite and production TypeScript/Vite build.

Validated monthly revenue still requires confirmed currency and accounting
basis, complete reporting scope, resolved source exceptions and school/provider identities, monthly invoices or
receipts, district/therapist IDs, billing basis/quantity, contract rates/effective
dates and reconciled control totals. Combining revenue requires a demonstrated
overlap reconciliation with other payment/accounting sources. Profit additionally
requires compatible school therapist labor. The employment-cost components and
paid-time treatment still need source support; non-therapist overhead belongs to
Clinics under the owner’s policy. The selector adds no labor allocation or profit
calculation. See [monthly intake](cheshire-monthly-intake.md#profit-center-selection)
for the exact selector, source-separation and compatibility behavior.
