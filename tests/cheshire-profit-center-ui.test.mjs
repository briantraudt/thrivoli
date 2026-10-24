// Synthetic source values only. UI bundling and mocks never contact Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { LOCATIONS } from '../src/cheshire/finance.ts';
import { INTAKE_LOCATIONS } from '../supabase/functions/_shared/cheshire-intake.ts';
import { METRICS } from '../supabase/functions/_shared/cheshire-metrics.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = (sourceType, key, value, location = null) => ({ source_type: sourceType,
  document_id: `synthetic-${sourceType}`, content_sha256: 'b'.repeat(64), validator_version: 'cheshire-intake-v1',
  normalizer_version: 'cheshire-metrics-v1', coverage: 'validated_source_scope', location_coverage: location ? [location] : [],
  metrics: [{ key, ...METRICS[key], value, basis: sourceType === 'school_billing' ? 'invoice_reported_month' : 'payroll_reported_month',
    location, source_locations: location ? [location] : [], source_rows: 1 }],
});

test('Schools uses a distinct UI identity and filters source evidence without inventing a clinic or a combined total', async () => {
  const { metricLocationScope, profitCenterLabel, filterProfitCenterMetrics } = await import('../src/cheshire/profitCenterScope.ts');
  assert.equal(metricLocationScope('schools'), 'all');
  assert.equal(metricLocationScope('Pool'), 'Pool');
  assert.equal(metricLocationScope('all'), 'all');
  assert.equal(profitCenterLabel('schools'), 'Schools');
  assert.equal(profitCenterLabel('all'), 'All business');
  assert.equal(metricLocationScope('cash'), 'all');
  assert.equal(profitCenterLabel('cash'), 'Cash programs');
  assert(!LOCATIONS.some(location => location.toLowerCase() === 'schools'));
  assert(!INTAKE_LOCATIONS.some(location => location.toLowerCase() === 'schools'));
  const data = { month: '2026-09', location: 'all', sources: [source('school_billing', 'school_invoices', 20000),
    source('payroll', 'loaded_payroll', 99900)], blocked: [
      { source_type: 'school_billing', reason: 'Synthetic school scope needs review' },
      { source_type: 'clinic_activity', reason: 'Synthetic clinic source needs review' },
    ], profit: { available: false, reason: 'Source costs unavailable' }, accounting_request: 'Confirm accounting basis.' };
  const original = structuredClone(data);
  const school = filterProfitCenterMetrics(data, 'schools');
  assert.deepEqual(school.sources.map(item => item.source_type), ['school_billing']);
  assert.deepEqual(school.sources[0].metrics, original.sources[0].metrics);
  assert.deepEqual(school.blocked.map(item => item.source_type), ['school_billing']);
  assert.equal(school.location, 'all', 'No synthetic clinic identity is sent into the metric contract');
  assert.equal(school.profit.available, false);
  assert.throws(() => filterProfitCenterMetrics(data, 'Pool'), /Mismatched/);
  const clinic = filterProfitCenterMetrics({ ...data, location: 'Pool' }, 'Pool');
  assert(!clinic.sources.some(item => item.source_type === 'school_billing'));
  assert(!clinic.blocked.some(item => item.source_type === 'school_billing'));
  assert.deepEqual(filterProfitCenterMetrics(data, 'all'), original);
  assert.deepEqual(data, original, 'Scope changes never mutate the source response');
});

test('profit-center selection isolates school financial results, keeps source bases separate and preserves protected/period states', async () => {
  await mkdir(root + 'node_modules/.cache/', { recursive: true });
  const dir = await mkdtemp(root + 'node_modules/.cache/profit-center-ui-');
  let renderer;
  const previousDocument = globalThis.document;
  globalThis.document = { addEventListener() {}, removeEventListener() {} };
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    await build({ stdin: { contents: `
      import React from 'react';
      import {IntakeContext} from './src/cheshire/intakeContext';
      import {CheshireFinanceDashboardView} from './src/cheshire/CheshireFinanceDashboardView';
      import {schoolDocumentFixture} from './tests/helpers/school-income-fixture.mjs';
      import {payrollDocumentFixture} from './tests/helpers/payroll-audit-fixture.mjs';
      import {cumulativeFixture} from './tests/helpers/cumulative-fixture.mjs';
      export function Harness({month='2026-09',state='ready',busy=false,financeState='empty',empty=false,cumulative=false}) {
        const [selected,setSelected]=React.useState('coverage_manifest');
        const documents=empty?[]:[schoolDocumentFixture(),payrollDocumentFixture()];
        if(cumulative){const report=cumulativeFixture('provider_posted_payments');documents.push({id:'synthetic-cumulative',source_type:'insurance_revenue',content_sha256:report.source.sha256,status:'incomplete',source_origin:'existing_source',requested_month:null,reported_month:null,storage_path:null,created_at:'2026-10-02T00:00:00Z',validation:{validator_version:'source-audit-v1',cumulative_report:report,missing_items:[],reported_metrics:[],checks:[],covered_locations:[],canonical_fields:[]}});}
        return <IntakeContext.Provider value={{month,documents,state,busy,selected,setSelected,setMonth(){},refresh(){},referenceSnapshot:null,syntheticEmpty:empty}}>
          <CheshireFinanceDashboardView snapshot={null} state={financeState} onRefresh={()=>{}}/>
        </IntakeContext.Provider>;
      }`, resolveDir: root, loader: 'tsx' }, outfile: dir + '/ui.mjs', bundle: true, platform: 'node', format: 'esm',
      packages: 'external', jsx: 'automatic', loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' }, logLevel: 'silent',
      plugins: [{ name: 'synthetic-period', setup(b) {
        b.onResolve({ filter: /useProfitabilityPeriod$/ }, () => ({ path: 'period', namespace: 'mock' }));
        b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ loader: 'ts', resolveDir: root, contents: `
          import {useIntake} from '${root}src/cheshire/intakeContext.ts';
          import {reportingMonths} from '${root}src/cheshire/periodSummary.ts';
          import {METRICS} from '${root}supabase/functions/_shared/cheshire-metrics.ts';
          export function useProfitabilityPeriod(mode,scope){
            if(scope==='schools'||scope==='Schools')throw new Error('Schools must not become an API clinic location');
            const intake=useIntake();const months=reportingMonths(mode,intake.month);
            const metric=(key,value,basis,location=scope==='all'?null:scope)=>({key,...METRICS[key],value,basis,location,source_locations:location?[location]:[],source_rows:1});
            const source=(source_type,metrics)=>({source_type,document_id:'synthetic-'+source_type,content_sha256:'b'.repeat(64),validator_version:'cheshire-intake-v1',normalizer_version:'cheshire-metrics-v1',coverage:'validated_source_scope',location_coverage:scope==='all'?[]:[scope],metrics});
            const school=source('school_billing',[metric('school_invoices',20000,'invoice_reported_month',null)]);
            school.location_coverage=[];
            const clinic=source('insurance_revenue',[metric('insurance_payments',scope==='Pool'?7500:10000,'payment_date'),metric('patient_payments',scope==='Pool'?500:1000,'payment_date')]);
            const activity=source('clinic_activity',[metric('completed_visits',42,'service_date')]);
            const payroll=source('payroll',[metric('loaded_payroll',99900,'payroll_reported_month',null)]);
            const overhead=source('overhead',[metric('monthly_overhead',4000,'overhead_reported_month')]);
            const ready=intake.state==='ready'&&!intake.busy;
            const responses=ready&&!intake.syntheticEmpty?{[intake.month]:{month:intake.month,location:scope,sources:[clinic,activity,payroll,overhead,...(scope==='all'?[school]:[])],blocked:scope==='all'?[]:[{source_type:'school_billing',reason:'Schools are independent of clinics.'}],profit:{available:false,reason:'Costs and basis still need reconciliation.'},accounting_request:'Synthetic common accounting basis needed.'}}:{};
            return {months,scope,responses,categories:[],failedMonths:[],mapError:false,state:ready?'ready':'waiting'};
          }` }));
      } }],
    });
    const { Harness } = await import(pathToFileURL(dir + '/ui.mjs'));
    await act(async () => { renderer = create(React.createElement(Harness)); });
    const text = node => JSON.stringify(node ?? renderer.toJSON());
    const totals = () => renderer.root.findByProps({ className: 'csd-totals' }).findAllByType('strong').map(node => node.children.join(''));
    const sourceTitles = () => renderer.root.findAllByProps({ className: 'cvm-source' }).map(node => node.findByType('h3').children.join(''));
    const pick = async label => {
      await act(async () => renderer.root.findByProps({ 'aria-label': 'Profit center' }).props.onClick());
      await act(async () => renderer.root.findAllByProps({ role: 'option' }).find(option => option.findByType('span').children.join('') === label).props.onClick());
    };
    const schoolCards = () => renderer.root.findAllByProps({ className: 'csi-source' });
    const periodButton = label => renderer.root.findAllByType('button').find(button => button.children.join('') === label);
    assert.equal(schoolCards().length, 1);
    assert(text().includes('60.50'));
    assert(sourceTitles().includes('School billing'));
    const allTotals = totals();
    assert(!allTotals.some(value => ['$310.00', '$370.50', '$260.50'].includes(value)), 'Separate school evidence must not be added to clinic payments');
    assert.match(text(), /overlap|double.count|not added|not combined/i);

    await pick('Schools');
    assert.deepEqual(totals(), ['$200.00', '—', '—']);
    assert.deepEqual(sourceTitles(), ['School billing']);
    assert.equal(schoolCards().length, 1);
    assert.equal(renderer.root.findAllByProps({ className: 'cpa-source' }).length, 0);
    assert.equal(renderer.root.findAllByProps({ className: 'ccr-report' }).length, 0);
    assert.equal(renderer.root.findAllByProps({ className: 'csd-category csd-category-overhead' }).length, 0);
    assert.equal(renderer.root.findAllByProps({ className: 'csd-category csd-category-operations' }).length, 0);
    assert.match(text(), /therapist labor/i);
    assert.match(text(), /Clinics absorb|overhead.*Clinics|overhead.*clinics/);
    assert.doesNotMatch(text(), /\$999\.00|\$110\.00|\$260\.50/);

    await act(async () => periodButton('Month').props.onClick());
    assert(text().includes('No numeric source values'));
    assert.deepEqual(totals(), ['$200.00', '—', '—']);
    await act(async () => renderer.update(React.createElement(Harness, { month: '2026-07' })));
    assert(text().includes('excluded from this selected subtotal'));
    await act(async () => periodButton('YTD').props.onClick());
    assert(text().includes('20.50'));
    assert.deepEqual(totals(), ['$200.00', '—', '—']);

    await act(async () => renderer.update(React.createElement(Harness)));
    await pick('Pool');
    assert.equal(schoolCards().length, 0);
    assert(!sourceTitles().includes('School billing'));
    assert.equal(totals()[0], '$80.00');
    const categoryTable = renderer.root.findAllByProps({ className: 'csd-detail-table' });
    assert(!categoryTable.some(table => table.findAllByType('strong').some(node => node.children.join('') === 'School invoices')));
    await pick('All business');
    assert.deepEqual(totals(), allTotals);
    assert.equal(schoolCards().length, 1);
    assert(sourceTitles().includes('School billing'));

    await act(async () => renderer.update(React.createElement(Harness, { month: '2026-10', cumulative: true })));
    assert.equal(renderer.root.findAllByProps({ className: 'ccr-report' }).length, 1);
    await pick('Schools');
    assert.equal(renderer.root.findAllByProps({ className: 'ccr-report' }).length, 0);
    assert.deepEqual(totals(), ['$200.00', '—', '—']);

    await act(async () => renderer.update(React.createElement(Harness, { empty: true })));
    assert.deepEqual(totals(), ['—', '—', '—']);
    assert.equal(schoolCards().length, 0);
    assert.deepEqual(sourceTitles(), []);
    assert.match(text(), /school/i);
    assert.doesNotMatch(text(), /\$0\.00/);

    for (const props of [{ state: 'no-access' }, { state: 'checking' }, { state: 'unavailable' }, { busy: true },
      { financeState: 'no-access' }, { financeState: 'error' }, { financeState: 'loading' }]) {
      await act(async () => renderer.update(React.createElement(Harness, props)));
      assert.equal(schoolCards().length, 0, JSON.stringify(props));
      assert.deepEqual(totals(), ['—', '—', '—'], JSON.stringify(props));
      assert.deepEqual(sourceTitles(), [], JSON.stringify(props));
    }
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    await rm(dir, { recursive: true, force: true });
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
