import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonths, buildExecutive, collectMetricCents, comparisonText, comparisonWindows, executiveMonths, executiveSearch,
  overheadCategoryBreakdown, parseExecutiveSearch, readTherapistIds, therapistId,
} from '../src/cheshire/executiveView.ts';

const blank = {
  therapist: 'all', clinic: null, schools: null, cash: null, overhead: null, payroll: null, overheadCategories: null,
  priorClinic: null, priorSchools: null, priorCash: null, priorOverhead: null, priorOverheadMonths: null, priorPayroll: null, priorLabel: 'prior period',
};

test('period windows and comparisons follow the selected month, quarter, year, and trailing twelve', () => {
  assert.deepEqual(executiveMonths('month', '2026-10'), ['2026-10']);
  assert.deepEqual(comparisonWindows('month', '2026-10'), { current: ['2026-10'], priorPeriod: ['2026-09'], priorYear: ['2025-10'] });
  assert.deepEqual(executiveMonths('quarter', '2026-10'), ['2026-10']);
  assert.deepEqual(comparisonWindows('quarter', '2026-10').priorPeriod, ['2026-07']);
  assert.deepEqual(executiveMonths('quarter', '2026-08'), ['2026-07', '2026-08']);
  assert.deepEqual(comparisonWindows('quarter', '2026-08').priorPeriod, ['2026-04', '2026-05']);
  assert.deepEqual(executiveMonths('ytd', '2026-10'), ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
  const ytd = comparisonWindows('ytd', '2026-10');
  assert.deepEqual(ytd.priorPeriod, ytd.priorYear);
  assert.equal(ytd.priorYear[0], '2025-01');
  assert.equal(ytd.priorYear.at(-1), '2025-10');
  const trailing = comparisonWindows('t12', '2026-10');
  assert.deepEqual(trailing.current, Array.from({ length: 12 }, (_, index) => addMonths('2025-11', index)));
  assert.deepEqual(trailing.priorPeriod, trailing.priorYear);
  assert.equal(trailing.priorYear[0], '2024-11');
  assert.equal(trailing.priorYear.at(-1), '2025-10');
});

test('all-business revenue stays split, and profit waits unless one complete basis matches', () => {
  const split = buildExecutive({
    ...blank, scope: 'all',
    clinic: { cents: 11000, basis: 'payment_date', partial: false },
    schools: { cents: 20000, basis: 'invoice_reported_month', partial: false },
    cash: { cents: 5000, basis: 'program_reported_month', partial: false },
  });
  assert.equal(split.revenue, null);
  assert.match(split.revenueWaiting, /not added together/);
  assert.deepEqual(split.revenueLines.map(line => line.cents), [11000, 20000, 5000]);
  assert.ok(split.revenueLines.every(line => line.share === null));
  assert.equal(split.profitCents, null);
  assert.equal(split.margin, null);

  const partial = buildExecutive({ ...blank, scope: 'Pool', clinic: { cents: 8000, basis: 'payment_date', partial: true }, overhead: { cents: 4000, basis: 'payment_date', partial: false, months: 1 } });
  assert.equal(partial.revenue?.cents, 8000);
  assert.equal(partial.profitCents, null);

  const mixed = buildExecutive({ ...blank, scope: 'Pool', clinic: { cents: 8000, basis: 'payment_date', partial: false }, overhead: { cents: 4000, basis: '2026 overhead budget', partial: false, months: 1 } });
  assert.equal(mixed.profitCents, null);

  const ready = buildExecutive({ ...blank, scope: 'Pool', clinic: { cents: 10000, basis: 'same', partial: false }, overhead: { cents: 4000, basis: 'same', partial: false, months: 1 } });
  assert.equal(ready.profitCents, 6000);
  assert.equal(ready.margin, 0.6);
});

test('schools and cash keep clinic overhead off the expense lines', () => {
  const schools = buildExecutive({ ...blank, scope: 'schools', schools: { cents: 20000, basis: 'invoice_reported_month', partial: false }, overhead: { cents: 99900, basis: '2026 overhead budget', partial: false, months: 1 }, payroll: { cents: 5000, basis: 'pay', partial: false } });
  assert.equal(schools.expenses, null);
  assert.equal(schools.revenue?.cents, 20000);
  assert.deepEqual(schools.expenseLines.map(line => line.cents), [null, null]);
  assert.ok(schools.expenseLines.every(line => !/rent/i.test(line.label)));
  assert.match(schools.expenseWaiting, /Clinic rent is not charged/);

  const cash = buildExecutive({ ...blank, scope: 'cash', cash: { cents: 7500, basis: 'program_reported_month', partial: false }, overhead: { cents: 99900, basis: '2026 overhead budget', partial: false, months: 1 } });
  assert.equal(cash.expenses, null);
  assert.equal(cash.expenseLines[0].cents, null);
  assert.match(cash.expenseLines[0].waiting, /direct costs/);
});

test('pay-date wages never become the expense headline, and a flat budget is not shown as $0.00', () => {
  const wages = buildExecutive({ ...blank, scope: 'all', payroll: { cents: 60000, basis: 'Pay-date gross wages', partial: false } });
  assert.equal(wages.expenses, null);
  assert.equal(wages.expenseLines.find(line => line.id === 'payroll')?.cents, 60000);
  assert.match(wages.expenseWaiting, /not the expense total/);

  const flat = buildExecutive({
    ...blank, scope: 'all', priorLabel: 'prior period',
    overhead: { cents: 14000, basis: '2026 overhead budget', partial: false, months: 1 },
    priorOverhead: 14000, priorOverheadMonths: 1,
    overheadCategories: [{ category: 'Rent', monthlyCents: 10000, missing: 0 }, { category: 'alarm', monthlyCents: 4000, missing: 0 }],
  });
  assert.equal(flat.expenses?.cents, 14000);
  assert.equal(flat.expenseComparison?.tone, 'flat');
  assert.equal(flat.expenseComparison?.text, 'Flat vs prior period');
  assert.equal(comparisonText(flat.expenseComparison, flat.expenses?.cents ?? null, 14000), 'Flat vs prior period');
  assert.equal(comparisonText({ label: 'prior period', text: '', tone: 'down' }, 1000, 2500), '−$15.00 vs prior period');
  assert.equal(JSON.stringify(flat).includes('$0.00'), false);
  assert.equal(JSON.stringify(flat).includes('0.00'), false);
  const rent = flat.expenseLines.find(line => line.id === 'overhead-Rent');
  assert.equal(rent?.cents, 10000);
  assert.equal(rent?.share, 10000 / 14000);
  assert.equal(rent?.trend?.tone, 'flat');
});

test('overhead lines treat a blank as missing and an explicit zero as known', () => {
  const rows = overheadCategoryBreakdown({
    rows: [
      { location: 'Cheshire', category: 'Rent', sourceCell: 'D5', amount: null },
      { location: 'Cheshire', category: 'alarm', sourceCell: 'D6', amount: '0.00' },
      { location: 'Pool', category: 'Rent', sourceCell: 'E5', amount: '25.50' },
    ],
  }, 'all');
  assert.equal(rows.find(row => row.category === 'Rent')?.monthlyCents, 2550);
  assert.equal(rows.find(row => row.category === 'Rent')?.missing, 1);
  assert.equal(rows.find(row => row.category === 'alarm')?.monthlyCents, 0);
  assert.equal(rows.find(row => row.category === 'Supplies')?.monthlyCents, null);
});

test('metric totals are partial unless every requested month has the same keys', () => {
  const metric = (key, value) => ({ key, basis: 'payment_date', value, unit: 'USD', scale: 100 });
  const source = metrics => ({ source_type: 'insurance_revenue', metrics });
  const full = collectMetricCents({
    '2026-09': { sources: [source([metric('insurance_payments', 1000), metric('patient_payments', 100)])] },
    '2026-10': { sources: [source([metric('insurance_payments', 2000), metric('patient_payments', 200)])] },
  }, ['2026-09', '2026-10'], 'insurance_revenue', ['insurance_payments', 'patient_payments'], 'payment_date');
  assert.deepEqual(full, { cents: 3300, partial: false });
  const partial = collectMetricCents({
    '2026-10': { sources: [source([metric('insurance_payments', 2000), metric('patient_payments', 200)])] },
  }, ['2026-09', '2026-10'], 'insurance_revenue', ['insurance_payments', 'patient_payments'], 'payment_date');
  assert.deepEqual(partial, { cents: 2200, partial: true });
  assert.equal(collectMetricCents({
    '2026-10': { sources: [source([metric('insurance_payments', 2000)])] },
  }, ['2026-10'], 'insurance_revenue', ['insurance_payments', 'patient_payments'], 'payment_date'), null);
});

test('therapist filters accept opaque ids only and blank every company figure', () => {
  assert.equal(therapistId('Jane'), null);
  assert.equal(therapistId('Jane Doe'), null);
  assert.equal(therapistId('patient12'), null);
  assert.equal(therapistId('T014'), 'T014');
  assert.deepEqual(readTherapistIds([
    { validation: { therapist_ids: ['T014', 'Jane', 'T002', 4] } },
    { validation: null },
    { validation: { therapist_ids: 'T014' } },
  ]), ['T002', 'T014']);
  const hidden = buildExecutive({ ...blank, scope: 'all', therapist: 'T014', clinic: { cents: 99900, basis: 'payment_date', partial: false }, payroll: { cents: 5000, basis: 'pay', partial: false } });
  assert.equal(hidden.revenue, null);
  assert.equal(hidden.expenses, null);
  assert.ok(hidden.revenueLines.every(line => line.cents === null));
  assert.match(hidden.revenueWaiting, /not one therapist/);
  const filters = { period: 'quarter', location: 'Schools', therapist: 'T014', month: '2026-10' };
  assert.equal(executiveSearch(filters), 'period=quarter&location=Schools&therapist=T014&month=2026-10');
  assert.deepEqual(parseExecutiveSearch('?period=nope&location=Atlantis&therapist=Jane&month=2026-13'), { period: 'ytd', location: 'all', therapist: 'all', month: null });
  assert.deepEqual(parseExecutiveSearch(executiveSearch({ period: 'ytd', location: 'all', therapist: 'all', month: '2026-10' })), { period: 'ytd', location: 'all', therapist: 'all', month: '2026-10' });
});
