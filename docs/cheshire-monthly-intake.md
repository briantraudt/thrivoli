# Cheshire monthly source intake

## Security and activation

- Apply the reviewed monthly-intake and fixed-monthly-basis migrations before releasing this UI.
- Deploy `supabase/functions/cheshire-intake-review/index.ts` with its local shared TypeScript files and `deno.json` import map. The handler verifies the incoming Supabase token with `/auth/v1/user`, then independently requires finance-reader UUID and portal email membership. It never trusts browser status/role claims.
- The function uses the project's existing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and optional existing `HF_TOKEN`. No credential value belongs in this repository.
- AI starts disabled in service-only `cheshire_intake_settings`. After authorized review, set the singleton's `ai_enabled` to true. `ai_monthly_limit` cannot exceed 10. Each unchanged file/type/month/validator/dependency review reserves one call, including failures. Responses are limited to 256 tokens.
- The recipient is the existing Hugging Face router using `openai/gpt-oss-120b:cerebras`. Outbound content is rebuilt from canonical source/field/check codes and bounded counts. No raw headers, filenames, contents, names, financial values, source hashes, or legacy reported metrics are included. Returned suggestions may prioritize failed checks; they cannot make a source complete.
- The private bucket accepts at most 5 MiB per immutable object. Uploads go directly from the verified browser identity to a server-reserved own path. Browser metadata/status writes and object overwrite/deletion are denied. Restrictive bucket policies constrain unrelated broad Storage policies.
- Scans, quarantined sources, reviewing/error versions and sources without passed document/privacy gates are not available for browser raw-file download. Header screening is not a guarantee that a report contains no personal information; the uploader must provide aggregate-only data.

## Completion contract

A file is complete only after explicit source month, required columns, typed literal values, declared coverage, arithmetic/control totals and supported document/privacy checks all pass. Unknowns remain unknown. The monthly checklist also rechecks dependency versions and fixed-baseline revisions. Multiple retained files remain incomplete until their union and overlap are reconciled; partial evidence is retained rather than discarded.

Payroll requires an explicit inclusive-gross or disjoint-component basis. School hours and clinic visits/units are distinct. Shared allocations must conserve the source amount. Fixed overhead is a separately labeled owner-confirmed recurring baseline, not monthly GL actuals. Blank baseline cells and overlap gaps remain unresolved.

Earlier uploaded sources are stored as `source-audit-v1` metadata with period/scope labels and optional numeric reported metrics. They never satisfy the selected-month checklist. Historical metrics render only in the dated earlier-source detail, not company totals or profit.

## Independent monthly school coverage

Schools are independent of clinic locations. In `coverage_manifest`, each active `school_billing` row must use `location=not_applicable` and name one district/provider pair. Duplicate pairs, clinic-attributed school rows, blank scope, and mixed active/no-activity declarations fail review. When there is no school activity, supply exactly one school row with `coverage_status`, `location`, `provider_id`, and `district` all `not_applicable`. That declaration verifies the manifest scope only; it does not create zero invoices or make a missing school billing export complete.

Every other source type still declares active or not-applicable coverage for each of the seven clinics. The school roster is built separately from the clinic provider map. School invoice exports keep their existing district/therapist/billing-basis/quantity/rate/period/total fields and omit a location column. They must match the independently reviewed district/provider roster and retain existing arithmetic, rate-date, currency and privacy checks.

New manifest and school reviews carry `school_scope_version=school-independent-v1` in their existing validation JSON. School billing completion, normalization and metric reads require that marker on both the billing review and its supporting manifest, plus the existing exact source/review dependency checks. Legacy school approvals must be re-reviewed; a manifest with old clinic-attributed school rows requires a corrected, superseding source upload. Historical files, receipts and reported amounts are retained unchanged. Historical `source-audit-v1` school income does not use this monthly approval path.

This policy marker does not invalidate legacy clinic, payroll or expense reviews merely because they lack the school marker. Replacing or re-reviewing the shared manifest still changes its existing dependency revision: every source that depended on that specific manifest then needs its usual freshness check/re-review. Do not bypass that freshness rule or automatically rewrite earlier approvals.

No database migration, access change, credential change or data backfill is needed. After release approval, deploy the revised intake function before the matching UI. Until then these are local candidate changes. The existing JSON validation storage and validator/normalizer version contracts remain unchanged.

Brian's business-unit policy assigns therapist labor to Schools or Clinics according to source-supported work; Clinics absorb all non-therapist overhead. School overhead allocation is not a prerequisite. This billing correction does not implement labor allocation or change the payroll intake contract.

## Profit-center selection

The existing selector is labeled **Profit center** and offers **All profit centers**, the seven clinic locations, and **Schools**. `schools` is a presentation identity distinct from the clinic location contract. It is never added to `LOCATIONS`, `INTAKE_LOCATIONS`, database rows, or uploaded school records. The protected metrics request continues using the existing `location=all` route for Schools; the view selects only the authorized `school_billing` source and its blockers before showing any financial figures.

- **Schools** shows the historical school workbook and eligible monthly school invoice figures as separate evidence. Clinic activity, cumulative clinic/payment reports, company payroll, clinic overhead and operating costs are excluded from that financial view. School therapist labor and profit remain unknown. The existing monthly/year-to-date and combined-interval rules still apply.
- **A clinic** shows that clinic's reporting; it excludes historical and monthly school figures and school rows from its financial category table.
- **All profit centers** shows the source-specific reporting together, with an explicit warning that the school workbook and invoices may overlap each other and existing PracticePro/QuickBooks payments. They are never added into a consolidated revenue or profit total. Existing source subtotals retain their labels and period caveats.

The data-request/source-review panel stays explicitly workspace-wide, so source evidence is not hidden or reclassified when selecting a profit center. Existing authentication and finance-access gates still apply. Selector state does not change source bytes, amounts, mappings, importer replay behavior or access. No therapist labor calculation, payroll ingestion, schema change or new API contract is included.

## First-release limits

- CSV and bounded supported XLSX aggregate tables receive deterministic checks.
- PDF/PNG scans and unsupported or ambiguous spreadsheets are retained as incomplete for manual review. No OCR is performed.
- Files with unconsumed meaningful cells, unknown columns, formulas, unsupported cell types, multiple populated sheets, suspicious identifiers, unsafe ZIP structure or mismatched totals cannot auto-complete.
- An abandoned reservation owned by another approved account must be completed by that uploader or reviewed by the owner; ownership is never silently reassigned.
- Upload review stores original files and validation/provenance. It does **not** automatically import parsed financial rows into dashboard revenue, labor or profit metrics. Metric ingestion requires a separately reconciled source/period/unit pipeline. The separately reviewed candidate in `cheshire-validated-metrics.md` adds that source-specific path, with its own migration and activation checks.

## Verification

Run `node --test tests/*.mjs`, `npm run build`, and focused ESLint on the changed source/shared-function files. Tests use synthetic inputs only. Production RLS, authorized real-source display, responsive visual layout and actual upload roundtrip need separate deployment verification before main release.
