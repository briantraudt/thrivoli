# Cheshire financial reporting

## First reporting release

The protected dashboard at `/cheshire/dashboard` reads one current monthly overhead snapshot. It shows the seven workbook locations, a known-amount subtotal, unknown cells, category breakdowns, original source-cell drilldowns, and the remaining revenue and labor requirements. It does not calculate profit, margin, or break-even from incomplete costs. A monthly cadence does not establish an accounting month: `effective_month` must stay `null` until confirmed.

The reporting location labels do not assert that the live organization/location master mapping has been completed. No patient information belongs in this snapshot. Insurance copays must not be silently classified as cash specialty-program revenue.

## Storage and access

Review and apply `20261001143404_cheshire_finance_snapshots.sql` using the normal approved migration process. It contains schema and policies only. Never place source workbooks, actual amounts, account credentials or private import payloads in the repository, migrations, public assets, or frontend environment variables.

- `cheshire_finance_reader` binds approved financial readers to existing `auth.users.id` values
- Readers must also retain their existing Cheshire portal membership
- Both tables have RLS enabled and no anonymous permissions
- Authenticated users can only read; there are no browser writes
- Privileged imports and reader provisioning use an approved server-side route
- Applying the migration alone grants no person financial access

Provision only the exact accounts approved by the owner, after verifying their existing confirmed authentication records. An approved portal email with no authentication account remains pending. Do not create an account, guess a user ID, broaden portal membership, or automatically grant future registrants access. After a pending person completes their normal confirmed registration, verify the exact approved email and user ID, then provision that ID through the reviewed privileged route. Revocation of either portal membership or finance readership blocks the snapshot.

## Import contract

The snapshot must have ID `current-overhead`, a source label, source SHA-256, `cadence: monthly`, nullable `effective_month` (the first day of the confirmed month), and a trustworthy import timestamp. `overhead_rows` contains the complete 7 × 20 matrix. Every row contains `location`, `category`, `sourceCell`, and `amount`.

Amounts are non-negative decimal strings with at most two decimal places, or `null` for an unknown blank. A string `0` is an explicit source zero. Preserve the original source-cell identity. Do not fill blanks, convert monthly figures to annual/weekly figures, or infer a date. Import must validate through `parseFinanceSnapshot` before writing and reconcile the source totals in integer cents. Re-importing updates the same snapshot ID rather than accumulating duplicate overhead.

Store the private payload outside the checkout. The dashboard fails closed on malformed, missing, or inaccessible source data. Refresh clears prior values before fetching again. Identity changes and unmounts invalidate pending requests; an old-account response cannot restore prior financial values.

## Required release checks

1. `npm run build`
2. `node --test tests/*.test.mjs`
3. `npm run lint` (record any pre-existing unrelated failure separately)
4. Check row/location/company reconciliation, null versus zero, source provenance and monthly basis against the private source
5. Verify anonymous and unapproved users cannot read either finance table; approved readers can read only when portal membership also exists
6. Verify direct browser insert/update/delete attempts are denied, and no private values are present in deployed assets
7. Check desktop/mobile layout, location filtering, each financial tab, open/close and repeated source drilldowns, refresh, sign-out and account transitions

## Weekly review and next inputs

Use monthly economics during the weekly review; do not manufacture weekly overhead actuals. Confirm the effective month and blank cells, then import same-period insurance payments, school invoicing and specialty-program income. Fully loaded payroll needs actual hours or agreed effective-dated allocations across therapists, supervisors, clinic managers, executives, office/scheduling and billing/authorization staff.

School work may exclude clinic occupancy costs, but school labor and shared administration still need classification. Reconcile EMR and payroll/collection-fee entries against central systems costs before totaling expenses. Never duplicate an allocated source cost. Therapist, location and company allocations must conserve 100% of the source cost before profit or break-even is enabled.
