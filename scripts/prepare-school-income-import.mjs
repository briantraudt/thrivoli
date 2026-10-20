/** Offline preparation only. Real source payloads must remain outside this public repository. */
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, realpath } from 'node:fs/promises';
import { resolve, relative, dirname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseSchoolIncomeAudit } from '../supabase/functions/_shared/cheshire-school-income.ts';
import { REQUIRED_CHECKS } from '../supabase/functions/_shared/cheshire-intake.ts';

export function prepareSchoolIncomeDocument(input, timestamp = new Date().toISOString()) {
  const audit = parseSchoolIncomeAudit(input);
  if (!Number.isFinite(Date.parse(timestamp))) throw new Error('Invalid review timestamp');
  return {
    id: randomUUID(), source_type: 'school_billing', source_origin: 'existing_source', status: 'incomplete',
    requested_month: null, reported_month: null, storage_path: null,
    file_name: audit.source.filename, byte_size: audit.source.byteSize, content_sha256: audit.source.sha256,
    mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    no_phi_attested_at: timestamp, reviewed_at: timestamp, review_revision: randomUUID(),
    source_period_label: `${audit.sheets.map(s => s.year).join(', ')} · partial school source intervals`,
    source_scope_label: 'School-level source rows; currency, accounting basis and location/provider mapping unconfirmed',
    figure_unlocked: 'Reported school income source detail only; normalized revenue and profit remain incomplete',
    validation: {
      validator_version: 'source-audit-v1', status: 'incomplete', reported_month: null,
      checks: REQUIRED_CHECKS.map(key => ({ key, passed: ['document_type', 'privacy'].includes(key),
        message: key === 'privacy' ? 'Reviewed financial-only school aggregates. No patient or student records retained.'
          : key === 'document_type' ? 'Reviewed workbook layout with source cells preserved.'
          : 'Source observations retained; monthly financial requirements and source exceptions remain unresolved.' })),
      missing_items: [
        'Confirm currency, invoice/payment/service basis, hours meaning, reporting cutoff and complete school coverage.',
        'Resolve formula errors, ambiguous December, repeated labels and aliases, subtotal omissions and possible carried-forward activity.',
        'Supply monthly invoices/receipts, district/therapist IDs, billing basis, quantities, contract rates/effective dates and reconciled report totals.',
        'Approve school/location/provider mappings and reconcile overlap with PracticePro and QuickBooks before combining revenue.',
        'Provide matching fully loaded labor and overhead before calculating school or location profit.',
      ],
      row_count: audit.sheets.reduce((n, s) => n + s.rows.length, 0), covered_locations: [], canonical_fields: [],
      ai_status: 'not_requested', school_income_audit: audit,
    },
  };
}

export function schoolIncomeImportSQL(document) {
  const audit = parseSchoolIncomeAudit(document?.validation?.school_income_audit, document?.content_sha256);
  const expected = prepareSchoolIncomeDocument(audit, document.reviewed_at);
  // Ephemeral audit IDs do not change an identical replay. All other envelope fields are fixed.
  for (const key of Object.keys(expected).filter(k => !['id', 'review_revision'].includes(k))) {
    if (JSON.stringify(document[key]) !== JSON.stringify(expected[key])) throw new Error(`Invalid school import envelope: ${key}`);
  }
  const json = JSON.stringify(document);
  const delimiter = prefix => {
    let i = 0, token;
    do { token = `$${prefix}_${createHash('sha256').update(json).digest('hex')}_${i++}$`; } while (json.includes(token));
    return token;
  };
  const body = delimiter('school_guard'), payload = delimiter('school_private');
  return `-- PRIVATE: school source evidence. Never commit or publish this payload.
begin;
do ${body}
declare
 item jsonb := ${payload}${json}${payload}::jsonb;
 audit jsonb; sh jsonb; existing public.cheshire_intake_document;
 total numeric; numeric_count integer; pair_count integer; row_count integer; matches integer;
begin
 perform pg_advisory_xact_lock(hashtextextended('cheshire-school-income-reviewed-import',0));
 audit := item->'validation'->'school_income_audit';
 if item->>'source_type' is distinct from 'school_billing' or item->>'source_origin' is distinct from 'existing_source'
 or item->>'status' is distinct from 'incomplete' or item->>'requested_month' is not null or item->>'reported_month' is not null
 or item->>'storage_path' is not null or item->'validation'->>'validator_version' is distinct from 'source-audit-v1'
 or item->'validation'->>'status' is distinct from 'incomplete'
 or audit->>'version' is distinct from 'school-income-audit-v1'
 or audit->'source'->>'sha256' is distinct from item->>'content_sha256'
 or coalesce(item->>'content_sha256','') !~ '^[a-f0-9]{64}$'
 or audit->'currency' is distinct from 'null'::jsonb or audit->'accountingBasis' is distinct from 'null'::jsonb
 or audit->'hoursBasis' is distinct from 'null'::jsonb or audit->'mappings' is distinct from 'null'::jsonb
 then raise exception 'Invalid school source envelope'; end if;
 row_count := 0;
 for sh in select value from jsonb_array_elements(audit->'sheets') loop
  if (select count(distinct r->>'row') from jsonb_array_elements(sh->'rows') r) <> jsonb_array_length(sh->'rows')
  then raise exception 'Duplicate school source row'; end if;
  if exists(select 1 from jsonb_array_elements(sh->'rows') r where jsonb_array_length(r->'values')<>jsonb_array_length(sh->'periods'))
  then raise exception 'Missing source cells'; end if;
  select coalesce(sum((v->'income'->>'value')::numeric)*100,0),count(*) into total,numeric_count
  from jsonb_array_elements(sh->'rows') r cross join lateral jsonb_array_elements(r->'values') v
  where v->'income'->>'state'='number';
  select count(*) into pair_count from jsonb_array_elements(sh->'rows') r cross join lateral jsonb_array_elements(r->'values') v
  where v->'income'->>'state'<>'blank' or v->'hours'->>'state'<>'blank';
  if total is distinct from (sh->>'rawHundredths')::numeric or numeric_count is distinct from (sh->>'numericCells')::integer
  or pair_count is distinct from (sh->>'populatedPairs')::integer or abs(total)>9007199254740991
  then raise exception 'School source arithmetic failed'; end if;
  row_count := row_count + jsonb_array_length(sh->'rows');
 end loop;
 if row_count is distinct from (item->'validation'->>'row_count')::integer then raise exception 'School source row count failed'; end if;
 select count(*) into matches from public.cheshire_intake_document where source_type='school_billing' and content_sha256=item->>'content_sha256';
 if matches>1 then raise exception 'Ambiguous same-hash school source'; end if;
 select * into existing from public.cheshire_intake_document where source_type='school_billing' and content_sha256=item->>'content_sha256';
 if found then
  if existing.source_origin<>'existing_source' or existing.status<>'incomplete' or existing.requested_month is not null
  or existing.reported_month is not null or existing.storage_path is not null
  or existing.file_name is distinct from item->>'file_name' or existing.byte_size is distinct from (item->>'byte_size')::integer
  or existing.validation is distinct from item->'validation'
  then raise exception 'Conflicting same-hash school source; no overwrite allowed'; end if;
 else
  if exists(
   select 1 from public.cheshire_intake_document d
   cross join lateral jsonb_array_elements(d.validation->'school_income_audit'->'sheets') s
   where d.source_type='school_billing' and not exists(select 1 from public.cheshire_intake_document replacement where replacement.supersedes_id=d.id)
   and exists(select 1 from jsonb_array_elements(audit->'sheets') incoming where incoming->>'year'=s->>'year')
  ) then raise exception 'Overlapping school source requires explicit reconciliation'; end if;
  insert into public.cheshire_intake_document(id,source_type,source_origin,status,requested_month,reported_month,storage_path,file_name,content_sha256,byte_size,mime_type,no_phi_attested_at,reviewed_at,review_revision,source_period_label,source_scope_label,figure_unlocked,validation)
  values((item->>'id')::uuid,'school_billing','existing_source','incomplete',null,null,null,item->>'file_name',item->>'content_sha256',(item->>'byte_size')::integer,item->>'mime_type',(item->>'no_phi_attested_at')::timestamptz,(item->>'reviewed_at')::timestamptz,(item->>'review_revision')::uuid,item->>'source_period_label',item->>'source_scope_label',item->>'figure_unlocked',item->'validation');
 end if;
end;
${body};
commit;
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [auditPath, originalPath, prefix] = process.argv.slice(2);
  if (!auditPath || !originalPath || !prefix) throw new Error('Use audit JSON, original workbook and private output prefix');
  const repo = await realpath(new URL('..', import.meta.url));
  for (const p of [auditPath, originalPath, prefix]) {
    const path = p === prefix ? resolve(await realpath(dirname(p)), basename(p)) : await realpath(p);
    const rel = relative(repo, path);
    if (!rel.startsWith('../')) throw new Error('Private inputs and outputs must remain outside the repository');
  }
  const audit = parseSchoolIncomeAudit(JSON.parse(await readFile(auditPath, 'utf8')));
  const bytes = await readFile(originalPath);
  if (createHash('sha256').update(bytes).digest('hex') !== audit.source.sha256 || bytes.length !== audit.source.byteSize || basename(originalPath) !== audit.source.filename) throw new Error('Original source identity mismatch');
  const document = prepareSchoolIncomeDocument(audit);
  const sql = schoolIncomeImportSQL(document);
  await writeFile(prefix + '.json', JSON.stringify(document), { mode: 0o600, flag: 'wx' });
  await writeFile(prefix + '.sql', sql, { mode: 0o600, flag: 'wx' });
  console.log(JSON.stringify({ prepared: true, sheets: audit.sheets.length, rows: document.validation.row_count, databaseWrites: 0 }));
}
