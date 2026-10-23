import test from 'node:test';
import assert from 'node:assert/strict';
import { handleIntake, sha256 } from '../supabase/functions/_shared/cheshire-intake-service.ts';

const USER = '11111111-1111-1111-1111-111111111111';
const DOC = '22222222-2222-2222-2222-222222222222';
const env = { SUPABASE_URL: 'https://synthetic.invalid', SUPABASE_SERVICE_ROLE_KEY: 'mock-service-secret' };

function callsOf() {
  const calls = [];
  const fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = init.method ?? 'GET';
    let payload = null;
    if (typeof init.body === 'string') payload = JSON.parse(init.body);
    else if (init.body instanceof Uint8Array) payload = { bytes: init.body.byteLength };
    calls.push({ url: url.toString(), method, payload });
    if (url.pathname === '/auth/v1/user') return Response.json({ id: USER, email: 'synthetic@example.test', email_confirmed_at: '2026-01-01' });
    if (url.pathname === '/rest/v1/cheshire_finance_reader') return Response.json([{ user_id: USER }]);
    if (url.pathname === '/rest/v1/cheshire_portal_member') return Response.json([{ email: 'synthetic@example.test' }]);
    if (url.pathname === '/rest/v1/cheshire_intake_document') {
      if (method === 'GET') return Response.json([]);
      if (method === 'POST') return Response.json([{ id: DOC, ...payload, status: 'uploading' }]);
      if (method === 'DELETE') return Response.json([]);
      return Response.json([{ id: DOC, ...payload }]);
    }
    if (url.pathname.startsWith('/storage/')) return Response.json({ ok: true });
    throw new Error('Unexpected ' + method + ' ' + url.pathname);
  };
  return { calls, fetch };
}

async function ingest(bytes, filename, mime, sourceType = 'cash_programs') {
  const hash = await sha256(bytes);
  const { calls, fetch } = callsOf();
  const response = await handleIntake(new Request('https://edge.invalid/ingest', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer mock-token',
      'Content-Type': mime,
      'x-cheshire-privacy-ingest': '1',
      'x-file-name': encodeURIComponent(filename),
      'x-source-type': sourceType,
      'x-requested-month': '2026-10',
      'x-content-sha256': hash,
      'x-mime-type': mime,
    },
    body: bytes,
  }), env, fetch);
  return { response, data: await response.json(), calls };
}

test('a file with a patient column is refused before any document or storage write', async () => {
  const bytes = new TextEncoder().encode('Client Name,Amount\nJane Doe,10\n');
  const { response, data, calls } = await ingest(bytes, 'patients.csv', 'text/csv');
  assert.equal(response.status, 422);
  assert.equal(data.code, 'patient_data_rejected');
  assert.match(data.error, /was not saved/);
  assert.doesNotMatch(data.error, /Jane Doe/);
  assert.equal(calls.some(call => call.url.includes('cheshire_intake_document') || call.url.includes('/storage/')), false);
});

test('a clean spreadsheet is stored only after the privacy screen passes', async () => {
  const bytes = new TextEncoder().encode('location,program,income\nCheshire,Swim,10\n');
  const { response, data, calls } = await ingest(bytes, 'totals.csv', 'text/csv');
  assert.equal(response.status, 200);
  assert.equal(data.upload_required, false);
  const document = calls.findIndex(call => call.method === 'POST' && call.url.includes('cheshire_intake_document'));
  const storage = calls.findIndex(call => call.method === 'POST' && call.url.includes('/storage/'));
  assert.ok(document >= 0 && storage > document);
  assert.equal(calls[storage].payload.bytes, bytes.byteLength);
});

test('a PDF is not stored because its contents cannot be checked', async () => {
  const bytes = new TextEncoder().encode('%PDF-1.4 synthetic');
  const { response, data, calls } = await ingest(bytes, 'report.pdf', 'application/pdf');
  assert.equal(response.status, 400);
  assert.match(data.error, /not accepted|could not be checked|CSV or Excel/i);
  assert.equal(calls.some(call => call.url.includes('/storage/') || (call.method === 'POST' && call.url.includes('cheshire_intake_document'))), false);
});

test('review deletes a stored file when a later check finds patient details', async () => {
  const text = 'Notes,Amount\nJane Doe 03/14/2017 F84.0,12\n';
  const bytes = new TextEncoder().encode(text);
  const hash = await sha256(bytes);
  const row = {
    id: DOC, source_type: 'cash_programs', requested_month: '2026-10-01', reported_month: null,
    uploaded_by: USER, file_name: 'notes.csv', content_sha256: hash, byte_size: bytes.length,
    mime_type: 'text/csv', storage_path: `${USER}/${DOC}/source.csv`, source_origin: 'portal_upload',
    status: 'uploading', validation: null, validation_scope: null, validation_dependencies: {}, review_started_at: null,
  };
  const calls = [];
  const fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = init.method ?? 'GET';
    const payload = typeof init.body === 'string' ? JSON.parse(init.body) : null;
    calls.push({ url: url.pathname, method, payload });
    if (url.pathname === '/auth/v1/user') return Response.json({ id: USER, email: 'synthetic@example.test', email_confirmed_at: '2026-01-01' });
    if (url.pathname === '/rest/v1/cheshire_finance_reader') return Response.json([{ user_id: USER }]);
    if (url.pathname === '/rest/v1/cheshire_portal_member') return Response.json([{ email: 'synthetic@example.test' }]);
    if (url.pathname === '/rest/v1/cheshire_intake_document' && method === 'GET') return Response.json([row]);
    if (url.pathname === '/rest/v1/cheshire_intake_settings') return Response.json([{ ai_enabled: false, ai_monthly_limit: 5 }]);
    if (url.pathname.startsWith('/storage/') && method === 'GET') return new Response(bytes);
    if (url.pathname.startsWith('/storage/') && method === 'DELETE') return Response.json({ ok: true });
    if (url.pathname === '/rest/v1/cheshire_intake_document' && method === 'PATCH') return Response.json([{ ...row, ...payload }]);
    if (url.pathname.includes('finalize_cheshire_intake_review')) return Response.json([]);
    throw new Error('Unexpected ' + method + ' ' + url.pathname);
  };
  const response = await handleIntake(new Request('https://edge.invalid/review', {
    method: 'POST',
    headers: { Authorization: 'Bearer mock-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation: 'review', document_id: DOC, expected_sha256: hash }),
  }), env, fetch);
  const data = await response.json();
  assert.equal(response.status, 422);
  assert.match(data.error, /was not saved/);
  assert.doesNotMatch(JSON.stringify(data), /Jane Doe|F84\.0|03\/14\/2017/);
  const removed = calls.findIndex(call => call.method === 'DELETE' && call.url.startsWith('/storage/'));
  const patched = calls.find(call => call.method === 'PATCH');
  assert.ok(removed >= 0);
  assert.equal(patched.payload.status, 'quarantined');
  assert.equal(patched.payload.storage_path, null);
  assert.doesNotMatch(JSON.stringify(patched.payload.validation), /Jane Doe|F84\.0/);
  assert.equal(calls.some(call => call.url.includes('finalize_cheshire_intake_review')), false);
});
