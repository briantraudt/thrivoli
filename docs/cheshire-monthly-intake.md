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

## First-release limits

- CSV and bounded supported XLSX aggregate tables receive deterministic checks.
- PDF/PNG scans and unsupported or ambiguous spreadsheets are retained as incomplete for manual review. No OCR is performed.
- Files with unconsumed meaningful cells, unknown columns, formulas, unsupported cell types, multiple populated sheets, suspicious identifiers, unsafe ZIP structure or mismatched totals cannot auto-complete.
- An abandoned reservation owned by another approved account must be completed by that uploader or reviewed by the owner; ownership is never silently reassigned.
- Upload review stores original files and validation/provenance. It does **not** automatically import parsed financial rows into dashboard revenue, labor or profit metrics. Metric ingestion requires a separately reconciled source/period/unit pipeline.

## Verification

Run `node --test tests/*.mjs`, `npm run build`, and focused ESLint on the changed source/shared-function files. Tests use synthetic inputs only. Production RLS, authorized real-source display, responsive visual layout and actual upload roundtrip need separate deployment verification before main release.
