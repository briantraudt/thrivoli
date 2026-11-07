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
    const all=render({});assert.match(all,/id="therapist-profitability"/);assert.match(all,/<details/);assert.match(all,/1 unverified payroll candidates/);assert.match(all,/1 missing payroll links/);assert.match(all,/Unverified candidate/);assert.match(all,/Profit unavailable/);
    const selected=render({selectedId:roster.rows[1].id});assert.match(selected,/Synthetic Provider Beta/);assert.doesNotMatch(selected,/Synthetic Provider Alpha|<details/);assert.match(selected,/Missing payroll link/);
    for(const sourceState of ['Checking','Source unavailable','Access required']) assert.doesNotMatch(render({sourceState}),/Synthetic Provider|Synthetic Employee/);
    assert.doesNotMatch(render({issue:'Roster review required'}),/Synthetic Provider|Synthetic Employee/);
    assert.match(render({selectedId:'provider_cccccccccccccccc'}),/Selected therapist is not in this roster/);
  } finally {await rm(dir,{recursive:true,force:true});}
});
