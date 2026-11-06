import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {words} from './helpers/compact-dashboard.mjs';

test('separate source-review navigation retains all groups, selection, history and access gates',async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));await mkdir(root+'node_modules/.cache/',{recursive:true});const dir=await mkdtemp(root+'node_modules/.cache/source-navigation-');
 let renderer,reviewFocus=0;const previousDocument=globalThis.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 globalThis.document={getElementById:id=>id==='monthly-intake-review'?{focus:()=>reviewFocus++,scrollIntoView(){}}:null};
 try{
  await build({stdin:{contents:`import React,{useState} from 'react';import {MemoryRouter,Routes,Route,useNavigate,useLocation} from 'react-router-dom';import {IntakeContext} from './src/cheshire/intakeContext';import {CheshireSourceReview} from './src/cheshire/CheshireSourceReview';import {CheshirePortalNavigation} from './src/cheshire/CheshirePortalNavigation';import {schoolDocumentFixture} from './tests/helpers/school-income-fixture.mjs';function History(){const n=useNavigate(),l=useLocation();return <><output>{l.pathname+l.hash}</output><button onClick={()=>n(-1)}>Back</button><button onClick={()=>n(1)}>Forward</button></>}export function Harness({state='ready',financeState='empty',initial='/cheshire/map'}){const[selected,setSelected]=useState('coverage_manifest');const[month,setMonth]=useState('2026-10');return <MemoryRouter initialEntries={[initial]}><IntakeContext.Provider value={{month,setMonth,selected,setSelected,documents:[schoolDocumentFixture()],referenceSnapshot:null,state,busy:false,refresh(){}}}><CheshirePortalNavigation/><History/><Routes><Route path='/cheshire/map' element={<h1>Map</h1>}/><Route path='/cheshire/dashboard' element={<h1>Dashboard</h1>}/><Route path='/cheshire/data' element={<CheshireSourceReview snapshot={null} state={financeState}/>}/></Routes></IntakeContext.Provider></MemoryRouter>}`,resolveDir:root,loader:'tsx'},outfile:dir+'/ui.mjs',bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',loader:{'.css':'empty'},define:{'import.meta.env':'{}'},logLevel:'silent'});
  const{Harness}=await import(pathToFileURL(dir+'/ui.mjs'));
  await act(async()=>{renderer=create(React.createElement(Harness))});
  const links=()=>renderer.root.findByType('nav').findAllByType('a');
  const clickLink=async label=>{const event={button:0,defaultPrevented:false,preventDefault(){this.defaultPrevented=true}};await act(async()=>links().find(link=>words(link)===label).props.onClick(event));};
  const requests=()=>renderer.root.findAllByType('button').filter(button=>String(button.props.className??'').startsWith('cfi-request '));
  const insurance=()=>requests().find(button=>words(button.findByType('strong'))==='Insurance payments');
  assert.deepEqual(links().map(words),['Dashboard','Profitability map','Data requests']);assert.equal(requests().length,0);
  await clickLink('Data requests');assert.equal(words(renderer.root.findByType('output')),'/cheshire/data');assert.equal(links()[2].props['aria-current'],'page');assert.equal(links()[0].props['aria-current'],undefined);assert.equal(requests().length,9);
  await act(async()=>insurance().props.onClick());assert.equal(insurance().props['aria-pressed'],true);assert.ok(reviewFocus>0);assert.equal(renderer.root.findByProps({className:'cfi-compact-selector'}).findByType('select').props.value,'insurance_revenue');
  await act(async()=>renderer.root.findByProps({'aria-label':'Source review month'}).props.onChange({target:{value:'2026-09'}}));assert.equal(renderer.root.findByProps({'aria-label':'Source review month'}).props.value,'2026-09');
  await clickLink('Dashboard');assert.equal(requests().length,0);assert.equal(links()[0].props['aria-current'],'page');
  await act(async()=>renderer.root.findAllByType('button').find(button=>words(button)==='Back').props.onClick());assert.equal(links()[2].props['aria-current'],'page');assert.equal(insurance().props['aria-pressed'],true);
  await act(async()=>renderer.root.findAllByType('button').find(button=>words(button)==='Forward').props.onClick());assert.equal(links()[0].props['aria-current'],'page');assert.equal(requests().length,0);
  await clickLink('Data requests');
  for(const [props,status] of [[{state:'no-access'},'Access required'],[{financeState:'no-access'},'Access required'],[{state:'checking'},'Loading'],[{financeState:'loading'},'Loading'],[{state:'unavailable'},'Source unavailable'],[{financeState:'error'},'Source unavailable']]){
   await act(async()=>renderer.update(React.createElement(Harness,props)));assert.equal(words(renderer.root.findByProps({role:'status'})),status);assert.equal(requests().length,0);assert.equal(renderer.root.findAllByProps({className:'cfi-review'}).length,0);assert.doesNotMatch(words(renderer.toJSON()),/Fictional|60\.50/);
  }
  await act(async()=>renderer.unmount());renderer=null;
  await act(async()=>{renderer=create(React.createElement(Harness,{initial:'/cheshire/dashboard#csd-source-review'}))});assert.equal(words(renderer.root.findByType('output')),'/cheshire/data');assert.equal(requests().length,9);
 }finally{if(renderer)await act(async()=>renderer.unmount());await rm(dir,{recursive:true,force:true});if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});
