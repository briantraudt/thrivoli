// Fictional source records only. These tests never invoke a network or a database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { schoolDocumentFixture } from './helpers/school-income-fixture.mjs';
import { readSchoolIncomeSource } from '../src/cheshire/schoolIncomeSource.ts';
import { parseSchoolIncomeAudit } from '../supabase/functions/_shared/cheshire-school-income.ts';
import { METRICS } from '../supabase/functions/_shared/cheshire-metrics.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
function documentFixture(hash = 'a'.repeat(64)) {
  const doc = schoolDocumentFixture();
  doc.content_sha256 = hash;
  const audit = doc.validation.school_income_audit;
  audit.source.sha256 = hash;
  const sheet = audit.sheets[0];
  sheet.rows[1].label = 'FICTIONAL Academy';
  sheet.rows[1].values.find((_, index) => sheet.periods[index].start === 1).income.value = '70.00';
  sheet.rows[1].values.find((_, index) => sheet.periods[index].start === 7).income.value = '30.00';
  for (const [row, label] of [[6, 'Blank Academy'], [7, 'Zero Academy']]) {
    sheet.rows.push({ row, label, values: sheet.periods.map(period => ({
      hours: { ref: `${period.hoursColumn}${row}`, state: 'blank', value: null, formula: null },
      income: { ref: `${period.incomeColumn}${row}`, state: row === 7 && period.start === 1 ? 'number' : 'blank',
        value: row === 7 && period.start === 1 ? '0.00' : null, formula: null },
    })) });
  }
  sheet.numericCells = 5;
  sheet.populatedPairs = 5;
  sheet.rawHundredths = '13025';
  const priorYear = structuredClone(sheet);
  priorYear.sheet = '2025'; priorYear.year = 2025;
  audit.sheets.unshift(priorYear);
  parseSchoolIncomeAudit(audit, hash);
  return doc;
}
const resultFixture = () => readSchoolIncomeSource([documentFixture()], '2026-09');
const metricResponse = () => ({ month: '2026-09', location: 'all', sources: [{
  source_type: 'school_billing', document_id: 'synthetic-school-invoices', content_sha256: 'c'.repeat(64),
  validator_version: 'cheshire-intake-v1', normalizer_version: 'cheshire-metrics-v1', coverage: 'validated_source_scope',
  location_coverage: [], metrics: [{ key: 'school_invoices', ...METRICS.school_invoices, value: 20000,
    basis: 'invoice_reported_month', location: null, source_locations: [], source_rows: 1 }],
}], blocked: [], profit: { available: false, reason: 'Labor is unavailable' }, accounting_request: 'Confirm the source basis.' });

test('school options preserve duplicate row provenance, blanks and source/year identities without label merging', async () => {
  const { schoolFilterIdentity, schoolFilterOptions } = await import('../src/cheshire/schoolFilters.ts');
  const result = resultFixture();
  const options = schoolFilterOptions(result, '2026-09');
  assert.equal(options.length, 4);
  assert.equal(new Set(options.map(option => option.value)).size, 4);
  assert.deepEqual(new Set(options.map(option => option.row)), new Set([4, 5, 6, 7]));
  assert.equal(options.find(option => option.row === 4).sourceLabel, 'Fictional Academy');
  assert.equal(options.find(option => option.row === 5).sourceLabel, 'FICTIONAL Academy');
  assert.match(options.find(option => option.row === 4).label, /2026!A4/);
  assert.match(options.find(option => option.row === 5).label, /2026!A5/);
  assert(options.some(option => option.sourceLabel === 'Blank Academy'), 'Blank school is not dropped from the roster');
  assert(options.some(option => option.sourceLabel === 'Zero Academy'), 'Observed zero remains selectable');
  assert.deepEqual(schoolFilterOptions(result, '2026-06'), options, 'Changing month does not drop blank-period schools or change row identities');
  const identity = schoolFilterIdentity(result, '2026-09');
  assert.equal(typeof identity, 'string');
  assert.equal(schoolFilterIdentity(result, '2026-01'), identity);
  assert.notEqual(schoolFilterIdentity(result, '2025-09'), identity);
  const duplicateRecord = structuredClone(result);
  duplicateRecord.source.documentId = 'same-source-different-metadata-record';
  assert.equal(schoolFilterIdentity(duplicateRecord, '2026-09'), identity, 'Identity follows source bytes and year, not database row identity');
  const replacement = readSchoolIncomeSource([documentFixture('b'.repeat(64))], '2026-09');
  assert.notEqual(schoolFilterIdentity(replacement, '2026-09'), identity);
  const priorOptions = schoolFilterOptions(result, '2025-09');
  assert(priorOptions.every(option => !options.some(current => current.value === option.value)));
  assert(schoolFilterOptions(replacement, '2026-09').every(option => !options.some(current => current.value === option.value)));
  for (const absent of [{ source: null, issue: null }, { source: null, issue: 'Synthetic invalid source' }]) {
    assert.equal(schoolFilterIdentity(absent, '2026-09'), null);
    assert.deepEqual(schoolFilterOptions(absent, '2026-09'), []);
  }
  assert.equal(schoolFilterIdentity(result, '2024-09'), null);
  assert.deepEqual(schoolFilterOptions(result, '2024-09'), []);
});

test('an individual school withholds aggregate invoice facts with an explicit blocker and no source mutation', async () => {
  const { filterSelectedSchoolMetrics } = await import('../src/cheshire/schoolFilters.ts');
  const response = metricResponse(); const original = structuredClone(response);
  assert.deepEqual(filterSelectedSchoolMetrics(response, false), original);
  const filtered = filterSelectedSchoolMetrics(response, true);
  assert(!filtered.sources.some(source => source.source_type === 'school_billing'));
  const blockers = filtered.blocked.filter(blocker => blocker.source_type === 'school_billing');
  assert.equal(blockers.length, 1);
  assert.match(blockers[0].reason, /individual school|selected school|school-specific|not linked to this school/i);
  assert.equal(filtered.profit.available, false);
  assert.deepEqual(response, original);
  assert.deepEqual(filterSelectedSchoolMetrics(filtered, true), filtered, 'Repeated filtering must not duplicate a source blocker');
  const alreadyBlocked = { ...response, sources: [], blocked: [{ source_type: 'school_billing', reason: 'Older aggregate review blocker' }] };
  assert.equal(filterSelectedSchoolMetrics(alreadyBlocked, true).blocked.filter(blocker => blocker.source_type === 'school_billing').length, 1);
});

test('selected school filters all workbook totals/details, never allocates invoices, and resets only when source/year/access changes', async () => {
  await mkdir(root + 'node_modules/.cache/', { recursive: true });
  const dir = await mkdtemp(root + 'node_modules/.cache/school-filter-ui-');
  const previousDocument = globalThis.document;
  globalThis.document = { addEventListener() {}, removeEventListener() {} };
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let renderer;
  try {
    await build({ stdin: { contents: `
      import React from 'react';
      import {IntakeContext} from './src/cheshire/intakeContext';
      import {CheshireFinanceDashboardView} from './src/cheshire/CheshireFinanceDashboardView';
      const source=${JSON.stringify(documentFixture())};
      export function Harness({month='2026-09',state='ready',financeState='empty',busy=false,empty=false,hash='${'a'.repeat(64)}'}) {
        const doc=structuredClone(source);doc.content_sha256=hash;doc.validation.school_income_audit.source.sha256=hash;
        const [selected,setSelected]=React.useState('coverage_manifest');
        return <IntakeContext.Provider value={{month,state,busy,selected,setSelected,documents:empty?[]:[doc],referenceSnapshot:null,setMonth(){},refresh(){},aiEnabled:false}}>
          <CheshireFinanceDashboardView snapshot={null} state={financeState} onRefresh={()=>{}}/>
        </IntakeContext.Provider>;
      }`, resolveDir: root, loader: 'tsx' }, outfile: dir + '/ui.mjs', bundle: true, packages: 'external',
      platform: 'node', format: 'esm', jsx: 'automatic', loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' }, logLevel: 'silent',
      plugins: [{ name: 'school-filter-synthetic-period', setup(b) {
        b.onResolve({ filter: /useProfitabilityPeriod$/ }, () => ({ path: 'period', namespace: 'mock' }));
        b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ loader: 'ts', resolveDir: root, contents: `
          import {useIntake} from '${root}src/cheshire/intakeContext.ts';
          import {reportingMonths} from '${root}src/cheshire/periodSummary.ts';
          import {METRICS} from '${root}supabase/functions/_shared/cheshire-metrics.ts';
          export function useProfitabilityPeriod(mode,scope){
            if(scope==='schools')throw new Error('Schools is not a clinic API location');
            const i=useIntake(),ready=i.state==='ready'&&!i.busy;
            const metric=(key,value,basis,location)=>({key,...METRICS[key],value,basis,location,source_locations:location?[location]:[],source_rows:1});
            const source=(source_type,metrics)=>({source_type,document_id:'synthetic-'+source_type,content_sha256:'c'.repeat(64),validator_version:'cheshire-intake-v1',normalizer_version:'cheshire-metrics-v1',coverage:'validated_source_scope',location_coverage:[],metrics});
            const school=source('school_billing',[metric('school_invoices',20000,'invoice_reported_month',null)]);
            const clinic=source('insurance_revenue',[metric('insurance_payments',10000,'payment_date',scope==='all'?null:scope),metric('patient_payments',1000,'payment_date',scope==='all'?null:scope)]);
            return{months:reportingMonths(mode,i.month),scope,responses:ready?{[i.month]:{month:i.month,location:scope,sources:[clinic,...(scope==='all'?[school]:[])],blocked:[],profit:{available:false,reason:'Matching school labor unknown'},accounting_request:'Keep source bases separate'}}:{},categories:[],failedMonths:[],mapError:false,state:ready?'ready':'waiting'};
          }` }));
      } }],
    });
    const { Harness } = await import(pathToFileURL(dir + '/ui.mjs'));
    const words = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(words).join('') : node?.children?.map(words).join('') ?? '';
    const totals = () => renderer.root.findByProps({ className: 'csd-totals' }).findAllByType('strong').map(words);
    const schoolSelect = () => renderer.root.findByProps({ 'aria-label': 'School' });
    const card = () => renderer.root.findByProps({ className: 'csi-source' });
    const amount = () => card().findByProps({ className: 'csi-head' }).findByType('strong').children.join('');
    const detailRows = () => card().findByProps({ className: 'csi-schools' }).findAllByType('summary').map(words);
    const pickCenter = async label => {
      await act(async () => renderer.root.findByProps({ 'aria-label': 'Profit center' }).props.onClick());
      await act(async () => renderer.root.findAllByProps({ role: 'option' }).find(option => words(option.findByType('span')) === label).props.onClick());
    };
    const pickSchool = async value => { await act(async () => schoolSelect().props.onChange({ target: { value } })); };
    const clickPeriod = async label => { await act(async () => renderer.root.findAllByType('button').find(button => words(button) === label).props.onClick()); };
    await act(async () => { renderer = create(React.createElement(Harness)); });
    await pickCenter('Schools');
    assert.equal(schoolSelect().type, 'select');
    assert.equal(schoolSelect().props.value, 'all');
    const options = schoolSelect().findAllByType('option');
    assert.equal(options.length, 5);
    const row5Value = options.find(option => words(option).includes('2026!A5')).props.value;
    const blankValue = options.find(option => words(option).includes('Blank Academy')).props.value;
    const zeroValue = options.find(option => words(option).includes('Zero Academy')).props.value;
    const therapist = renderer.root.findByProps({ 'aria-label': 'Therapist' });
    assert.equal(therapist.type, 'select'); assert.equal(therapist.props.disabled, true);
    assert.match(words(therapist), /Therapist data needed/);
    assert.equal(amount(), '130.25');
    assert.deepEqual(totals(), ['$200.00', '—', '—']);

    await pickSchool(row5Value);
    assert.equal(amount(), '100.00');
    assert.deepEqual(totals(), ['—', '—', '—']);
    assert.deepEqual(detailRows(), ['FICTIONAL Academy · 2026!A5']);
    assert.match(words(card()), /2 numeric income cells/);
    const periodRows = card().findAllByType('table')[0].findByType('tbody').findAllByType('tr');
    const january = periodRows.find(row => words(row.findByType('th')) === 'Month 1');
    const summer = periodRows.find(row => words(row.findByType('th')) === 'July / August');
    assert.equal(words(january.findAllByType('td')[0]), '70.00');
    assert.equal(words(summer.findAllByType('td')[0]), '30.00');
    assert.equal(renderer.root.findAllByProps({ className: 'cvm-source' }).length, 0);
    assert.match(words(renderer.toJSON()), /individual school|selected school|school-specific|not linked to this school/i);

    await clickPeriod('MTD');
    assert.equal(amount(), 'No numeric source values');
    assert.equal(schoolSelect().props.value, row5Value);
    await act(async () => renderer.update(React.createElement(Harness, { month: '2026-01' })));
    assert.equal(amount(), '70.00'); assert.equal(schoolSelect().props.value, row5Value);
    await clickPeriod('YTD');
    await act(async () => renderer.update(React.createElement(Harness, { month: '2026-07' })));
    assert.equal(amount(), '70.00');
    assert.match(words(card()), /combined source interval/);
    await clickPeriod('MTD'); assert.equal(amount(), 'No numeric source values');
    await act(async () => renderer.update(React.createElement(Harness, { month: '2026-08' })));
    assert.equal(amount(), 'No numeric source values');
    await clickPeriod('YTD'); assert.equal(amount(), '100.00');
    assert.equal(schoolSelect().props.value, row5Value);

    await pickSchool(blankValue); assert.equal(amount(), 'No numeric source values');
    assert.deepEqual(totals(), ['—', '—', '—']);
    assert.deepEqual(detailRows(), ['Blank Academy · 2026!A6']);
    await pickSchool(zeroValue); assert.equal(amount(), '0.00');
    assert.deepEqual(totals(), ['—', '—', '—'], 'Observed workbook zero is not fabricated USD invoice revenue');
    await pickSchool(row5Value);
    await pickCenter('Pool');
    assert.equal(renderer.root.findAllByProps({ className: 'csi-source' }).length, 0);
    assert.equal(totals()[0], '$110.00');
    await pickCenter('All profit centers');
    assert.equal(amount(), '130.25', 'All profit centers ignores the individual school selection');
    assert.equal(totals()[0], '$110.00');
    await pickCenter('Schools');
    assert.equal(schoolSelect().props.value, row5Value);
    assert.equal(amount(), '100.00'); assert.deepEqual(totals(), ['—', '—', '—']);

    await act(async () => renderer.update(React.createElement(Harness, { month: '2025-08' })));
    assert.equal(schoolSelect().props.value, 'all'); assert.equal(amount(), '130.25');
    const priorValue = schoolSelect().findAllByType('option').find(option => words(option).includes('2025!A5')).props.value;
    await pickSchool(priorValue); assert.equal(amount(), '100.00');
    await act(async () => renderer.update(React.createElement(Harness, { month: '2025-08', hash: 'b'.repeat(64) })));
    assert.equal(schoolSelect().props.value, 'all'); assert.equal(amount(), '130.25');

    for (const [props, resets] of [[{ state: 'no-access' }, true], [{ state: 'checking', empty: true, month: '2026-10' }, false],
      [{ state: 'unavailable', empty: true }, false], [{ busy: true }, false], [{ financeState: 'no-access' }, true],
      [{ financeState: 'error' }, false], [{ financeState: 'loading' }, false], [{ empty: true }, true]]) {
      await act(async () => renderer.update(React.createElement(Harness)));
      const currentValue = schoolSelect().findAllByType('option').find(option => words(option).includes('2026!A5')).props.value;
      await pickSchool(currentValue);
      await act(async () => renderer.update(React.createElement(Harness, props)));
      assert.equal(renderer.root.findAllByProps({ className: 'csi-source' }).length, 0, JSON.stringify(props));
      const controls = renderer.root.findAllByProps({ 'aria-label': 'School' });
      assert(controls.length === 0 || controls[0].findAllByType('option').length === 1, 'Unavailable source must not expose private school options');
      assert(!words(renderer.toJSON()).includes('FICTIONAL Academy'), 'Unavailable school labels must not leak from selection intent');
      await act(async () => renderer.update(React.createElement(Harness)));
      assert.equal(schoolSelect().props.value, resets ? 'all' : currentValue, JSON.stringify(props));
      assert.equal(amount(), resets ? '130.25' : '100.00');
    }
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    await rm(dir, { recursive: true, force: true });
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
