# Guided report recognition and mapping

## First iteration

The monthly source-review panel now offers a generic report upload as well as a category-specific upload. Supported aggregate CSV and single-visible-sheet XLSX reports are inspected locally. Recognized column aliases produce candidate document groups, a required-field coverage count, and a proposed column mapping. Users can choose the report type and correct column meanings before confirming and uploading the original file.

The preview shows missing field labels, preserves unmapped columns as unresolved, and does not invent a reporting month, currency, zero, provider, location, allocation or financial value. Unknown or duplicate meanings require correction/review. A user's mapping confirmation does not establish completion.

### AI boundary

When the existing capped AI service is enabled, the preview sends only an allowlisted list of recognized canonical field codes, candidate source-type codes and a bounded row count. Raw headers, filenames, rows, values, names, identities and hashes are never sent to the AI provider. The AI can rank only the offered candidate source types. Its response cannot supply prose, a new mapping or a completion decision, and it never changes the selected category or confirmation.

This is bounded report-type assistance, not arbitrary report understanding. Unknown raw headers require human mapping. More capable recognition of unfamiliar labels would need explicitly scoped approval for sharing redacted header text, plus redaction and extraction controls. No such sharing is enabled here. AI outages, invalid responses and exhausted budget fall back to local suggestions.

## Provenance and validation

The upload still saves the unchanged original in the private bucket under its reserved SHA-256. The server re-downloads and verifies the original size/hash, reparses its structure, validates the user-confirmed source type, header-row number and source-column indexes, and then applies the mapping before the existing deterministic validator/metric normalizer. Original source record/worksheet row indexes remain attached to normalized metrics. Nonempty unconsumed columns, preambles, formulas and privacy markers keep completion blocked; restricted markers cannot be hidden by mapping.

Server-stamped mapping provenance is retained in the existing validation JSON: mapping version, original SHA-256, document group, header row, canonical target per column, confirming actor and timestamp. Re-running a saved source reuses its mapping and confirmation. A new explicit mapping can re-review the same retained original, rotating the existing safe review revision. No new table, policy, permission, audience or schema migration is required. Existing atomic finalization, dependency identity/hash/revision checks, source supersession and metric freshness rules remain authoritative.

The fixed-overhead baseline continues through its existing specialized checks. Location-matrix previews explicitly direct the reviewer to Location overhead; the existing source cannot be promoted to monthly actuals by its appearance or by the upload-month selector. Company profit remains unavailable until the separate accounting, scope, cost and overlap requirements are fulfilled.

## Unsupported sources

PDF/PNG, complex or ambiguous workbooks, hidden/orphan sheets and unsupported structures remain retained for manual review or an aggregate CSV/XLSX replacement. No OCR or raw-file AI transmission has been added. The browser blocks uploads when its local inspection detects restricted personal-data markers. Original server-side privacy checks remain mandatory.

## Deployment and verification

Deploy the updated intake function with the new shared `cheshire-report-mapping.ts` module before the frontend. The capabilities endpoint advertises `cheshire-mapping-v1`; a frontend connected to an older service cannot submit a confirmed mapping. Preserve the current custom authentication configuration and existing secrets/settings. There is no migration to apply and no new dependency.

All tests use synthetic local fixtures and mocked requests; never seed synthetic client dashboard records or upload a real report to test this feature. Run:

- `npm ci --ignore-scripts` (use a writable npm cache in restricted environments)
- `npm run build`
- `node --experimental-strip-types --test tests/*.test.mjs`
- ESLint for the changed source files; full-repo lint has the pre-existing unused `Shell` in `src/App.tsx`

The new tests cover missing/unknown data, corrected column semantics, duplicate/invalid/hash-mismatched mappings, preserved original/source-row provenance, formula/preamble/unmapped-column blocks, privacy markers, bounded AI payloads and malicious replies, budget/access failures, re-review revisions, repeated submits, replacement-file races, stale AI replies, category changes, unmounts and upload retry behavior. The original 111 tests remain in the aggregate suite.

Activation is separate from implementation review. No production schema/function mutation, client record mutation or merge was performed during candidate preparation.
