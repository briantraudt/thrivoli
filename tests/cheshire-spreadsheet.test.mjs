import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProfitabilitySheet } from '../src/cheshire/profitabilitySheet.ts';
import { LOCATIONS, CATEGORIES, parseFinanceSnapshot } from '../src/cheshire/finance.ts';
import { METRICS } from '../supabase/functions/_shared/cheshire-metrics.ts';
const snapshot = (amount = null) => parseFinanceSnapshot({ source_name: 'Synthetic workbook', cadence: 'monthly', effective_month: null, imported_at: '2026-10-01T12:00:00Z', cost_basis: 'fixed_monthly_baseline', basis_confirmed_at: '2026-10-01T12:00:00Z', basis_note: 'Synthetic owner confirmation', revision_id: 'synthetic-revision', overhead_rows: LOCATIONS.flatMap((location, i) => CATEGORIES.map((category, j) => ({ location, category, sourceCell: String.fromCharCode(68 + i) + (j + 5), amount }))) });
const row = (sheet, id) => sheet.flatMap(section => section.rows).find(item => item.id === id);
const response = (scope, key, value, source_type = 'cash_programs', basis = 'program_reported_month') => ({ month: '2026-10', location: scope, sources: [{ source_type, document_id: 'synthetic-doc', content_sha256: 'a'.repeat(64), validator_version: 'cheshire-intake-v1', normalizer_version: 'cheshire-metrics-v1', metrics: [{ key, ...METRICS[key], value, basis, location: scope === 'all' ? null : scope, source_locations: scope === 'all' ? [] : [scope], source_rows: 1 }] }], blocked: [], profit: { available: false, reason: 'Unreconciled' }, accounting_request: 'Confirm basis' });
test('every missing source is unknown, source zero survives, partial company subtotals are explicit', () => {
  const blank = buildProfitabilitySheet(snapshot(), {});
  assert.match(row(buildProfitabilitySheet(null, {}), 'known-overhead').cells.all.note, /140 blank cells/);
  for (const item of blank.flatMap(section => section.rows)) for (const cell of Object.values(item.cells)) assert.equal(cell.value, null);
  const source = snapshot(); source.rows[0].amount = '0'; source.rows[20].amount = '123.45';
  const sheet = buildProfitabilitySheet(source, {}); const rent = row(sheet, 'overhead-Rent');
  assert.equal(rent.cells.Cheshire.value, 0); assert.equal(rent.cells.Cromwell.value, 12345); assert.equal(rent.cells.Guilford.value, null); assert.equal(rent.cells.all.value, 12345); assert.equal(rent.cells.all.coverageLabel, '2/7 known · partial'); assert.match(rent.cells.all.note, /2\/7.*Partial/); assert.match(rent.cells.Cheshire.source, /Cheshire D5/);
  assert.equal(row(sheet, 'known-overhead').cells.all.value, 12345); assert.match(row(sheet, 'known-overhead').cells.all.note, /138 blank cells/);
});
test('company payroll and school figures are never allocated, missing locations are not zero', () => {
  const school = response('all', 'school_invoices', 920000, 'school_billing', 'invoice_reported_month');
  const payroll = response('all', 'loaded_payroll', 510000, 'payroll', 'payroll_reported_month');
  const sheet = buildProfitabilitySheet(snapshot('100'), { all: { ...school, sources: [...school.sources, ...payroll.sources] } });
  assert.equal(row(sheet, 'schools').cells.all.value, 920000); assert.equal(row(sheet, 'payroll').cells.all.value, 510000);
  for (const scope of LOCATIONS) { assert.equal(row(sheet, 'schools').cells[scope].value, null); assert.equal(row(sheet, 'payroll').cells[scope].value, null); assert.equal(row(sheet, 'labor-location').cells[scope].value, null); }
  assert.equal(row(sheet, 'profit').cells.all.value, null); assert.equal(row(sheet, 'cost-total').cells.all.value, null);
});
test('validated location and source provenance are retained with explicit source zero', () => {
  const sheet = buildProfitabilitySheet(null, { Cheshire: response('Cheshire', 'cash_program_income', 0), all: response('all', 'cash_program_income', 0) });
  assert.equal(row(sheet, 'programs').cells.Cheshire.value, 0); assert.equal(row(sheet, 'programs').cells.Orange.value, null); assert.match(row(sheet, 'programs').cells.Cheshire.source, /synthetic-doc.*SHA-256/); assert.match(row(sheet, 'programs').cells.Cheshire.note, /receipt timing unconfirmed/);
});
test('unlike insurance bases and baseline overlap never become total revenue or costs', () => {
  const data = response('all', 'insurance_payments', 100, 'insurance_revenue', 'payment_date'); data.sources[0].metrics.push({ ...data.sources[0].metrics[0], value: 250, basis: 'service_date' });
  const sheet = buildProfitabilitySheet(snapshot('10'), { all: data });
  assert.equal(row(sheet, 'insurance-payments').cells.all.value, 100); assert.equal(row(sheet, 'insurance-service').cells.all.value, 250);
  for (const id of ['revenue-total', 'cost-total', 'profit', 'margin']) assert.equal(row(sheet, id).cells.all.value, null);
  assert.match(row(sheet, 'monthly-overhead').detail, /not added/); assert.match(row(sheet, 'operating-overlap').detail, /never add twice/);
});
test('live map cost categories remain unvalued and deduplicated without losing service scope', () => {
  const map = [{ category: 'labor', value: 'Payroll taxes', segment_index: 0, position: 2 }, { category: 'labor', value: 'Payroll taxes', segment_index: 1, position: 4 }, { category: 'overhead', value: 'Executive leadership', segment_index: null, position: 0 }];
  const sheet = buildProfitabilitySheet(snapshot('10'), {}, map); const labor = sheet.find(s => s.id === 'labor').rows.filter(r => r.id.startsWith('map-'));
  assert.equal(labor.length, 1); assert.match(labor[0].detail, /Clinics · Schools/); assert.equal(labor[0].cells.all.value, null); assert.equal(labor[0].cells.Cheshire.sourceType, 'payroll');
  assert.equal(row(sheet, 'map-overhead-0').cells.Orange.sourceType, 'operating_expenses');
});

test('accepted report-as-of insurance and patient payments retain separate rows, source zeros and provenance', () => {
  const data = response('all', 'insurance_payments', 45000, 'insurance_revenue', 'report_as_of');
  data.sources[0].metrics.push({ ...data.sources[0].metrics[0], key: 'patient_payments', ...METRICS.patient_payments, value: 0 });
  const sheet = buildProfitabilitySheet(null, { all: data });
  assert.equal(row(sheet, 'insurance-as-of').cells.all.value, 45000);
  assert.equal(row(sheet, 'patient-as-of').cells.all.value, 0);
  assert.match(row(sheet, 'insurance-as-of').cells.all.note, /Report-as-of basis/);
  assert.match(row(sheet, 'insurance-as-of').cells.all.source, /synthetic-doc/);
  assert.equal(row(sheet, 'insurance-payments').cells.all.value, null);
  assert.equal(row(sheet, 'insurance-as-of').cells.Cheshire.value, null);
  assert.equal(row(sheet, 'revenue-total').cells.all.value, null);
  assert.equal(row(sheet, 'profit').cells.all.value, null);
  assert.equal(row(buildProfitabilitySheet(null, {}), 'insurance-as-of'), undefined);
});
