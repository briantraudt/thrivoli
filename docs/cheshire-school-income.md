# Reported school income

The protected financial dashboard reads a `school-income-audit-v1` payload from
`cheshire_intake_document.validation.school_income_audit`. This uses the existing
`school_billing` / `existing_source` / `incomplete` envelope and `source-audit-v1`
validator, with null requested month, reported month and storage path.
The existing finance-reader and portal-member RLS policy remains unchanged.

The original workbook stays in private Library. A source-specific offline
extractor retains school labels, source row/cell coordinates, hours and income
cell states, formulas and cached results, period intervals, source controls,
review notes and the original hash/Library version. Actual source files, audits,
SQL, amounts and school detail must stay outside this public repository.
Only synthetic fixtures belong in tests.

## Source observations and period selection

Currency, accounting basis, hours meaning and mappings remain null. No school
label becomes a clinic, district or therapist identifier. Reported school income
is displayed separately from PracticePro payments, accounting revenue, labor and
profit; it does not create normalized metric batches or satisfy monthly coverage.

Numeric detail subtotals preserve signed values and explicit zero. Blank, dash
and error cells remain distinct, and an interval with no numeric cells displays
unknown. Source control formulas never become additional facts.
Repeated labels retain their source row identities.

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
basis, complete reporting scope, resolved source exceptions, monthly invoices or
receipts, district/therapist IDs, billing basis/quantity, contract rates/effective
dates and reconciled control totals. Combining revenue requires a demonstrated
overlap reconciliation with other payment/accounting sources. Profit additionally
requires compatible fully loaded labor and allocated overhead.
