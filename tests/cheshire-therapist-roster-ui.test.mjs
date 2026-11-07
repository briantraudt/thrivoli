import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { words } from './helpers/compact-dashboard.mjs';

test('private roster names populate the dropdown only with access and never reuse company totals for an individual', async () => {
  const root=fileURLToPath(new URL('../',import.meta.url));
  await mkdir(root+'node_modules/.cache/',{recursive:true});
  const dir=await mkdtemp(root+'node_modules/.cache/therapist-roster-ui-');
  const previousDocument=globalThis.document;
  globalThis.document={addEventListener(){},removeEventListener(){}};
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  let renderer;
  try {
    await build({stdin:{contents:`
      import React from 'react';
      import {IntakeContext} from './src/cheshire/intakeContext';
      import {CheshireFinanceDashboardView} from './src/cheshire/CheshireFinanceDashboardView';
      export function Harness({state='ready',intakeState='ready',busy=false,reviewed=false}) {
        const value={month:'2026-10',busy,state:intakeState,selected:'coverage_manifest',documents:[{reviewed}],referenceSnapshot:null,setMonth(){},setSelected(){},refresh(){}};
        return <IntakeContext.Provider value={value}><CheshireFinanceDashboardView state={state} snapshot={null} onRefresh={()=>{}} sampleParts={{clinic:{cents:12300,basis:'synthetic',partial:true},schools:null,cash:null}}/></IntakeContext.Provider>;
      }
    `,resolveDir:root,loader:'tsx'},outfile:dir+'/ui.mjs',bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',loader:{'.css':'empty'},define:{'import.meta.env':'{}'},logLevel:'silent',plugins:[{name:'synthetic-roster',setup(b){
      b.onResolve({filter:/\/therapistRoster$/},()=>({path:'roster',namespace:'mock'}));
      b.onLoad({filter:/roster/,namespace:'mock'},()=>({contents:`export function readTherapistRoster(documents){const reviewed=documents[0].reviewed;return {issue:null,roster:{sourceHash:'a'.repeat(64),providerPeriod:{start:'2026-01-01',end:'2026-10-31'},rows:[{id:'provider_'+ 'a'.repeat(16),displayName:'Example Clinician',payrollCandidateName:'Example Payroll Candidate',matchStatus:reviewed?'reviewed_name_discipline':'candidate_full_name',identityReview:reviewed?{payrollStaffId:'0000000000000001',reviewBasis:'unique_name_and_clinical_discipline',reviewDate:'2026-11-01'}:null,reviewIssue:null,entityKind:'person',zipStatus:'candidate',zipWorkbook:'Synthetic.xlsx',revenueStatus:'present',paymentStatus:'present'},{id:'provider_'+'b'.repeat(16),displayName:'Synthetic Resource Label',payrollCandidateName:null,matchStatus:'not_applicable',entityKind:'resource',zipStatus:'not_found',zipWorkbook:null,revenueStatus:'present',paymentStatus:'absent'}]}}}`,loader:'ts'}));
    }}]});
    const {Harness}=await import(pathToFileURL(dir+'/ui.mjs'));
    await act(async()=>{renderer=create(React.createElement(Harness));});
    const select=()=>renderer.root.findByProps({'aria-label':'Therapist'});
    assert.match(words(select()),/Example Clinician/);
    assert.doesNotMatch(words(select()),/Synthetic Resource Label/);
    assert.match(words(renderer.root.findByProps({className:'ced-therapist-links'})),/Company-wide roster/);
    assert.equal(words(renderer.root.findByProps({href:'#therapist-profitability'})),'Missing therapist links');
    assert.equal(renderer.root.findByProps({className:'csd-totals'}).findAllByType('strong')[0].children.join(''),'$123.00');
    await act(async()=>select().props.onChange({target:{value:'provider_'+'a'.repeat(16)}}));
    assert.deepEqual(renderer.root.findByProps({className:'csd-totals'}).findAllByType('strong').map(words),['—','—','—']);
    await act(async()=>renderer.update(React.createElement(Harness,{reviewed:true})));
    assert.match(words(renderer.root),/1 reviewed payroll matches/);
    assert.match(words(renderer.root),/0 unconfirmed payroll candidates/);
    assert.match(words(renderer.root),/Reviewed match · name \+ clinical discipline/);
    assert.match(words(renderer.root),/stable-ID link not verified/);
    assert.deepEqual(renderer.root.findByProps({className:'csd-totals'}).findAllByType('strong').map(words),['—','—','—']);
    assert.doesNotMatch(words(renderer.root),/0000000000000001/);
    await act(async()=>select().props.onChange({target:{value:'all'}}));
    assert.equal(renderer.root.findByProps({className:'csd-totals'}).findAllByType('strong')[0].children.join(''),'$123.00');
    for(let i=0;i<2;i++) await act(async()=>select().props.onChange({target:{value:'provider_'+'a'.repeat(16)}}));
    assert.deepEqual(renderer.root.findByProps({className:'csd-totals'}).findAllByType('strong').map(words),['—','—','—']);
    for (const props of [{state:'no-access'},{state:'error'},{state:'loading'},{intakeState:'no-access'},{intakeState:'unavailable'},{busy:true}]) {
      await act(async()=>renderer.update(React.createElement(Harness,{reviewed:true,...props})));
      assert.doesNotMatch(words(renderer.root),/Example Clinician|Example Payroll Candidate/);
      assert.doesNotMatch(words(renderer.root.findByProps({className:'ced-therapist-links'})),/Roster not linked/);
    }
  } finally {
    if(renderer) await act(async()=>renderer.unmount());
    await rm(dir,{recursive:true,force:true});
    if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
