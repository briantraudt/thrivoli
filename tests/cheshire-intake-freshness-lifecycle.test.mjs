import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {REQUIRED_CHECKS} from '../supabase/functions/_shared/cheshire-intake.ts';
test('the actual intake provider reads safe revisions and refresh removes stale same-byte completion',async()=>{
 const month=new Date().toISOString().slice(0,7),hash='a'.repeat(64),manifestVersion='aaaaaaaa-1111-4111-8111-111111111111',payrollVersion='bbbbbbbb-1111-4111-8111-111111111111';
 const review={validator_version:'cheshire-intake-v1',status:'complete',reported_month:month,missing_items:[],covered_locations:[],canonical_fields:[],checks:REQUIRED_CHECKS.map(key=>({key,passed:true,message:'Synthetic evidence'}))};
 const document=(id,source,revision)=>({id,source_type:source,review_revision:revision,requested_month:month+'-01',reported_month:month+'-01',file_name:'synthetic.csv',content_sha256:hash,status:'complete',created_at:'2026-09-01T00:00:00Z',source_origin:'portal_upload',validation:review,validation_dependencies:{},validation_dependency_revisions:{}});
 let rows=[document('manifest','coverage_manifest',manifestVersion),{...document('payroll','payroll',payrollVersion),validation_dependencies:{coverage_manifest:`manifest:${hash}`},validation_dependency_revisions:{coverage_manifest:manifestVersion}}];
 const selections=[];let renderer;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 globalThis.__intakeFreshnessClient={auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-user'}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},functions:{invoke:async()=>({data:{uploads_enabled:true,ai_enabled:false},error:null})},from:table=>{assert.equal(table,'cheshire_intake_document');const query={select:columns=>{selections.push(columns.split(','));return query},or:()=>query,order:()=>query,limit:async()=>({data:structuredClone(rows),error:null})};return query;}};
 const cache=fileURLToPath(new URL('../node_modules/.cache/',import.meta.url));await mkdir(cache,{recursive:true});const dir=await mkdtemp(cache+'intake-freshness-');
 try{
  await build({stdin:{contents:`import React from 'react';import {CheshireMonthlyIntakeProvider} from './src/cheshire/CheshireMonthlyIntakeProvider';import {useIntake} from './src/cheshire/intakeContext';import {buildMonthlyChecklist} from './src/cheshire/intake';function Read(){const context=useIntake();globalThis.__intakeFreshnessContext=context;return <pre>{JSON.stringify({state:context.state,items:Object.fromEntries(buildMonthlyChecklist(context.documents,context.month,null).map(item=>[item.id,item.status]))})}</pre>;}export function Harness(){return <CheshireMonthlyIntakeProvider><Read/></CheshireMonthlyIntakeProvider>;}`,loader:'tsx',resolveDir:fileURLToPath(new URL('../',import.meta.url))},outfile:dir+'/harness.mjs',bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',plugins:[{name:'synthetic-private-client',setup(b){b.onResolve({filter:/cheshireSupabase$/},()=>({path:'mock-client',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const cheshireSupabase=globalThis.__intakeFreshnessClient;',loader:'js'}));}}],logLevel:'silent'});
  const {Harness}=await import(pathToFileURL(dir+'/harness.mjs'));const read=()=>JSON.parse(renderer.toJSON().children[0]);const flush=()=>act(async()=>{await new Promise(resolve=>setTimeout(resolve,10))});
  await act(async()=>{renderer=create(React.createElement(Harness))});await flush();assert.equal(read().state,'ready');assert.equal(read().items.payroll,'complete');assert(selections[0].includes('review_revision'));assert(selections[0].includes('validation_dependency_revisions'));assert(!selections[0].includes('review_token'));
  rows[0].review_revision='cccccccc-1111-4111-8111-111111111111';await act(async()=>globalThis.__intakeFreshnessContext.refresh());await flush();assert.equal(read().state,'ready');assert.equal(read().items.coverage_manifest,'complete');assert.equal(read().items.payroll,'incomplete');
  rows=rows.map(({review_revision,validation_dependency_revisions,...row})=>row);await act(async()=>globalThis.__intakeFreshnessContext.refresh());await flush();assert.equal(read().state,'ready');assert.equal(read().items.coverage_manifest,'incomplete');assert.equal(read().items.payroll,'incomplete');
 }finally{if(renderer)await act(async()=>renderer.unmount());await rm(dir,{recursive:true,force:true});delete globalThis.__intakeFreshnessContext;delete globalThis.__intakeFreshnessClient;delete globalThis.IS_REACT_ACT_ENVIRONMENT;}
});
