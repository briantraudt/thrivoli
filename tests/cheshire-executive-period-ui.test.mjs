import {category, amount, words, assertCompact} from './helpers/compact-dashboard.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { create, act } from 'react-test-renderer';

test('quarter and trailing-twelve filters reach school, payroll and clinic comparison figures', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  await mkdir(root + 'node_modules/.cache/', { recursive: true });
  const dir = await mkdtemp(root + 'node_modules/.cache/executive-period-');
  const previousDocument = globalThis.document;
  globalThis.document = { addEventListener() {}, removeEventListener() {} };
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let renderer;
  try {
    await build({
      stdin: { contents: `
        import React from 'react';
        import { IntakeContext } from './src/cheshire/intakeContext';
        import { CheshireFinanceDashboardView } from './src/cheshire/CheshireFinanceDashboardView';
        import { LOCATIONS, CATEGORIES, parseFinanceSnapshot } from './src/cheshire/finance';
        import { schoolDocumentFixture } from './tests/helpers/school-income-fixture.mjs';
        import { payrollDocumentFixture } from './tests/helpers/payroll-audit-fixture.mjs';
        const snapshot = parseFinanceSnapshot({source_name:'Synthetic budget',cadence:'monthly',effective_month:null,imported_at:'2026-10-02T00:00:00Z',cost_basis:'fixed_monthly_baseline',basis_note:'Synthetic confirmed baseline',basis_confirmed_at:'2026-10-02T00:00:00Z',overhead_rows:LOCATIONS.flatMap((location,i)=>CATEGORIES.map((category,j)=>({location,category,sourceCell:String.fromCharCode(68+i)+(j+5),amount:'1'})))});
        export function Harness({month='2026-10'}) {
          const [selected,setSelected] = React.useState('coverage_manifest');const schoolDoc=schoolDocumentFixture();schoolDoc.validation.school_income_audit.sheets[0].controls=[{ref:'C62',state:'number',value:'20.50',formula:'=SUM(C4:C60)'},{ref:'O62',state:'number',value:'40',formula:'=SUM(O4:O60)'}];
          return <IntakeContext.Provider value={{month,documents:[schoolDoc,payrollDocumentFixture()],state:'ready',busy:false,selected,setSelected,setMonth(){},refresh(){},referenceSnapshot:null}}>
            <CheshireFinanceDashboardView snapshot={snapshot} state="ready" onRefresh={()=>{}}/>
          </IntakeContext.Provider>;
        }
      `, resolveDir: root, loader: 'tsx' },
      outfile: dir + '/ui.mjs', bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic',
      loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' }, logLevel: 'silent',
      plugins: [{ name: 'synthetic-period', setup(b) {
        b.onResolve({ filter: /useProfitabilityPeriod$/ }, () => ({ path: 'period', namespace: 'synthetic' }));
        b.onLoad({ filter: /.*/, namespace: 'synthetic' }, () => ({ contents: `export function useProfitabilityPeriod(mode,scope,months){return {months:months??['2026-10'],scope,responses:{},categories:[],failedMonths:[],mapError:false,state:'ready'}}`, loader: 'ts' }));
      } }],
    });
    const { Harness } = await import(pathToFileURL(dir + '/ui.mjs'));
    await act(async () => { renderer = create(React.createElement(Harness)); });
    const choosePeriod = async label => act(async () => renderer.root.findAllByType('button').find(b => b.children.join('') === label).props.onClick());
    const schoolAmount = () => amount(renderer,'School');
    const clinicOverhead = () => amount(renderer,'Rent');
    assertCompact(renderer);
    assert.equal(schoolAmount(), '$60.50');
    assert.equal(clinicOverhead(), '$70.00');

    await choosePeriod('Quarter');
    assert.equal(schoolAmount(), '—', 'October quarter must not reuse January/July workbook income');
    assert.equal(clinicOverhead(), '$7.00', 'October quarter is one budget month, not ten');
    assert.equal(words(renderer.root.findByProps({className:'ced-headline-note'})), 'Oct 2026 · All business');assert.equal(renderer.root.findAllByType('button').find(b=>words(b)==='Quarter').props['aria-pressed'],true);

    await act(async () => renderer.update(React.createElement(Harness, { month: '2026-08' })));
    assert.equal(schoolAmount(), '$40.00', 'July/August can contribute only when both months are selected');
    assert.equal(clinicOverhead(), '$14.00');
    await act(async () => renderer.update(React.createElement(Harness, { month: '2026-07' })));
    assert.equal(schoolAmount(), '—', 'July cannot split the combined July/August interval');
    assert.match(words(category(renderer,'School')), /Missing/);
    await choosePeriod('YTD');
    assert.equal(schoolAmount(), '$20.50', 'returning to YTD restores January without counting July/August early');
    await act(async () => renderer.update(React.createElement(Harness, { month: '2026-10' })));
    await choosePeriod('12 months');
    assert.ok(!category(renderer,'Rent'), '2026 budget cannot be extrapolated into 2025');assert.equal(amount(renderer,'Overhead budget'),'—');
    assert.match(words(category(renderer,'School')), /Missing November 2025/);
    assert.equal(schoolAmount(), '$60.50', 'known 2026 source observations remain available but explicitly partial');

    await act(async () => renderer.update(React.createElement(Harness, { month: '2027-01' })));
    assert.equal(amount(renderer,'Payroll · all staff'), '$500.00', 'trailing twelve includes Feb/Mar 2026 but not Jan 2026');
    assert.equal(renderer.root.findByProps({ className: 'csd-totals' }).findAllByType('strong')[2].children.join(''), '—', 'source subtotals never invent profit');
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    await rm(dir, { recursive: true, force: true });
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
