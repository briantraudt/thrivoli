import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseTherapistRoster, readTherapistRoster } from '../src/cheshire/therapistRoster.ts';

const hash = 'a'.repeat(64);
const audit = () => ({ version:'therapist-roster-v1', source_sha256:hash, provider_period:{start:'2026-01-01',end:'2026-10-31'}, rows:[
  {id:'provider_aaaaaaaaaaaaaaaa',display_name:'Synthetic Provider Alpha',payroll_candidate_name:'Synthetic Employee Alpha',match_status:'candidate_full_name'},
  {id:'provider_bbbbbbbbbbbbbbbb',display_name:'Synthetic Provider Beta',payroll_candidate_name:null,match_status:'no_payroll_candidate'},
] });
const doc = () => ({id:'synthetic-roster',source_type:'staff_allocation',source_origin:'existing_source',status:'incomplete',requested_month:null,reported_month:null,storage_path:null,content_sha256:hash,validation:{validator_version:'source-audit-v1',status:'incomplete',therapist_roster_audit:audit()}});

test('private roster preserves provisional candidates and missing links without financial attribution', () => {
  const result=readTherapistRoster([doc()]);
  assert.equal(result.issue,null); assert.equal(result.roster.rows.length,2);
  assert.equal(result.roster.rows[0].matchStatus,'candidate_full_name');
  assert.equal(result.roster.rows[1].payrollCandidateName,null);
  assert.equal('profit' in result.roster.rows[0],false);
  assert.deepEqual(readTherapistRoster([]),{roster:null,issue:null});
});
test('roster rejects invalid hashes, identities, names, dates and unrecognized fields', () => {
  for(const mutate of [a=>a.source_sha256='b'.repeat(64),a=>a.rows[1].id=a.rows[0].id,a=>a.rows[1].display_name=a.rows[0].display_name.toLowerCase(),a=>a.rows[0].display_name='<script>',a=>a.rows[0].display_name='fake@example.test',a=>a.rows[0].match_status='confirmed',a=>a.rows[0].match_status=['candidate_full_name'],a=>a.rows[1].payroll_candidate_name='Synthetic Employee Beta',a=>a.rows[0].payroll_candidate_name=null,a=>a.rows[0].profit=1,a=>a.provider_period.end='2026-02-30',a=>a.provider_period.start='2027-01-01',a=>a.rows=[]]) {
    const a=audit();mutate(a);assert.throws(()=>parseTherapistRoster(a,hash));
  }
});
test('roster fails closed on invalid envelopes and competing source audits', () => {
  for(const mutate of [d=>d.source_type='payroll',d=>d.status='accepted',d=>d.source_origin='upload',d=>d.requested_month='2026-10-01',d=>d.reported_month='2026-10-01',d=>d.storage_path='private/file',d=>d.validation.validator_version='wrong',d=>d.validation.status='accepted']) {
    const d=doc();mutate(d);assert.equal(readTherapistRoster([d]).roster,null);assert.equal(readTherapistRoster([d]).issue,'Roster review required');
  }
  const second=doc();second.id='other';second.content_sha256='b'.repeat(64);second.validation.therapist_roster_audit.source_sha256=second.content_sha256;
  assert.equal(readTherapistRoster([doc(),second]).roster,null);
  second.supersedes_id='synthetic-roster';assert.equal(readTherapistRoster([doc(),second]).roster.sourceHash,second.content_sha256);
  const duplicate=doc();duplicate.id='duplicate';assert.equal(readTherapistRoster([doc(),duplicate]).roster.rows.length,2);
  duplicate.validation.therapist_roster_audit.rows[0].display_name='Synthetic Other Provider';assert.equal(readTherapistRoster([doc(),duplicate]).roster,null);
});
test('therapist component shows private candidate detail only for accessible roster and leaves profit unavailable', async () => {
  const root=fileURLToPath(new URL('../',import.meta.url));await mkdir(root+'node_modules/.cache/',{recursive:true});const dir=await mkdtemp(root+'node_modules/.cache/roster-');
  try {
    await build({entryPoints:[root+'src/cheshire/CheshireTherapistProfitability.tsx'],outfile:dir+'/component.mjs',bundle:true,platform:'node',format:'esm',packages:'external',loader:{'.css':'empty'},jsx:'automatic'});
    const {CheshireTherapistProfitability}=await import(pathToFileURL(dir+'/component.mjs').href);
    const roster=parseTherapistRoster(audit(),hash);
    const render=props=>renderToStaticMarkup(React.createElement(CheshireTherapistProfitability,{roster,selectedId:'all',...props}));
    const all=render({});assert.match(all,/id="therapist-profitability"/);assert.match(all,/<details/);assert.match(all,/1 unverified payroll candidates/);assert.match(all,/1 without a payroll name candidate/);assert.match(all,/Unverified name candidate/);assert.match(all,/Profit unavailable/);
    const selected=render({selectedId:roster.rows[1].id});assert.match(selected,/Synthetic Provider Beta/);assert.doesNotMatch(selected,/Synthetic Provider Alpha|<details/);assert.match(selected,/No name candidate/);
    for(const sourceState of ['Checking','Source unavailable','Access required']) assert.doesNotMatch(render({sourceState}),/Synthetic Provider|Synthetic Employee/);
    assert.doesNotMatch(render({issue:'Roster review required'}),/Synthetic Provider|Synthetic Employee/);
    assert.match(render({selectedId:'provider_cccccccccccccccc'}),/Selected therapist is not in this roster/);
  } finally {await rm(dir,{recursive:true,force:true});}
});

const auditV2 = () => {
  const a=audit();a.version='therapist-roster-v2';
  a.rows=a.rows.map((r,i)=>({...r,entity_kind:'person',zip_status:i===0?'candidate':'not_found',zip_workbook:i===0?'Synthetic A.xlsx':null,revenue_status:'present',payment_status:i===0?'present':'present_zero'}));
  a.rows[0].match_status='candidate_alias';
  a.rows.push({id:'provider_cccccccccccccccc',display_name:'Synthetic Room',payroll_candidate_name:null,match_status:'not_applicable',entity_kind:'resource',zip_status:'not_found',zip_workbook:null,revenue_status:'present',payment_status:'absent'});
  return a;
};
test('v2 distinguishes alias, ZIP candidate, known zero payment and resource without confirming links',()=>{
  const roster=parseTherapistRoster(auditV2(),hash);
  const alias=roster.rows.find(r=>r.matchStatus==='candidate_alias');
  assert.equal(alias.zipStatus,'candidate');assert.equal(alias.zipWorkbook,'Synthetic A.xlsx');
  assert.equal(roster.rows.find(r=>r.displayName==='Synthetic Provider Beta').paymentStatus,'present_zero');
  assert.equal(roster.rows.find(r=>r.entityKind==='resource').paymentStatus,'absent');
  for(const mutate of [a=>a.rows[0].zip_status=['candidate'],a=>a.rows[0].zip_workbook=null,a=>a.rows[1].zip_workbook='extra.xlsx',a=>a.rows[0].payment_status='zero',a=>a.rows[2].match_status='no_payroll_candidate',a=>a.rows[0].entity_kind='resource',a=>a.rows[0].revenue_status=true,a=>a.version=['therapist-roster-v2']]) {const a=auditV2();mutate(a);assert.throws(()=>parseTherapistRoster(a,hash));}
});
test('v2 component separates source availability from unconfirmed aliases and non-therapist resources',async()=>{
  const root=fileURLToPath(new URL('../',import.meta.url));const dir=await mkdtemp(root+'node_modules/.cache/roster-v2-');
  try {
    await build({entryPoints:[root+'src/cheshire/CheshireTherapistProfitability.tsx'],outfile:dir+'/component.mjs',bundle:true,platform:'node',format:'esm',packages:'external',loader:{'.css':'empty'},jsx:'automatic'});
    const {CheshireTherapistProfitability}=await import(pathToFileURL(dir+'/component.mjs').href);
    const roster=parseTherapistRoster(auditV2(),hash);
    const render=selectedId=>renderToStaticMarkup(React.createElement(CheshireTherapistProfitability,{roster,selectedId}));
    const all=render('all');assert.match(all,/2 therapists/);assert.match(all,/Resource labels \(1\)/);assert.match(all,/Possible alias · unconfirmed/);assert.match(all,/Source record present · \$0/);assert.match(all,/No source row found/);assert.match(all,/owner unconfirmed/);assert.match(all,/No corresponding named workbook found/);assert.equal((all.match(/aria-label="Profit unavailable"/g)||[]).length,2);
    assert.doesNotMatch(render('provider_cccccccccccccccc'),/Synthetic Room/);
  } finally {await rm(dir,{recursive:true,force:true});}
});
