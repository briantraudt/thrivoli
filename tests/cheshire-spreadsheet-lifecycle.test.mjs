import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {LOCATIONS} from '../src/cheshire/finance.ts';
const payload=(month,location)=>({month,location,sources:[],blocked:[],profit:{available:false,reason:'Accounting basis missing'},accounting_request:'Confirm accounting basis'});
test('the entire location matrix and map clear on month, identity, review, busy, and stale-response transitions',async()=>{
 const cache=fileURLToPath(new URL('../node_modules/.cache/',import.meta.url));await mkdir(cache,{recursive:true});const dir=await mkdtemp(cache+'sheet-lifecycle-');globalThis.IS_REACT_ACT_ENVIRONMENT=true;let renderer;const requests=[];const maps=[];
 globalThis.__sheetInvoke=(_name,options)=>new Promise(resolve=>requests.push({options,resolve}));globalThis.__sheetMap=()=>new Promise(resolve=>maps.push(resolve));
 try {await build({stdin:{contents:`import React from 'react';import {IntakeContext} from './src/cheshire/intakeContext';import {useProfitabilitySheet} from './src/cheshire/useProfitabilitySheet';function Read(){return <pre>{JSON.stringify(useProfitabilitySheet())}</pre>;}export function Harness({month,state='ready',busy=false,actor='one',documents=[]}){return <IntakeContext.Provider key={actor} value={{month,state,busy,documents,referenceSnapshot:null}}><Read/></IntakeContext.Provider>;}`,loader:'tsx',resolveDir:fileURLToPath(new URL('../',import.meta.url))},outfile:dir+'/harness.mjs',bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',plugins:[{name:'synthetic-client',setup(b){b.onResolve({filter:/cheshireSupabase$/},()=>({path:'mock-client',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const cheshireSupabase={functions:{invoke:(...args)=>globalThis.__sheetInvoke(...args)},from:()=>({select:()=>({order:()=>globalThis.__sheetMap()})})};',loader:'js'}));}}],logLevel:'silent'});
 const {Harness}=await import(pathToFileURL(dir+'/harness.mjs'));const read=()=>JSON.parse(renderer.toJSON().children[0]);const update=async(props)=>act(async()=>renderer.update(React.createElement(Harness,props)));
 const finish=async(batch,month,badScope=null)=>act(async()=>{for(let i=0;i<8;i++){const request=requests[batch*8+i];request.resolve({data:{metrics:payload(month,request.options.body.location===badScope?'wrong':request.options.body.location)},error:null});}maps[batch]({data:[{category:'labor',value:'Synthetic wages',segment_index:0,position:0}],error:null});});
 await act(async()=>{renderer=create(React.createElement(Harness,{month:'2026-09'}));});assert.equal(requests.length,8);await finish(0,'2026-09');assert.equal(Object.keys(read().metrics).length,8);assert.equal(read().categories.length,1);
 await update({month:'2026-10'});assert.deepEqual(read().metrics,{});assert.deepEqual(read().categories,[]);
 await update({month:'2026-11'});await finish(1,'2026-10');assert.deepEqual(read().metrics,{});await finish(2,'2026-11','Pool');assert.equal(read().failedScopes[0],'Pool');assert.equal(Object.keys(read().metrics).length,7);
 await update({month:'2026-11',busy:true});assert.deepEqual(read().metrics,{});await update({month:'2026-11'});assert.deepEqual(read().metrics,{},'old loaded matrix cannot resurface after busy clears');await finish(3,'2026-11');assert.equal(Object.keys(read().metrics).length,8);
 await update({month:'2026-11',documents:[{id:'same',review_revision:'new'}]});assert.deepEqual(read().metrics,{});await update({month:'2026-11',actor:'two',state:'no-access'});await finish(4,'2026-11');assert.deepEqual(read().metrics,{});assert.deepEqual(read().categories,[]);
 await update({month:'2026-11',actor:'two'});await finish(5,'2026-10');assert.deepEqual(read().metrics,{});assert.equal(read().failedScopes.length,LOCATIONS.length+1);
 }finally{if(renderer)await act(async()=>renderer.unmount());await rm(dir,{recursive:true,force:true});delete globalThis.__sheetInvoke;delete globalThis.__sheetMap;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});
