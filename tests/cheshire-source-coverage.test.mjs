import test from 'node:test';
import assert from 'node:assert/strict';
import { coverageLabels, monthEnd } from '../src/cheshire/sourceCoverage.ts';

test('coverage names each missing month and distinguishes the partial cutoff month', () => {
  assert.equal(coverageLabels(['2026-08','2026-09','2026-10','2026-11'], ['2026-08','2026-10'], { through:'2026-10-02',partial:['2026-10'] }), 'Current through 2026-10-02 · Missing September · Missing November · October partial');
  assert.equal(coverageLabels(['2026-09','2026-10'], [], { failed:['2026-10'] }), 'Missing September · Unavailable October');
});
test('coverage preserves year distinctions, combined months, and selected-period boundaries', () => {
  assert.equal(coverageLabels(['2025-12','2026-01'], ['2026-01'], {}), 'Current through January 2026 · Missing December 2025');
  assert.equal(coverageLabels(['2026-07','2026-08'], ['2026-07','2026-08'], { combined:true }), 'Current through August 2026 · July/August combined');
  assert.equal(coverageLabels(['2026-02'], ['2026-02','2026-03'], { through:'2026-03-06',partial:['2026-03'] }), 'Current through February 2026');
  assert.equal(monthEnd('2026-02'), '2026-02-28');
  assert.equal(monthEnd('2024-02'), '2024-02-29');
});
