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
    const all=render({});assert.match(all,/id="therapist-profitability"/);assert.match(all,/<details/);assert.match(all,/0 reviewed payroll matches/);assert.match(all,/1 unconfirmed payroll candidates/);assert.match(all,/1 without a payroll name candidate/);assert.match(all,/Unverified name candidate/);assert.match(all,/Profit unavailable/);
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

const syntheticStaffId = '0000000000000001';
const auditV3 = () => {
  const a=auditV2();a.version='therapist-roster-v3';
  a.rows=a.rows.map(row=>({...row,identity_review:null,review_issue:null}));
  a.rows[0].match_status='reviewed_name_discipline';
  a.rows[0].identity_review={payroll_staff_id:syntheticStaffId,review_basis:'unique_name_and_clinical_discipline',review_date:'2026-11-01'};
  a.rows.push({...a.rows[0],id:'provider_dddddddddddddddd',display_name:'Synthetic Provider Delta',payroll_candidate_name:'Synthetic Employee Delta',match_status:'candidate_full_name',identity_review:null,review_issue:'discipline_conflict'});
  a.rows.push({...a.rows[0],id:'provider_eeeeeeeeeeeeeeee',display_name:'Synthetic Provider Epsilon',payroll_candidate_name:'Synthetic Employee Epsilon',match_status:'candidate_first_surname',identity_review:null,review_issue:'discipline_conflict'});
  a.rows.push({...a.rows[0],id:'provider_ffffffffffffffff',display_name:'Synthetic Provider Zeta',payroll_candidate_name:'Synthetic Employee Zeta',match_status:'candidate_alias',identity_review:null,review_issue:'alias_unverified'});
  return a;
};
test('v3 records reviewed identity evidence separately from unresolved candidates and financial allocation',()=>{
  const a=auditV3(),roster=parseTherapistRoster(a,hash),reviewed=roster.rows.find(r=>r.matchStatus==='reviewed_name_discipline');
  assert.deepEqual(reviewed.identityReview,{payrollStaffId:syntheticStaffId,reviewBasis:'unique_name_and_clinical_discipline',reviewDate:'2026-11-01'});
  assert.equal(reviewed.reviewIssue,null);assert.equal(reviewed.zipStatus,'candidate');
  assert.equal(reviewed.revenueStatus,'present');assert.equal(reviewed.paymentStatus,'present');
  assert.equal('profit' in reviewed,false);assert.equal('payroll' in reviewed,false);
  assert.equal(roster.rows.filter(row=>row.reviewIssue==='discipline_conflict').length,2);
  assert.equal(roster.rows.find(row=>row.matchStatus==='candidate_alias').identityReview,null);
  assert.deepEqual(roster.providerPeriod,a.provider_period);
  for(const legacy of [audit(),auditV2()]) {
    for(const row of parseTherapistRoster(legacy,hash).rows) {
      assert.equal(row.identityReview,null);assert.equal(row.reviewIssue,null);
      assert.notEqual(row.matchStatus,'reviewed_name_discipline');
    }
  }
  const d=doc();d.validation.therapist_roster_audit=a;
  assert.deepEqual(readTherapistRoster([d]),{roster,issue:null});
});
test('v3 strictly validates review fields and rejects implied, contradictory or duplicated confirmations',()=>{
  const invalid=[
    a=>delete a.rows[0].identity_review,
    a=>delete a.rows[0].review_issue,
    a=>a.rows[0].identity_review=null,
    a=>a.rows[0].identity_review=[],
    a=>a.rows[0].identity_review='reviewed',
    a=>a.rows[0].identity_review.payroll_staff_id=1,
    a=>a.rows[0].identity_review.payroll_staff_id='',
    a=>a.rows[0].identity_review.payroll_staff_id='1'.repeat(33),
    a=>a.rows[0].identity_review.payroll_staff_id=' 1',
    a=>a.rows[0].identity_review.payroll_staff_id='1.0',
    a=>a.rows[0].identity_review.payroll_staff_id='staff_1',
    a=>delete a.rows[0].identity_review.payroll_staff_id,
    a=>a.rows[0].identity_review.review_basis='similar_name',
    a=>a.rows[0].identity_review.review_basis=['unique_name_and_clinical_discipline'],
    a=>a.rows[0].identity_review.review_date='2026-02-30',
    a=>a.rows[0].identity_review.review_date='2026-11-01T00:00:00Z',
    a=>a.rows[0].identity_review.review_date=null,
    a=>a.rows[0].identity_review.stable_id_verified=true,
    a=>a.rows[0].identity_review.source_sha256=hash,
    a=>a.rows[0].review_issue='discipline_conflict',
    a=>a.rows[0].review_issue='alias_unverified',
    a=>a.rows[0].review_issue='unknown',
    a=>a.rows[0].review_issue=[],
    a=>a.rows[0].review_issue=undefined,
    a=>a.rows[0].entity_kind='resource',
    a=>a.rows[0].payroll_candidate_name=null,
    a=>a.rows[0].match_status='candidate_full_name',
    a=>a.rows[1].identity_review=a.rows[0].identity_review,
    a=>a.rows[1].review_issue='discipline_conflict',
    a=>a.rows[2].review_issue='alias_unverified',
    a=>a.rows[3].review_issue='alias_unverified',
    a=>a.rows[5].review_issue='discipline_conflict',
    a=>a.rows[5].identity_review=a.rows[0].identity_review,
    a=>{a.rows[3].match_status='reviewed_name_discipline';a.rows[3].review_issue=null;a.rows[3].identity_review=a.rows[0].identity_review;},
    a=>a.rows[0].profit=1,
  ];
  for(const mutate of invalid) {
    const a=auditV3();mutate(a);assert.throws(()=>parseTherapistRoster(a,hash),String(mutate));
    const d=doc();d.validation.therapist_roster_audit=a;
    assert.deepEqual(readTherapistRoster([d]),{roster:null,issue:'Roster review required'});
  }
  for(const legacy of [audit(),auditV2()]) {
    legacy.rows[0].match_status='reviewed_name_discipline';
    assert.throws(()=>parseTherapistRoster(legacy,hash));
  }
  for(const staffId of ['0','1'.repeat(32)]) {
    const a=auditV3();a.rows[0].identity_review.payroll_staff_id=staffId;
    assert.equal(parseTherapistRoster(a,hash).rows[0].identityReview.payrollStaffId,staffId);
  }
});
test('v3 does not infer reviewed status or promote ZIP ownership from names or review holds',()=>{
  const a=auditV3();a.rows[0].match_status='candidate_full_name';a.rows[0].identity_review=null;
  a.rows[0].payroll_candidate_name=a.rows[0].display_name;
  a.rows[5].review_issue=null;
  const roster=parseTherapistRoster(a,hash);
  assert.equal(roster.rows.some(row=>row.matchStatus==='reviewed_name_discipline'),false);
  assert.equal(roster.rows[0].zipStatus,'candidate');
  assert.equal(roster.rows.find(row=>row.matchStatus==='candidate_alias').identityReview,null);
});
test('v3 conflicting review evidence fails closed until the prior audit is explicitly superseded',()=>{
  const first=doc();first.validation.therapist_roster_audit=auditV3();
  const second=structuredClone(first);second.id='synthetic-updated-review';
  second.validation.therapist_roster_audit.rows[0].identity_review.review_date='2026-11-02';
  assert.deepEqual(readTherapistRoster([first,second]),{roster:null,issue:'Roster review required'});
  second.supersedes_id=first.id;
  assert.equal(readTherapistRoster([first,second]).roster.rows[0].identityReview.reviewDate,'2026-11-02');
});
test('v3 UI distinguishes reviewed and unresolved identity while withholding profit and staff IDs',async()=>{
  const root=fileURLToPath(new URL('../',import.meta.url));const dir=await mkdtemp(root+'node_modules/.cache/roster-v3-');
  try {
    await build({entryPoints:[root+'src/cheshire/CheshireTherapistProfitability.tsx'],outfile:dir+'/component.mjs',bundle:true,platform:'node',format:'esm',packages:'external',loader:{'.css':'empty'},jsx:'automatic'});
    const {CheshireTherapistProfitability}=await import(pathToFileURL(dir+'/component.mjs').href);
    const roster=parseTherapistRoster(auditV3(),hash);
    const render=props=>renderToStaticMarkup(React.createElement(CheshireTherapistProfitability,{roster,selectedId:'all',...props}));
    const all=render({});
    for(const pattern of [/1 reviewed payroll matches/,/3 unconfirmed payroll candidates/,/2 source-discipline exceptions/,/1 possible aliases/,/1 without a payroll name candidate/,/5 therapists/,/Resource labels \(1\)/,/Name match · source discipline needs review/,/Possible alias · unconfirmed/]) assert.match(all,pattern);
    assert.equal((all.match(/aria-label="Profit unavailable"/g)||[]).length,5);
    const reviewed=render({selectedId:'provider_aaaaaaaaaaaaaaaa'});
    for(const pattern of [/Reviewed payroll name/,/Reviewed match · name \+ clinical discipline/,/2026-11-01 · stable-ID link not verified/,/owner unconfirmed/,/Revenue\/payroll allocation<\/dt><dd>Not verified/,/Labor allocation<\/dt><dd>Missing/,/aria-label="Profit unavailable">—/]) assert.match(reviewed,pattern);
    assert.doesNotMatch(reviewed,/Unverified name candidate|Synthetic Provider Delta/);
    assert.doesNotMatch(all,new RegExp(syntheticStaffId));
    for(const props of [{sourceState:'Checking'},{sourceState:'Source unavailable'},{sourceState:'Access required'},{issue:'Roster review required'}]) assert.doesNotMatch(render(props),/Synthetic Provider|Synthetic Employee|reviewed payroll matches|Reviewed match/);
    assert.doesNotMatch(render({selectedId:'provider_cccccccccccccccc'}),/Synthetic Room/);
  } finally {await rm(dir,{recursive:true,force:true});}
});
