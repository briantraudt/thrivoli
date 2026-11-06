import test from 'node:test';
import assert from 'node:assert/strict';
import { compactCategoryLines } from '../src/cheshire/compactCategories.ts';

const line = (overrides = {}) => ({
  id: 'clinic', label: 'Clinic revenue', cents: null, waiting: null,
  basis: '', drill: '', share: null, trend: null, priorCents: null, ...overrides,
});

test('compact rows retain unknown, zero, negative and positive amounts without combining them', () => {
  const values = [null, 0, -123, 456];
  assert.deepEqual(compactCategoryLines(values.map((cents, index) => line({ id: String(index), cents }))).map(row => row.cents), values);
});

test('missing source labels are short and tied to their category', () => {
  const cases = [
    ['Waiting on a PracticePro or QuickBooks payments export', 'Missing clinic payments'],
    ['Waiting on the school workbook or invoices', 'Missing school income'],
    ['Waiting on the cash-program report', 'Missing program income'],
    ['Waiting on a payroll export', 'Missing payroll'],
    ['Waiting on this line in the overhead workbook', 'Missing overhead'],
    ['Waiting on therapist time by location', 'Missing location labor'],
    ['Waiting on therapist time and payroll for school work', 'Missing therapist time + payroll'],
    ['Waiting on a payroll or timesheet export with therapist IDs.', 'Missing therapist IDs'],
    ['Waiting on school-only costs', 'Missing school costs'],
    ['Waiting on direct costs for intensive therapy and swim', 'Missing direct costs'],
    [null, 'Missing data'],
  ];
  for (const [waiting, expected] of cases) assert.deepEqual(compactCategoryLines([line({ waiting })])[0].badges, [expected]);
});

test('precise supplied badges preserve dates, partial coverage and unconfirmed facts', () => {
  const sourceNote = 'Jan–Sep 2026 · Partial · Missing Oct–Dec · Currency unconfirmed';
  const original = line({ cents: 456, sourceNote, basis: 'budget' });
  assert.deepEqual(compactCategoryLines([original])[0].badges, sourceNote.split(' · '));
  assert.equal(original.sourceNote, sourceNote);
  assert.deepEqual(compactCategoryLines([line({ sourceNote: 'Missing Oct 2026' })])[0].badges, ['Missing Oct 2026']);
});

test('fallback badges retain material caveats without exposing prose drilling', () => {
  const result = compactCategoryLines([line({ cents: 456, basis: '2026 estimated budget · partial · basis unconfirmed', drill: 'Rent from the overhead workbook. 2 blank cells are unknown, not zero.' })])[0];
  assert.deepEqual(result.badges, ['Estimate', 'Partial', 'Unconfirmed', 'Missing 2 cells']);
  assert.deepEqual(Object.keys(result).sort(), ['badges', 'cents', 'id', 'label']);
});

test('category boards show accessible amounts and badges without drill, share, trend or totals', async () => {
  const { mkdtemp, mkdir, rm } = await import('node:fs/promises');
  const { fileURLToPath, pathToFileURL } = await import('node:url');
  const { build } = await import('esbuild');
  const React = await import('react');
  const { act, create } = await import('react-test-renderer');
  const root = fileURLToPath(new URL('../', import.meta.url));
  await mkdir(root + 'node_modules/.cache/', { recursive: true });
  const directory = await mkdtemp(root + 'node_modules/.cache/compact-rows-');
  const previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let renderer;
  try {
    await build({ entryPoints: [root + 'src/cheshire/CheshireExecutive.tsx'], outfile: directory + '/ui.mjs', bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic', logLevel: 'silent' });
    const { CategoryBoard } = await import(pathToFileURL(directory + '/ui.mjs'));
    await act(async () => { renderer = create(React.createElement(CategoryBoard, { title: 'Revenue', lines: [
      line({ id: 'known', cents: 0, sourceNote: 'Partial · Missing Oct 2026', drill: 'Do not display this prose', share: 1 }),
      line({ id: 'unknown', waiting: 'Waiting on the school workbook or invoices' }),
    ] })); });
    const text = JSON.stringify(renderer.toJSON());
    assert.match(text, /\$0\.00/);
    assert.match(text, /Missing Oct 2026/);
    assert.match(text, /Missing school income/);
    assert.doesNotMatch(text, /Do not display this prose|Share|Trend|Waiting on/);
    assert.equal(renderer.root.findAllByType('button').length, 0);
    assert.equal(renderer.root.findAllByType('dt').length, 2);
    assert.equal(renderer.root.findAllByType('dd').length, 2);
    assert.equal(renderer.root.findAllByProps({ 'aria-label': 'Amount unknown' }).length, 1);
    assert.equal(renderer.root.findByProps({ className: 'ced-board-head' }).findAllByType('span').length, 0);
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    await rm(directory, { recursive: true, force: true });
    if (previousActEnvironment === undefined) delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    else globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  }
});
