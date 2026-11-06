import {category, amount, words, assertCompact} from './helpers/compact-dashboard.mjs';
import test from 'node:test'; import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises'; import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild'; import React from 'react'; import { create, act } from 'react-test-renderer';
test('payroll category follows filters and auth state, shows currency/cutoff caveats, and includes gross wages once in partial expenses', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url)); const cache = root + 'node_modules/.cache/';
  await mkdir(cache, { recursive: true }); const dir = await mkdtemp(cache + 'payroll-ui-'); let renderer;
  const previousDocument = globalThis.document; globalThis.document = { addEventListener: () => {}, removeEventListener: () => {} }; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    await build({ stdin: { contents: `import React from 'react'; import { IntakeContext } from './src/cheshire/intakeContext'; import { CheshireFinanceDashboardView } from './src/cheshire/CheshireFinanceDashboardView'; import { payrollDocumentFixture } from './tests/helpers/payroll-audit-fixture.mjs'; export function Harness({month='2026-03',state='ready',busy=false,financeState='empty'}) { const documents=[payrollDocumentFixture()]; const[selected,setSelected]=React.useState('coverage_manifest'); return <IntakeContext.Provider value={{month,documents,state,busy,selected,setSelected,setMonth:()=>{},refresh:()=>{},referenceSnapshot:null}}><CheshireFinanceDashboardView snapshot={null} state={financeState} onRefresh={()=>{}}/></IntakeContext.Provider>; }`, resolveDir: root, loader: 'tsx' }, outfile: dir + '/ui.mjs', bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic', loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' }, logLevel: 'silent', plugins: [{ name: 'mock-period', setup(b) { b.onResolve({ filter: /useProfitabilityPeriod$/ }, () => ({ path: 'period', namespace: 'mock' })); b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: `export function useProfitabilityPeriod(mode,scope){return {months:['2026-03'],scope,responses:{},categories:[],failedMonths:[],mapError:false,state:'ready'}}`, loader: 'ts', resolveDir: root })); } }] });
    const { Harness } = await import(pathToFileURL(dir + '/ui.mjs'));
    await act(async () => { renderer = create(React.createElement(Harness)); });
    const totals = () => renderer.root.findByProps({ className: 'csd-totals' }).findAllByType('strong').map(node => node.children.join(''));
    assert.deepEqual(totals(), ['—', '$600.00', '—']);assert.equal(amount(renderer,'Payroll · all staff'),'$600.00');assertCompact(renderer);
    for(const badge of ['Pay-date gross','Missing employer costs','Currency/overlap unconfirmed','2026-03-06']) assert.ok(words(category(renderer,'Payroll · all staff')).includes(badge),badge);
    await act(async () => renderer.root.findAllByType('button').find(button => button.children.join('') === 'Month').props.onClick());
    assert.equal(amount(renderer,'Payroll · all staff'), '$300.00');
    assert.deepEqual(totals(), ['—', '$300.00', '—']);
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Profit center' }).props.onClick());
    await act(async () => renderer.root.findAllByProps({ role: 'option' }).find(option => option.findByType('span').children.join('') === 'Pool').props.onClick());
    assert.deepEqual(totals(),['—','—','—']);assert.ok(!category(renderer,'Payroll · all staff'));
    await act(async () => renderer.unmount()); renderer = null;
    for (const props of [{ state: 'no-access' }, { state: 'checking' }, { state: 'unavailable' }, { busy: true }, { financeState: 'no-access' }, { financeState: 'error' }, { financeState: 'loading' }]) {
      await act(async () => { renderer = create(React.createElement(Harness, props)); });
      assert.deepEqual(totals(),['—','—','—'],JSON.stringify(props));assert.doesNotMatch(words(renderer.toJSON()),/\$600\.00|\$300\.00/);
      await act(async () => renderer.unmount()); renderer = null;
    }
  } finally { if (renderer) await act(async () => renderer.unmount()); await rm(dir, { recursive: true, force: true }); if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument; delete globalThis.IS_REACT_ACT_ENVIRONMENT; }
});
