import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePayrollSourceAudit, readPayrollSourceSummary, formatPayrollSourceAmount } from '../src/cheshire/payrollSourceAudit.ts';
import { parseIntakeDocuments, buildMonthlyChecklist } from '../src/cheshire/intake.ts';
import { payrollAuditFixture, payrollDocumentFixture } from './helpers/payroll-audit-fixture.mjs';

test('a trailing-twelve selection retains prior-year payroll months without carrying excluded months', () => {
  const months = Array.from({ length: 12 }, (_, i) => i === 11 ? '2027-01' : `2026-${String(i + 2).padStart(2, '0')}`);
  const source = readPayrollSourceSummary([payrollDocumentFixture()], 'ytd', '2027-01', 'all', months);
  assert.equal(source.grossHundredths, 50000);
  assert.deepEqual(source.months.map(row => row.month), ['2026-02', '2026-03']);
  assert.equal(source.requestedMonthCount, 12);
  assert.equal(readPayrollSourceSummary([payrollDocumentFixture()], 'ytd', '2027-01', 'Pool', months), null);
  assert.throws(() => readPayrollSourceSummary([payrollDocumentFixture()], 'ytd', '2027-01', 'all', ['2026-02']), /Invalid selected/);
});

test('payroll audit reconciles exact hundredths and returns aggregate fields only', () => {
  const input = payrollAuditFixture();
  input.employee_rows = [{ name: 'SYNTHETIC PRIVATE NAME', direct_deposit: 'SYNTHETIC PRIVATE FIELD' }];
  const parsed = parsePayrollSourceAudit(input, 'a'.repeat(64));
  assert.equal(parsed.grossHundredths, 60000);
  assert.equal(parsed.currency, null);
  assert.equal(formatPayrollSourceAmount(parsed.grossHundredths), '$600.00');
  assert.ok(!JSON.stringify(parsed).includes('SYNTHETIC PRIVATE'));
  assert.equal(formatPayrollSourceAmount(Number.MAX_SAFE_INTEGER), '$90,071,992,547,409.91');
  assert.equal(formatPayrollSourceAmount(1), '$0.01');
  assert.equal(formatPayrollSourceAmount(0), '$0.00');
  assert.throws(() => formatPayrollSourceAmount(Number.MAX_SAFE_INTEGER + 1));
});
test('malformed, mismatched or unreconciled payroll data fails closed', () => {
  const mutations = [
    x => { x.version = 'unknown'; }, x => { x.provenance.sha256 = 'b'.repeat(64); },
    x => { x.provenance.currency = '$'; }, x => { delete x.provenance.currency; },
    x => { x.provenance.actual_pay_dates[0] = '2026-02-30'; },
    x => { x.provenance.actual_pay_dates.reverse(); },
    x => { x.pay_date_month_summaries['2026-01'].gross_pay = '100.001'; },
    x => { x.pay_date_month_summaries['2026-01'].gross_pay = '1e2'; },
    x => { x.pay_date_month_summaries['2026-01'].gross_pay = '900719925474099.99'; },
    x => { x.pay_date_month_summaries['2026-01'].gross_pay = '-100.00'; },
    x => { x.pay_date_month_summaries['2026-01'].rows = 3; },
    x => { x.pay_date_month_summaries['2026-01'].staff_ids = 3; },
    x => { x.staff_count = 6; for (const row of Object.values(x.pay_date_month_summaries)) row.staff_ids = 1; },
    x => { x.reconciliation.gross_pay.source_control = '601.00'; },
    x => { x.reconciliation.gross_pay.difference = '1.00'; },
    x => { x.reconciliation.gross_pay.blank_rows = 1; },
    x => { x.pay_date_month_summaries['2026-04'] = x.pay_date_month_summaries['2026-01']; },
  ];
  for (const mutate of mutations) { const input = payrollAuditFixture(); mutate(input); assert.throws(() => parsePayrollSourceAudit(input, 'a'.repeat(64))); }
});
test('payroll source selection follows period and all-staff scope without treating absent months as zero', () => {
  const doc = payrollDocumentFixture();
  assert.equal(readPayrollSourceSummary([doc], 'mtd', '2026-02', 'all').grossHundredths, 20000);
  assert.equal(readPayrollSourceSummary([doc], 'ytd', '2026-02', 'all').grossHundredths, 30000);
  const partial = readPayrollSourceSummary([doc], 'ytd', '2026-05', 'all');
  assert.equal(partial.grossHundredths, 60000); assert.equal(partial.months.length, 3); assert.equal(partial.requestedMonthCount, 5);
  assert.equal(readPayrollSourceSummary([doc], 'mtd', '2026-04', 'all'), null);
  assert.equal(readPayrollSourceSummary([doc], 'ytd', '2027-03', 'all'), null);
  assert.equal(readPayrollSourceSummary([doc], 'ytd', '2026-03', 'Pool'), null);
  assert.equal(readPayrollSourceSummary([doc], 'other', '2026-03', 'all'), null);
});
test('only the reviewed existing-source envelope is eligible; duplicate and superseded sources cannot be double-counted', () => {
  const doc = payrollDocumentFixture();
  for (const change of [{ status: 'complete' }, { source_type: 'insurance_revenue' }, { source_origin: 'portal_upload' }, { requested_month: '2026-03' }, { reported_month: '2026-03' }, { storage_path: 'private/file' }, { validation: { ...doc.validation, status: 'complete' } }]) {
    assert.equal(readPayrollSourceSummary([{ ...doc, ...change }], 'ytd', '2026-03', 'all'), null);
  }
  assert.equal(readPayrollSourceSummary([doc, { ...doc, id: 'same-bytes' }], 'ytd', '2026-03', 'all').grossHundredths, 60000);
  assert.equal(readPayrollSourceSummary([doc, { ...doc, id: 'replacement', supersedes_id: doc.id, validation: null }], 'ytd', '2026-03', 'all'), null);
  const conflict = structuredClone(doc); conflict.id = 'other-export'; conflict.content_sha256 = 'b'.repeat(64); conflict.validation.payroll_source_audit.provenance.sha256 = conflict.content_sha256;
  assert.equal(readPayrollSourceSummary([doc, conflict], 'ytd', '2026-03', 'all'), null);
  const changed = structuredClone(doc); changed.id = 'conflicting-audit'; changed.validation.payroll_source_audit.provenance.currency = 'USD';
  assert.equal(readPayrollSourceSummary([doc, changed], 'ytd', '2026-03', 'all'), null);
});
test('a zero source amount stays zero while the payroll checklist remains incomplete', () => {
  const doc = payrollDocumentFixture(); const audit = doc.validation.payroll_source_audit;
  for (const row of Object.values(audit.pay_date_month_summaries)) row.gross_pay = '0.00';
  audit.reconciliation.gross_pay.detail_sum = '0.00'; audit.reconciliation.gross_pay.source_control = '0.00';
  assert.equal(readPayrollSourceSummary([doc], 'ytd', '2026-03', 'all').grossHundredths, 0);
  const parsed = parseIntakeDocuments([doc]);
  assert.equal(buildMonthlyChecklist(parsed, '2026-03', null).find(row => row.id === 'payroll').status, 'missing');
});
