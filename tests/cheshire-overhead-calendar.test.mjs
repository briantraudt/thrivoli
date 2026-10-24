import test from 'node:test';
import assert from 'node:assert/strict';
import { estimatedFixedOverhead, FIXED_OVERHEAD_ESTIMATE } from '../src/cheshire/overheadEstimate.ts';
import { parseFinanceSnapshot, LOCATIONS, CATEGORIES } from '../src/cheshire/finance.ts';

function snapshot() {
  return parseFinanceSnapshot({
    source_name: 'Synthetic',
    cadence: 'monthly',
    effective_month: null,
    imported_at: '2026-10-02T00:00:00Z',
    cost_basis: 'fixed_monthly_baseline',
    basis_note: 'Synthetic confirmed baseline',
    basis_confirmed_at: '2026-10-02T00:00:00Z',
    overhead_rows: LOCATIONS.flatMap((location, i) => CATEGORIES.map((category, j) => ({
      location,
      category,
      sourceCell: String.fromCharCode(68 + i) + (j + 5),
      amount: i === 0 && j === 0 ? null : '1',
    }))),
  });
}

test('year-to-date overhead keeps every month of 2026, including November and December', () => {
  const books = snapshot();
  assert.equal(FIXED_OVERHEAD_ESTIMATE.lastApprovedMonth, '2026-12');
  const october = estimatedFixedOverhead(books, 'ytd', '2026-10', 'all');
  const november = estimatedFixedOverhead(books, 'ytd', '2026-11', 'all');
  const december = estimatedFixedOverhead(books, 'ytd', '2026-12', 'all');
  assert.equal(october.months, 10);
  assert.equal(october.value, 139000);
  assert.equal(november.months, 11);
  assert.equal(november.value, 152900);
  assert.equal(december.months, 12);
  assert.equal(december.value, 166800);
  const novemberMonth = estimatedFixedOverhead(books, 'mtd', '2026-11', 'all');
  assert.equal(novemberMonth.months, 1);
  assert.equal(novemberMonth.value, 13900);
  assert.equal(estimatedFixedOverhead(books, 'ytd', '2026-11', 'Cheshire').value, 20900);
  assert.equal(estimatedFixedOverhead(books, 'ytd', '2026-11', 'Cheshire').months, 11);
  assert.equal(estimatedFixedOverhead(books, 'ytd', '2027-01', 'all'), null);
  assert.equal(estimatedFixedOverhead(books, 'ytd', '2025-12', 'all'), null);
  assert.equal(estimatedFixedOverhead(books, 'mtd', '2026-11', 'Cheshire').value, 1900);
});
