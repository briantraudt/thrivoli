// Mocked service requests only. Synthetic records, no network or production writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { handleIntake, sha256 } from '../supabase/functions/_shared/cheshire-intake-service.ts';
import { INTAKE_REQUIREMENTS, INTAKE_LOCATIONS, SOURCE_TYPES, SCHOOL_SCOPE_VERSION } from '../supabase/functions/_shared/cheshire-intake.ts';

const USER = '11111111-1111-4111-8111-111111111111';
const MANIFEST = '22222222-2222-4222-8222-222222222222';
const SCHOOL = '33333333-3333-4333-8333-333333333333';
const REPLACEMENT = '44444444-4444-4444-8444-444444444444';
const month = '2026-09';
const env = { SUPABASE_URL: 'https://synthetic.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-only-secret' };
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const schoolScope = (extra = {}) => ({ reporting_month: month, source_type: 'school_billing', location: 'not_applicable',
  provider_id: 'synthetic-private-provider', district: 'synthetic-private-district', coverage_status: 'active', ...extra });
const manifestRows = (schools = [schoolScope()]) => [...SOURCE_TYPES.filter(source => !['coverage_manifest', 'school_billing'].includes(source))
  .flatMap(source => INTAKE_LOCATIONS.map(location => ({ reporting_month: month, source_type: source, location,
    provider_id: 'not_applicable', district: 'not_applicable', coverage_status: 'not_applicable' }))), ...schools];
const invoice = () => ({ reporting_month: month, currency: 'USD', district: 'synthetic-private-district',
  therapist_id: 'synthetic-private-provider', billing_basis: 'hours', billed_quantity: '2', contract_rate: '3',
  rate_effective_start: `${month}-01`, rate_effective_end: `${month}-30`, invoice_total: '6', report_total: '6' });

async function source(sourceType, rows) {
  const fields = INTAKE_REQUIREMENTS.find(requirement => requirement.id === sourceType).fields;
  const csv = [fields.join(','), ...rows.map(row => fields.map(field => row[field] ?? '').join(','))].join('\n');
  const bytes = new TextEncoder().encode(csv);
  const id = sourceType === 'coverage_manifest' ? MANIFEST : SCHOOL;
  return { bytes, row: { id, source_type: sourceType, requested_month: `${month}-01`, reported_month: null,
    uploaded_by: USER, file_name: 'synthetic.csv', content_sha256: await sha256(bytes), byte_size: bytes.length,
    mime_type: 'text/csv', storage_path: `${USER}/${id}/source.csv`, source_origin: 'portal_upload', status: 'uploading',
    validation: null, validation_scope: null, validation_dependencies: {}, validation_dependency_revisions: {},
    review_revision: null, review_started_at: null } };
}

async function review(fixture, supporting = [], existing = {}) {
  let row = { ...structuredClone(fixture.row), ...structuredClone(existing) };
  const calls = [];
  const fetcher = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    assert.equal(url.origin, env.SUPABASE_URL, 'Only mocked private application requests are permitted');
    const method = init.method ?? 'GET';
    const payload = init.body ? JSON.parse(init.body) : null;
    calls.push({ path: url.pathname, query: url.searchParams, method, payload });
    if (url.pathname === '/auth/v1/user') return reply({ id: USER, email: 'synthetic@example.test', email_confirmed_at: '2026-01-01' });
    if (url.pathname === '/rest/v1/cheshire_finance_reader') return reply([{ user_id: USER }]);
    if (url.pathname === '/rest/v1/cheshire_portal_member') return reply([{ email: 'synthetic@example.test' }]);
    if (url.pathname === '/rest/v1/cheshire_intake_settings') return reply([{ ai_enabled: false, ai_monthly_limit: 5 }]);
    if (url.pathname.startsWith('/storage/v1/object/')) return new Response(fixture.bytes);
    if (url.pathname === '/rest/v1/cheshire_intake_document') {
      if (method === 'GET') return reply(url.searchParams.get('source_type')?.startsWith('in.') ? supporting : [row]);
      assert.equal(method, 'PATCH');
      const statusFilter = url.searchParams.get('status');
      if (statusFilter && statusFilter !== `eq.${row.status}`) return reply([]);
      const tokenFilter = url.searchParams.get('review_token');
      if (tokenFilter && tokenFilter !== `eq.${row.review_token}`) return reply([]);
      const revisionFilter = url.searchParams.get('review_revision');
      if (revisionFilter && revisionFilter !== (row.review_revision ? `eq.${row.review_revision}` : 'is.null')) return reply([]);
      row = { ...row, ...payload };
      return reply([row]);
    }
    if (url.pathname === '/rest/v1/rpc/finalize_cheshire_intake_review') {
      assert.equal(method, 'POST');
      assert.equal(payload.p_document_id, row.id);
      assert.equal(payload.p_content_sha256, row.content_sha256);
      assert.equal(payload.p_review_token, row.review_token);
      assert.equal(row.status, 'reviewing');
      row = { ...row, status: payload.p_validation.status,
        reported_month: payload.p_validation.reported_month ? `${payload.p_validation.reported_month}-01` : null,
        validation: payload.p_validation, validation_scope: payload.p_scope, validation_dependencies: payload.p_dependencies,
        validation_dependency_revisions: payload.p_dependency_revisions, review_revision: payload.p_review_token };
      return reply([row]);
    }
    throw new Error(`Unexpected mock route: ${method} ${url.pathname}`);
  };
  const response = await handleIntake(new Request('https://edge.invalid', { method: 'POST', headers: {
    Authorization: 'Bearer synthetic-token', 'Content-Type': 'application/json',
  }, body: JSON.stringify({ operation: 'review', document_id: row.id, expected_sha256: row.content_sha256 }) }), env, fetcher);
  const data = await response.json();
  assert.equal(response.status, 200, JSON.stringify(data));
  const finalizations = calls.filter(call => call.path === '/rest/v1/rpc/finalize_cheshire_intake_review');
  assert.equal(finalizations.length, 1);
  return { row, data, calls, saved: finalizations[0].payload };
}
const completedManifest = async (rows = manifestRows()) => review(await source('coverage_manifest', rows));

test('service saves school district/provider coverage independently from clinic location rosters', async () => {
  const result = await completedManifest(manifestRows([schoolScope(), schoolScope({ provider_id: 'synthetic-second-provider' }),
    schoolScope({ district: 'synthetic-second-district' })]));
  assert.equal(result.row.status, 'complete');
  assert.equal(result.saved.p_validation.school_scope_version, SCHOOL_SCOPE_VERSION);
  assert.deepEqual(result.saved.p_scope.expectedDistricts, ['synthetic-private-district', 'synthetic-second-district']);
  assert.deepEqual(result.saved.p_scope.expectedSchoolProvidersByDistrict, {
    'synthetic-private-district': ['synthetic-private-provider', 'synthetic-second-provider'],
    'synthetic-second-district': ['synthetic-private-provider'],
  });
  assert.equal(Object.hasOwn(result.saved.p_scope.expectedProvidersBySource, 'school_billing'), false);
  for (const scopes of Object.values(result.saved.p_scope.expectedProvidersBySource)) {
    assert.deepEqual(new Set(Object.keys(scopes)), new Set(INTAKE_LOCATIONS));
    assert(Object.values(scopes).every(providers => providers.length === 0));
  }
  assert.deepEqual(result.saved.p_rows, []);
  assert.deepEqual(result.saved.p_dependencies, {});
  assert.deepEqual(result.saved.p_dependency_revisions, {});
});

test('safe review response exposes the school policy marker and revision but keeps provider scope and review token private', async () => {
  const result = await completedManifest();
  const document = result.data.document;
  assert.equal(document.validation.school_scope_version, SCHOOL_SCOPE_VERSION);
  assert.equal(document.review_revision, result.row.review_revision);
  for (const field of ['validation_scope', 'review_token', 'uploaded_by']) assert.equal(Object.hasOwn(document, field), false);
  for (const identifier of ['synthetic-private-provider', 'synthetic-private-district']) assert(!JSON.stringify(document).includes(identifier));
  assert.equal(result.row.validation_scope.expectedDistricts.length, 1);
});

test('current marked manifest authorizes school invoice review and exact dependency revisions are retained', async () => {
  const manifest = await completedManifest();
  const result = await review(await source('school_billing', [invoice()]), [manifest.row]);
  assert.equal(result.row.status, 'complete', JSON.stringify(result.row.validation.missing_items));
  assert.equal(result.saved.p_validation.school_scope_version, SCHOOL_SCOPE_VERSION);
  assert.deepEqual(result.saved.p_dependencies, { coverage_manifest: `${manifest.row.id}:${manifest.row.content_sha256}` });
  assert.deepEqual(result.saved.p_dependency_revisions, { coverage_manifest: manifest.row.review_token });
  assert.deepEqual(result.data.document.validation_dependency_revisions, { coverage_manifest: manifest.row.review_revision });
  assert.equal(result.saved.p_scope, null);
  assert.equal(result.saved.p_rows.length, 1);
  assert.equal(result.saved.p_rows[0].location, null);
  assert.deepEqual(result.saved.p_rows[0].measures, { school_invoices: 600, school_hours: 20000 });
  assert(!JSON.stringify(result.saved.p_rows).includes('synthetic-private-provider'));
  assert(!JSON.stringify(result.saved.p_rows).includes('synthetic-private-district'));
});

test('unmarked and unknown-policy manifests cannot authorize school invoices or normalized financial rows', async () => {
  const manifest = await completedManifest();
  const fixture = await source('school_billing', [invoice()]);
  for (const marker of [undefined, 'school-independent-v0', 'school-independent-v999']) {
    const legacy = structuredClone(manifest.row);
    if (marker === undefined) delete legacy.validation.school_scope_version;
    else legacy.validation.school_scope_version = marker;
    const result = await review(fixture, [legacy]);
    assert.equal(result.row.status, 'incomplete', String(marker));
    assert.match(result.row.validation.missing_items.join(' '), /school|scope|review/i);
    assert.deepEqual(result.saved.p_rows, []);
    assert.equal(result.saved.p_scope, null);
  }
});

test('explicit no-school-activity manifest is valid but cannot authorize an invoice or fabricate zero revenue', async () => {
  const manifest = await completedManifest(manifestRows([schoolScope({ provider_id: 'not_applicable', district: 'not_applicable', coverage_status: 'not_applicable' })]));
  assert.equal(manifest.row.status, 'complete');
  assert.equal(manifest.row.validation.school_scope_version, SCHOOL_SCOPE_VERSION);
  assert.deepEqual(manifest.saved.p_scope.expectedDistricts, []);
  assert.deepEqual(manifest.saved.p_scope.expectedSchoolProvidersByDistrict, {});
  assert.equal(Object.hasOwn(manifest.saved.p_scope.expectedProvidersBySource, 'school_billing'), false);
  assert.deepEqual(manifest.saved.p_rows, []);
  const result = await review(await source('school_billing', [invoice()]), [manifest.row]);
  assert.equal(result.row.status, 'incomplete');
  assert.deepEqual(result.saved.p_rows, []);
});

test('school re-review uses the current same-byte supporting review revision instead of the saved old dependency', async () => {
  const fixture = await source('coverage_manifest', manifestRows());
  const previous = await review(fixture);
  const refreshed = await review(fixture, [], previous.row);
  assert.equal(previous.row.content_sha256, refreshed.row.content_sha256);
  assert.notEqual(previous.row.review_revision, refreshed.row.review_revision);
  const invoiceFixture = await source('school_billing', [invoice()]);
  const oldInvoice = await review(invoiceFixture, [previous.row]);
  const updated = await review(invoiceFixture, [refreshed.row], oldInvoice.row);
  assert.equal(updated.row.status, 'complete');
  assert.equal(updated.saved.p_dependency_revisions.coverage_manifest, refreshed.row.review_token);
  assert.notEqual(updated.saved.p_dependency_revisions.coverage_manifest, previous.row.review_token);
});

test('a replacement manifest is the only active school authority, while ambiguity or unfinished replacement fails closed', async () => {
  const prior = (await completedManifest()).row;
  const replacement = { ...structuredClone(prior), id: REPLACEMENT, supersedes_id: prior.id,
    review_token: '55555555-5555-4555-8555-555555555555', review_revision: '55555555-5555-4555-8555-555555555555' };
  const fixture = await source('school_billing', [invoice()]);
  const result = await review(fixture, [prior, replacement]);
  assert.equal(result.row.status, 'complete');
  assert.equal(result.saved.p_dependencies.coverage_manifest, `${replacement.id}:${replacement.content_sha256}`);
  assert.equal(result.saved.p_dependency_revisions.coverage_manifest, replacement.review_token);
  const ambiguous = structuredClone(replacement);
  delete ambiguous.supersedes_id;
  for (const supports of [[prior, ambiguous], [prior, { ...replacement, status: 'reviewing' }],
    [prior, { ...replacement, status: 'error' }]]) {
    const failed = await review(fixture, supports);
    assert.equal(failed.row.status, 'incomplete');
    assert.deepEqual(failed.saved.p_rows, []);
    assert.deepEqual(failed.saved.p_dependencies, {});
  }
});
