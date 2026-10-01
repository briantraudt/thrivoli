# Validated upload metrics (review candidate)

## Purpose and rollout boundary

This patch connects eligible current-month aggregate uploads to the private dashboard. It does not import existing historical audit summaries, alter the supplied fixed-monthly baseline, or seed example data. Apply the candidate migration and deploy the revised intake function only after independent review and owner approval for this project. Deploy the function before the UI. Existing approved accounts and existing project credentials are unchanged.

Re-run checks on already uploaded monthly files to create the normalized version. Existing validation metadata alone is not a metric batch. Historical `source-audit-v1` evidence remains in its dated source detail and does not enter monthly metrics.

## Trust and transaction boundaries

1. The existing intake handler independently verifies the user session, finance-reader UUID and portal email membership before either review or metric reads.
2. Immutable storage bytes must match the reserved SHA-256 and byte count. The existing bounded parser and all seven deterministic gates run before normalization.
3. Typed normalized rows contain canonical metric keys, integer minor units, explicit date/billing basis, canonical location when supported, and original source-row numbers. They contain no original filenames or provider/staff names or identifiers. Insurance facts retain the source payer ID/organization name for aggregate reporting; payer values are never sent to AI. Original provenance stays in the existing private document and original file.
4. A service-only, SECURITY INVOKER RPC locks the exact document/review token and commits the review plus batch in one transaction. Hash, reporting month, validator/normalizer versions, source dependencies and dependency review nonces are retained. Failed/stale review transactions never create current facts. Previous versions remain stored for audit; only the exact current reviewed version can be served. Recurring baseline references are explicitly rejected as monthly actuals.
5. A second service-only RPC reads documents, the matching batches and overhead revision in one database snapshot. The existing authenticated edge handler validates current status, all gates, exact versions, supersession, unique active source and dependency revisions before emitting aggregate figures.
6. Browser/anonymous roles have no table access and no EXECUTE on either RPC. The edge operation emits source-scoped aggregates and provenance IDs/hashes, never the private row array. AI request construction is unchanged and receives no metrics, currency values, hashes, files or names.

## What is displayed

- Insurance/patient payments, charges, write-offs, adjustments and outstanding balances, grouped separately by payment-date, service-date or report-as-of basis, with reconciled payer subtotals and per-basis location/row coverage; more than 100 distinct payer identifiers is withheld for aggregate-scope review
- Completed/scheduled clinic visits, cancellations, no-shows, clinic units and worked hours, on service-date basis
- School invoiced amounts and billed hours/visits, as distinct measures; invoices are never called cash receipts
- Specialty-program income on its declared reporting-month basis, with receipt timing explicitly unconfirmed
- Company-scoped loaded payroll and paid hours. Gross-inclusive payroll never re-adds its PTO/bonus breakdown; disjoint payroll adds those components exactly once
- Operating expenses split into additional amounts and amounts already in the baseline; the latter are never added again
- Fully validated uploaded monthly overhead, distinct from the owner-confirmed fixed baseline

The location filter uses source-backed location fields. School billing and payroll have no approved location mapping in their source contract, so their location metrics stay unavailable. This patch does not fabricate an allocation or use a 50/50 split. It also does not display therapist-level metrics.

Each source can be complete against its approved manifest while the overall business still has partial coverage. The UI says “source-specific subtotals,” not complete company revenue. Multiple active files are withheld until their union/overlap is reconciled; they are not silently added. Repeated monthly clinic/provider/program keys, ambiguous school rate scope and duplicate baseline overlap matches are withheld with a concrete reconciliation finding.

## Required definitions and limits

- Insurance uploads require a bounded aggregate payer ID or organization name. Literal payer identities remain distinct; no alias mapping is guessed. Patient/member/subscriber identifiers remain blocked.
- Monetary uploads for cash programs, payroll, operating expenses and overhead can now include a `currency` column. Metric display requires every row to explicitly say `USD`. Older files without this evidence remain validated documents with a visible currency-confirmation blocker. No currency is inferred from a number or filename.
- Exact-byte, full-matrix fixed-baseline reuploads remain recurring references with no reported actual month. They do not create monthly metrics or a redundant same-month blocker. Changed sources retain normal period gates.
- Full deterministic coverage is required for monthly metric staging. Partial historical evidence remains separately visible; this patch does not infer complete monthly actuals from it.
- The sidebar requests the common accounting definition, monthly cutoff/timezone and matching-period revenue/payroll/expense evidence. Monthly income, invoices, payroll and expenses do not establish compatible accounting semantics just because their month labels match.
- Profit, margin and break-even remain unavailable until the revenue definition, full cost scope, timing, allocation and overlap are reconciled. The fixed-monthly overhead assumption remains supported, and its unknown cells remain unknown.
- The currency column is optional for retaining existing intake documents but required for monetary metric readiness in the affected source types. It appears in new blank templates.

## Remaining product implementation (not merely missing uploads)

This candidate is an initial company/location source-metric layer, not completion of the full client brief. These requests still need implementation and their supporting source/definition contracts:

- Therapist/provider-level visits, cancellations, no-shows and financial views. Current normalized rows deliberately omit provider IDs; original private source files retain evidence for future authorized reprocessing
- An approved arrival-rate numerator/denominator and the corresponding office/provider view
- Employee expense categories, location/group reporting, and a reconciled staff allocation calculation
- Source-supported school and payroll location mappings; company-scope figures do not satisfy location-level labor/school economics
- Tiered owner, office and therapist authorization. This candidate preserves the existing finance-reader plus portal-member audience and adds no new audience or role hierarchy

These implementation gaps are separate from the missing accounting definition, currency evidence and incomplete uploaded-source coverage described above. Do not describe the broader client dashboard requirements as complete when this candidate is activated.

## Verification and deployment checklist

Run `node --test tests/*.mjs`, `npm run build`, and focused ESLint against changed TS/TSX files. Tests use synthetic inputs only, including local PostgreSQL (PGlite) transaction/access tests and UI lifecycle tests. The new test dependencies are development-only and do not enter the browser bundle.

Before production activation:

- Independently review the migration, edge function and serving rules
- Apply the migration, deploy the edge function with the new shared module, then the UI
- Verify anonymous and unauthorized reads are denied in the real project
- With an approved account, re-review one real aggregate monthly source and confirm exact provenance, scoped figures and blockers
- Confirm an interrupted review, replacement upload or changed manifest immediately withholds stale current metrics, with the source history retained
- Do not use a synthetic test upload in production or claim this patch calculates reconciled profit

No production schema, source rows, permissions, credentials or deployments were changed while preparing this candidate.


## Checklist review-version correction

The checklist now compares the source identity/hash and a separate, server-owned review revision. A successful re-review rotates `review_revision` even when the bytes are unchanged, and the finalization transaction records `validation_dependency_revisions` while holding its existing dependency locks. These UUIDs are metadata only; the browser does not select or receive the internal `review_token`. The same RLS audience and RPC privileges remain in place.

Apply `20261001194828_cheshire_checklist_review_freshness.sql` first, then deploy the updated intake edge function, then the UI. The UI explicitly selects the additive columns, so it must not precede the migration. Legacy reviews have no inferred revision evidence and remain incomplete until rechecked in dependency order: coverage manifest, payroll, then dependent sources/allocation. Allocation also rejects payroll whose own manifest review is stale. Operating expenses require the current matching overhead-reference revision, including when one is missing.

Synthetic model, provider lifecycle, service response, and local PostgreSQL tests cover same-byte manifest/payroll re-reviews, completed replacement IDs, transitively stale payroll, missing/malformed versions, interrupted reviews, ambiguous sources, current-reference positives, and missing/changed overhead references. No real source values are changed or inferred by this correction.

## Worksheet identity correction

XLSX intake resolves the package office-document relationship, declared workbook sheets, worksheet content types and shared-string relationships before reading values. Duplicate/missing/orphan worksheet parts, hidden sheets, nonworksheet links and external/ambiguous targets are rejected for manual review. Nonstandard worksheet filenames and namespace-prefixed spreadsheet cells are supported when their declared graph is unambiguous.

The XML reader stops during construction at 25,000 elements across the entire workbook (at most 20,000 per package-metadata part), depth 30, 64 attributes/namespaces per element, 50,000 workbook-wide attributes, 256-character namespace URIs, 4 MiB of workbook-wide expanded names and 20,000-character raw/decoded text and attribute values. This conservative limit bounds tree memory; larger supported-value exports should use CSV. It consumes structural cell and shared-string content rather than matching raw markup. XML comments cannot create source cells or shift shared-string indexes. Duplicate cells, unsupported layouts, hidden data rows, conflicting value structures, entity declarations and DTDs fail closed. Existing archive-size, row/column, formula, restricted-field and reconciliation gates still apply. Uncommon unsupported exports should be provided as one visible aggregate worksheet or CSV; no file is silently partially accepted.

The parser correction requires the new shared `cheshire-xlsx-identity.ts` module in the edge-function deployment. Synthetic relationship, comment, namespace, duplicate-cell and shared-string tests stay local. Recheck the unchanged original overhead privately after activation; preserve its source hash, exact cells and blanks, and do not promote its fixed baseline to current-month actuals.
