import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';import React from 'react';import {create,act} from 'react-test-renderer';
test('school source card follows profit-center selection and periods without changing financial totals',async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));await mkdir(root+'node_modules/.cache/',{recursive:true});
 const dir=await mkdtemp(root+'node_modules/.cache/school-ui-');let renderer;
 const previousDocument=globalThis.document;globalThis.document={addEventListener:()=>{},removeEventListener:()=>{}};globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 try{
  await build({stdin:{contents:`import React from 'react';import {IntakeContext} from './src/cheshire/intakeContext';import {CheshireFinanceDashboardView} from './src/cheshire/CheshireFinanceDashboardView';import {schoolDocumentFixture} from './tests/helpers/school-income-fixture.mjs';export function Harness({month='2026-09',state='ready',busy=false,financeState='empty'}){const schoolDoc=schoolDocumentFixture();schoolDoc.source_scope_label='School-level source rows; currency, accounting basis and location/provider mapping unconfirmed';schoolDoc.validation.missing_items=['Approve school/location/provider mappings and reconcile overlap with PracticePro and QuickBooks before combining revenue.'];schoolDoc.validation.school_income_audit.sheets[0].notes.push('Source currency, accounting basis, hours meaning and school/location/provider mappings are unconfirmed.');const[selected,setSelected]=React.useState('coverage_manifest');return <IntakeContext.Provider value={{month,documents:[schoolDoc],state,busy,selected,setSelected,setMonth:()=>{},refresh:()=>{},referenceSnapshot:null}}><CheshireFinanceDashboardView snapshot={null} state={financeState} onRefresh={()=>{}}/></IntakeContext.Provider>}`,resolveDir:root,loader:'tsx'},outfile:dir+'/ui.mjs',bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',loader:{'.css':'empty'},define:{'import.meta.env':'{}'},logLevel:'silent',plugins:[{name:'mock-period',setup(b){b.onResolve({filter:/useProfitabilityPeriod$/},()=>({path:'period',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:`export function useProfitabilityPeriod(mode,scope){return {months:['2026-09'],scope,responses:{},categories:[],failedMonths:[],mapError:false,state:'ready'}}`,loader:'ts',resolveDir:root}));}}]});
  const {Harness}=await import(pathToFileURL(dir+'/ui.mjs'));
  await act(async()=>{renderer=create(React.createElement(Harness))});
  const text=()=>JSON.stringify(renderer.toJSON());
  const totals=()=>renderer.root.findByProps({className:'csd-totals'}).findAllByType('strong').map(n=>n.children.join(''));
  assert.deepEqual(totals(),['—','—','—']);
  for(const phrase of ['Reported school income','60.50','Currency unconfirmed','Accounting basis','Schools operate independently of clinic locations','Blank','Fictional Academy','Original control formulas'])assert.ok(text().includes(phrase),phrase);
  const card=()=>renderer.root.findByProps({className:'csi-source'});
  await act(async()=>card().findByType('a').props.onClick());
  assert.equal(renderer.root.findByProps({className:'cfi-compact-selector'}).findByType('select').props.value,'school_billing');
  assert.doesNotMatch(text(),/school\/location\/provider|location\/provider mapping/);assert.ok(text().includes('Confirm school and therapist identities'));
  await act(async()=>renderer.root.findAllByType('button').find(n=>n.children.join('')==='Month').props.onClick());
  assert.ok(text().includes('No numeric source values'));assert.deepEqual(totals(),['—','—','—']);
  await act(async()=>renderer.update(React.createElement(Harness,{month:'2026-07'})));
  assert.ok(text().includes('excluded from this selected subtotal'));
  await act(async()=>renderer.root.findAllByType('button').find(n=>n.children.join('')==='YTD').props.onClick());
  const schoolBeforeScope=JSON.stringify(card().findByProps({className:'csi-head'}).findAllByType('strong').map(n=>n.children));
  await act(async()=>renderer.root.findByProps({'aria-label':'Profit center'}).props.onClick());
  await act(async()=>renderer.root.findAllByProps({role:'option'}).find(n=>n.findByType('span').children.join('')==='Pool').props.onClick());
  assert.equal(renderer.root.findAllByProps({className:'csi-source'}).length,0);assert.ok(!text().includes('Fictional Academy'));
  await act(async()=>renderer.root.findByProps({'aria-label':'Profit center'}).props.onClick());
  await act(async()=>renderer.root.findAllByProps({role:'option'}).find(n=>n.findByType('span').children.join('')==='Schools').props.onClick());
  assert.ok(text().includes('These figures appear under Schools and All business'));assert.ok(text().includes('Fictional Academy'));
  assert.equal(JSON.stringify(card().findByProps({className:'csi-head'}).findAllByType('strong').map(n=>n.children)),schoolBeforeScope);assert.deepEqual(totals(),['—','—','—']);
  await act(async()=>renderer.unmount());renderer=null;
  for(const props of [{state:'no-access'},{state:'checking'},{state:'unavailable'},{busy:true},{financeState:'no-access'},{financeState:'error'},{financeState:'loading'}]){
   await act(async()=>{renderer=create(React.createElement(Harness,props))});
   assert.ok(!text().includes('Fictional Academy'));assert.equal(renderer.root.findAllByProps({className:'csi-source'}).length,0);
   await act(async()=>renderer.unmount());renderer=null;
  }
 }finally{if(renderer)await act(async()=>renderer.unmount());await rm(dir,{recursive:true,force:true});if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;delete globalThis.IS_REACT_ACT_ENVIRONMENT}
});
