// Synthetic coverage only. No customer schools, staff or financial values.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INTAKE_REQUIREMENTS, INTAKE_LOCATIONS, SOURCE_TYPES, REQUIRED_CHECKS,
  SCHOOL_SCOPE_VERSION, tableFromMatrix, validateTable, hasCompletionEvidence,
} from '../supabase/functions/_shared/cheshire-intake.ts';
import { normalizeMetrics, serveMetrics, NORMALIZER_VERSION } from '../supabase/functions/_shared/cheshire-metrics.ts';
import { parseIntakeDocuments, buildMonthlyChecklist } from '../src/cheshire/intake.ts';

const month = '2026-09';
const hash = 'a'.repeat(64);
const revision = n => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
const schoolRow = (extra = {}) => ({
  reporting_month: month, source_type: 'school_billing', location: 'not_applicable',
  provider_id: 'synthetic-provider', district: 'synthetic-district', coverage_status: 'active', ...extra,
});
const otherManifestRows = () => SOURCE_TYPES.filter(source => !['coverage_manifest', 'school_billing'].includes(source)).flatMap(source =>
  INTAKE_LOCATIONS.map(location => ({ reporting_month: month, source_type: source, location,
    provider_id: 'not_applicable', district: 'not_applicable', coverage_status: 'not_applicable' })));
const manifestRows = (schools = [schoolRow()]) => [...otherManifestRows(), ...schools];
function table(source, records, extraFields = []) {
  const fields = [...INTAKE_REQUIREMENTS.find(requirement => requirement.id === source).fields, ...extraFields];
  return tableFromMatrix([fields, ...records.map(record => fields.map(field => record[field] ?? ''))], source);
}
const validateManifest = records => validateTable(table('coverage_manifest', records), 'coverage_manifest', month);
const failureText = review => review.checks.filter(check => !check.passed).map(check => check.message).join(' ');
const invoice = (extra = {}) => ({ reporting_month: month, currency: 'USD', district: 'synthetic-district',
  therapist_id: 'synthetic-provider', billing_basis: 'hours', billed_quantity: '2', contract_rate: '3',
  rate_effective_start: `${month}-01`, rate_effective_end: `${month}-30`, invoice_total: '6', report_total: '6', ...extra });
const schoolContext = () => ({ schoolScopeVersion: SCHOOL_SCOPE_VERSION, expectedDistricts: ['synthetic-district'],
  expectedSchoolProvidersByDistrict: { 'synthetic-district': ['synthetic-provider'] } });

test('school scope declares district/provider pairs once, independently of seven clinic locations', () => {
  const review = validateManifest(manifestRows());
  assert.equal(review.status, 'complete', failureText(review));
  assert.equal(review.school_scope_version, SCHOOL_SCOPE_VERSION);
  assert.deepEqual(new Set(review.covered_locations), new Set(INTAKE_LOCATIONS));
  assert(!review.covered_locations.includes('not_applicable'));
});

test('school scope permits multiple providers per district and the same provider in different districts', () => {
  const review = validateManifest(manifestRows([
    schoolRow(), schoolRow({ provider_id: 'synthetic-second-provider' }), schoolRow({ district: 'synthetic-second-district' }),
  ]));
  assert.equal(review.status, 'complete', failureText(review));
});

test('school manifest rejects every clinic attribution, including the formerly required seven-clinic expansion', () => {
  for (const location of INTAKE_LOCATIONS) {
    const review = validateManifest(manifestRows([schoolRow({ location })]));
    assert.equal(review.status, 'incomplete', location);
    assert.match(failureText(review), /school|not_applicable/i);
  }
  assert.equal(validateManifest(manifestRows(INTAKE_LOCATIONS.map(location => schoolRow({ location })))).status, 'incomplete');
});

test('school manifest rejects missing declaration, duplicate pairs and incomplete or invalid active identifiers', () => {
  for (const schools of [[], [schoolRow(), schoolRow()], [schoolRow({ provider_id: '' })],
    [schoolRow({ provider_id: 'not_applicable' })], [schoolRow({ district: '' })],
    [schoolRow({ district: 'not_applicable' })], [schoolRow({ location: '' })],
    [schoolRow({ location: 'unknown-location' })], [schoolRow({ coverage_status: 'unknown-status' })]]) {
    assert.equal(validateManifest(manifestRows(schools)).status, 'incomplete', JSON.stringify(schools));
  }
});

test('one explicit no-school-activity declaration is valid evidence and produces no financial metrics', () => {
  const noActivity = schoolRow({ coverage_status: 'not_applicable', provider_id: 'not_applicable', district: 'not_applicable' });
  const manifest = table('coverage_manifest', manifestRows([noActivity]));
  const review = validateTable(manifest, 'coverage_manifest', month);
  assert.equal(review.status, 'complete', failureText(review));
  assert.equal(review.school_scope_version, SCHOOL_SCOPE_VERSION);
  assert.deepEqual(normalizeMetrics(manifest, 'coverage_manifest', month, review), []);
  const unsupportedInvoice = validateTable(table('school_billing', [invoice()]), 'school_billing', month,
    { schoolScopeVersion: SCHOOL_SCOPE_VERSION, expectedDistricts: [], expectedSchoolProvidersByDistrict: {} });
  assert.equal(unsupportedInvoice.status, 'incomplete');
  assert.deepEqual(normalizeMetrics(table('school_billing', [invoice()]), 'school_billing', month, unsupportedInvoice), []);
});

test('no-school-activity cannot be mixed, repeated, or used to claim provider/district activity', () => {
  const noActivity = schoolRow({ coverage_status: 'not_applicable', provider_id: 'not_applicable', district: 'not_applicable' });
  for (const schools of [[noActivity, schoolRow()], [noActivity, noActivity],
    [{ ...noActivity, provider_id: 'synthetic-provider' }], [{ ...noActivity, district: 'synthetic-district' }]]) {
    assert.equal(validateManifest(manifestRows(schools)).status, 'incomplete');
  }
});

test('school exception does not relax clinic manifest locations, explicit coverage or mixed-scope checks', () => {
  const rows = manifestRows();
  for (const change of [
    data => data.filter(row => !(row.source_type === 'insurance_revenue' && row.location === 'Pool')),
    data => data.map((row, index) => index ? row : { ...row, location: 'not_applicable' }),
    data => [...data, { ...data[0], coverage_status: 'active', provider_id: 'synthetic-provider' }],
    data => [...data, data[0]],
  ]) assert.equal(validateManifest(change(structuredClone(rows))).status, 'incomplete');
});

test('clinic source validation still needs all clinic locations and matching providers, with no school policy prerequisite', () => {
  const rows = INTAKE_LOCATIONS.map(location => ({ reporting_month: month, location,
    program: 'synthetic-program', income: '1', report_total: '7' }));
  const context = { expectedProvidersBySource: { cash_programs: Object.fromEntries(
    INTAKE_LOCATIONS.map(location => [location, ['synthetic-program']])) } };
  const complete = validateTable(table('cash_programs', rows), 'cash_programs', month, context);
  assert.equal(complete.status, 'complete', failureText(complete));
  assert.equal(complete.school_scope_version, undefined);
  const missingLocation = rows.slice(1).map(row => ({ ...row, report_total: '6' }));
  assert.equal(validateTable(table('cash_programs', missingLocation), 'cash_programs', month, context).status, 'incomplete');
  const unapprovedProgram = rows.map((row, index) => index ? row : { ...row, program: 'undeclared-program' });
  assert.equal(validateTable(table('cash_programs', unapprovedProgram), 'cash_programs', month, context).status, 'incomplete');
});

test('current school district/provider review validates invoices without any clinic location', () => {
  const input = table('school_billing', [invoice()]);
  const review = validateTable(input, 'school_billing', month, schoolContext());
  assert.equal(review.status, 'complete', failureText(review));
  assert.equal(review.school_scope_version, SCHOOL_SCOPE_VERSION);
  assert.deepEqual(review.covered_locations, []);
  const rows = normalizeMetrics(input, 'school_billing', month, review);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].location, null);
  assert.equal(rows[0].measures.school_invoices, 600);
  assert.equal(rows[0].measures.school_hours, 20000);
});

test('legacy or unknown school scope cannot validate a new invoice using otherwise matching district/provider lists', () => {
  for (const version of [undefined, null, '', 'school-independent-v0', 'school-independent-v999']) {
    const context = { ...schoolContext(), schoolScopeVersion: version };
    const review = validateTable(table('school_billing', [invoice()]), 'school_billing', month, context);
    assert.equal(review.status, 'incomplete', String(version));
    assert.match(failureText(review), /school|scope|review/i);
  }
});

test('new school policy preserves district/provider matching and invoice reconciliation', () => {
  for (const extra of [{ district: 'undeclared-district' }, { therapist_id: 'undeclared-provider' },
    { invoice_total: '7', report_total: '7' }, { billed_quantity: '-2' },
    { rate_effective_start: `${month}-02` }, { currency: '' }]) {
    const review = validateTable(table('school_billing', [invoice(extra)]), 'school_billing', month, schoolContext());
    assert.equal(review.status, 'incomplete', JSON.stringify(extra));
  }
});

test('school invoice location columns cannot sneak clinic attribution through the parser or direct table validation', () => {
  const withColumn = table('school_billing', [invoice({ location: 'Cheshire' })], ['location']);
  assert.equal(validateTable(withColumn, 'school_billing', month, schoolContext()).status, 'incomplete');
  for (const location of ['Cheshire', 'Pool', 'not_applicable', 'unknown-location']) {
    const input = table('school_billing', [invoice()]);
    input.rows[0].location = location;
    assert.equal(validateTable(input, 'school_billing', month, schoolContext()).status, 'incomplete', location);
  }
});

const reviewFixture = (marker = SCHOOL_SCOPE_VERSION) => ({ validator_version: 'cheshire-intake-v1', status: 'complete',
  reported_month: month, missing_items: [], checks: REQUIRED_CHECKS.map(key => ({ key, passed: true, message: 'Synthetic check' })),
  row_count: 1, covered_locations: [], canonical_fields: [], ai_status: 'not_requested',
  ...(marker === undefined ? {} : { school_scope_version: marker }) });
function documents() {
  const document = (id, source, number) => ({ id, source_type: source, requested_month: `${month}-01`, reported_month: `${month}-01`,
    file_name: 'synthetic.csv', content_sha256: hash, status: 'complete', created_at: '2026-09-01T00:00:00Z',
    reviewed_at: '2026-09-02T00:00:00Z', review_revision: revision(number), review_token: revision(number),
    source_origin: 'portal_upload', storage_path: null, failure_message: null, validation: reviewFixture(),
    validation_dependencies: {}, validation_dependency_revisions: {} });
  const manifest = document('manifest', 'coverage_manifest', 1);
  const school = document('school', 'school_billing', 2);
  const clinic = document('clinic', 'cash_programs', 3);
  for (const dependent of [school, clinic]) {
    dependent.validation_dependencies.coverage_manifest = `${manifest.id}:${hash}`;
    dependent.validation_dependency_revisions.coverage_manifest = manifest.review_revision;
  }
  delete clinic.validation.school_scope_version;
  return [manifest, school, clinic];
}
const checklist = docs => Object.fromEntries(buildMonthlyChecklist(parseIntakeDocuments(docs), month, null).map(item => [item.id, item]));

test('school completion evidence requires exact policy marker while clinic completion is unchanged', () => {
  const parsed = parseIntakeDocuments(documents());
  assert(hasCompletionEvidence(parsed[1], month));
  for (const marker of [undefined, 'school-independent-v0', 'school-independent-v999']) {
    const school = structuredClone(parsed[1]);
    if (marker === undefined) delete school.validation.school_scope_version;
    else school.validation.school_scope_version = marker;
    assert.equal(hasCompletionEvidence(school, month), false);
  }
  assert(hasCompletionEvidence(parsed[2], month));
});

test('checklist school completion requires current own and supporting school policy, without globally invalidating clinics', () => {
  const base = documents();
  for (const kind of ['coverage_manifest', 'school_billing', 'cash_programs']) assert.equal(checklist(base)[kind].status, 'complete');
  for (const index of [0, 1]) {
    const legacy = structuredClone(base);
    delete legacy[index].validation.school_scope_version;
    const result = checklist(legacy);
    assert.equal(result.school_billing.status, 'incomplete');
    assert.equal(result.cash_programs.status, 'complete');
    assert.equal(result.coverage_manifest.status, 'complete');
    assert.match(result.school_billing.missing.join(' '), /school|scope|supporting|review/i);
  }
});

test('same-byte manifest re-review requires fresh school dependency evidence; new policy marker alone cannot hide staleness', () => {
  const docs = documents();
  docs[0].review_revision = revision(4);
  assert.equal(checklist(docs).school_billing.status, 'incomplete');
  docs[1].validation_dependency_revisions.coverage_manifest = docs[0].review_revision;
  assert.equal(checklist(docs).school_billing.status, 'complete');
  docs[0].content_sha256 = 'b'.repeat(64);
  assert.equal(checklist(docs).school_billing.status, 'incomplete');
});

test('legacy school normalization is blocked even when old complete check results look valid', () => {
  const input = table('school_billing', [invoice()]);
  for (const marker of [undefined, 'school-independent-v0', 'school-independent-v999']) {
    const review = reviewFixture();
    if (marker === undefined) delete review.school_scope_version;
    else review.school_scope_version = marker;
    assert.deepEqual(normalizeMetrics(input, 'school_billing', month, review), []);
  }
});

function metricState() {
  const docs = documents();
  const schoolRows = normalizeMetrics(table('school_billing', [invoice()]), 'school_billing', month, docs[1].validation);
  const cashRows = [{ source_row: 2, location: 'Cheshire', basis: 'program_reported_month', measures: { cash_program_income: 100 } }];
  return { documents: docs, overhead_revision: null, batches: [schoolRows, cashRows].map((rows, index) => {
    const document = docs[index + 1];
    return { document_id: document.id, content_sha256: hash, reporting_month: `${month}-01`, review_token: document.review_token,
      validator_version: 'cheshire-intake-v1', normalizer_version: NORMALIZER_VERSION,
      validation_dependencies: { ...document.validation_dependencies }, dependency_revisions: { coverage_manifest: docs[0].review_token }, rows };
  }) };
}
test('served school metrics require exact own and supporting policy and current dependency revision', () => {
  const state = metricState();
  assert.deepEqual(serveMetrics(state, month).sources.map(source => source.source_type).sort(), ['cash_programs', 'school_billing']);
  for (const change of [
    value => { delete value.documents[0].validation.school_scope_version; },
    value => { delete value.documents[1].validation.school_scope_version; },
    value => { value.documents[0].validation.school_scope_version = 'school-independent-v999'; },
    value => { value.documents[1].validation.school_scope_version = 'school-independent-v999'; },
  ]) {
    const mutated = structuredClone(state); change(mutated);
    const result = serveMetrics(mutated, month);
    assert.deepEqual(result.sources.map(source => source.source_type), ['cash_programs']);
    assert.equal(result.blocked.find(source => source.source_type === 'school_billing')?.source_type, 'school_billing');
  }
  const stale = structuredClone(state);
  stale.documents[0].review_token = revision(4);
  assert.equal(serveMetrics(stale, month).sources.length, 0);
  stale.batches[0].dependency_revisions.coverage_manifest = stale.documents[0].review_token;
  assert.deepEqual(serveMetrics(stale, month).sources.map(source => source.source_type), ['school_billing']);
});

test('school metrics stay independent of clinic-filtered views and never create a location attribution or profit', () => {
  const state = metricState();
  const all = serveMetrics(state, month);
  const school = all.sources.find(source => source.source_type === 'school_billing');
  assert.deepEqual(school.location_coverage, []);
  assert(school.metrics.every(metric => metric.location === null && metric.source_locations.length === 0));
  const filtered = serveMetrics(state, month, 'Cheshire');
  assert.deepEqual(filtered.sources.map(source => source.source_type), ['cash_programs']);
  assert.equal(filtered.profit.available, false);
});
