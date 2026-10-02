# Cumulative source reports

Cumulative PracticePro exports remain independent source reports. They are not copied into monthly metric batches, divided into monthly values, blended across date bases, or used to calculate profit from incomplete costs.

The bounded existing-source import uses three `cheshire_intake_document` records with `requested_month`, `reported_month`, and `storage_path` null, `source_origin: existing_source`, and `status: incomplete`. Each existing `source-audit-v1` validation contains a strictly checked `cheshire-cumulative-v1` report. Originals remain in the owner's private Library with exact version/hash provenance. The portal does not claim it can download or automatically recheck these originals. Legacy XLS upload support remains an intake gap; the existing bucket MIME policy is unchanged.

The report kinds preserve distinct semantics:

- Insurance reimbursement: service-date-cohort payments and visits; totals derive from payer-company leaves, excluding repeated group subtotals
- Treating providers: payment-posting-date collections, with no inferred facility, therapy, compensation, or profitability
- Facility activity: reported charges/payments/adjustments with the title/filter date-basis conflict retained. Facility-only unposted amounts remain separate, including null blanks

The headline chooses one report family before applying location scope. The default facility-reported family therefore reconciles between all locations and the individual source locations. It is labeled Reported payments; the unresolved basis remains disclosed. The other reports are independent detail, not additional revenue.

A cumulative report appears only under compatible YTD filters, never MTD or a month earlier than the report endpoint. Later months retain the exact observed endpoint and Need Data state. Multiple reports of the same kind/end date with conflicting source hashes fail closed. Original zero and missing values remain distinct. The owner-approved 2026 fixed-overhead estimate counts full months through October; it remains a partial estimate, separate from actual expenses and the report's daily cutoff.

## Private import workflow

1. Independently reconcile and screen originals outside the repository
2. Adapt to the shared cumulative contract, preserving only leaf facts, controls, original coordinates and qualifications
3. Run `node --experimental-strip-types scripts/prepare-cumulative-import.mjs PRIVATE_REPORT_ARRAY PRIVATE_OUTPUT_PREFIX` with both paths outside the repository
4. Review the exact private JSON/SQL packet and original file hashes before executing it through the existing authorized database connection
5. Verify inserted row identities, hashes, counts, totals, null months and status. The SQL transaction independently checks scope and arithmetic and either inserts all records or rolls back
6. Replaying the same facts is a no-op; a differing existing same-hash source is rejected. Never overwrite original or monthly records. If correction is needed, stop and review a separate bounded supersession or quarantine operation; preserve original records and Library originals

There is no new schema, privilege, policy, credential, provider setting, or edge-function change. Existing portal membership plus finance-reader RLS governs the records; client writes remain unavailable. Actual reports, provider names, amounts, import payloads and private SQL must never enter the repository or GitHub comments.
