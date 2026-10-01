import test from 'node:test';
import assert from 'node:assert/strict';
import {parseIntakeDocuments,buildMonthlyChecklist} from '../src/cheshire/intake.ts';
import {REQUIRED_CHECKS} from '../supabase/functions/_shared/cheshire-intake.ts';
const month='2026-09',hash='a'.repeat(64);
const revision=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const validation={validator_version:'cheshire-intake-v1',status:'complete',reported_month:month,missing_items:[],covered_locations:[],canonical_fields:[],row_count:1,checks:REQUIRED_CHECKS.map(key=>({key,passed:true,message:'Synthetic evidence'}))};
function fixture(){
 const document=(id,source,version,deps={},revisions={})=>({id,source_type:source,review_revision:version,requested_month:month+'-01',reported_month:month+'-01',file_name:'synthetic.csv',content_sha256:hash,status:'complete',created_at:'2026-09-01T00:00:00Z',source_origin:'portal_upload',validation:structuredClone(validation),validation_dependencies:deps,validation_dependency_revisions:revisions});
 const manifest=document('manifest','coverage_manifest',revision(1));
 const payroll=document('payroll','payroll',revision(2),{coverage_manifest:`manifest:${hash}`},{coverage_manifest:manifest.review_revision});
 const allocation=document('allocation','staff_allocation',revision(3),{...payroll.validation_dependencies,payroll:`payroll:${hash}`},{...payroll.validation_dependency_revisions,payroll:payroll.review_revision});
 return [manifest,payroll,allocation];
}
const items=(docs,snapshot=null)=>Object.fromEntries(buildMonthlyChecklist(parseIntakeDocuments(docs),month,snapshot).map(item=>[item.id,item]));
test('current review versions keep manifest, payroll and allocation complete',()=>{const result=items(fixture());for(const kind of ['coverage_manifest','payroll','staff_allocation'])assert.equal(result[kind].status,'complete');});
test('same-byte manifest re-review invalidates payroll and allocation until dependency-order rechecks',()=>{
 const docs=fixture();docs[0].review_revision=revision(4);let result=items(docs);assert.equal(result.coverage_manifest.status,'complete');assert.equal(result.payroll.status,'incomplete');assert.equal(result.staff_allocation.status,'incomplete');assert.match(result.payroll.missing.join(' '),/supporting source/);
 docs[1].validation_dependency_revisions.coverage_manifest=docs[0].review_revision;docs[1].review_revision=revision(5);result=items(docs);assert.equal(result.payroll.status,'complete');assert.equal(result.staff_allocation.status,'incomplete');
 docs[2].validation_dependency_revisions={coverage_manifest:docs[0].review_revision,payroll:docs[1].review_revision};docs[2].review_revision=revision(6);assert.equal(items(docs).staff_allocation.status,'complete');
});
test('same-byte payroll re-review invalidates allocation without invalidating payroll',()=>{const docs=fixture();docs[1].review_revision=revision(5);const result=items(docs);assert.equal(result.payroll.status,'complete');assert.equal(result.staff_allocation.status,'incomplete');});
test('allocation direct versions cannot hide a transitively stale payroll',()=>{const docs=fixture();docs[0].review_revision=revision(4);docs[2].validation_dependency_revisions.coverage_manifest=docs[0].review_revision;assert.equal(items(docs).staff_allocation.status,'incomplete');});
test('missing revisions, changed content, interrupted reviews, ambiguity, supersession and wrong-month dependencies fail closed',()=>{
 for(const change of [
  docs=>{delete docs[0].review_revision},docs=>{delete docs[1].review_revision},docs=>{delete docs[1].validation_dependency_revisions},docs=>{docs[1].validation_dependency_revisions={}},docs=>{docs[0].content_sha256='b'.repeat(64)},
  docs=>{docs[0].status='reviewing'},docs=>{docs[0].status='error'},docs=>{docs[0].requested_month='2026-08-01'},docs=>{docs[0].validation.checks[0].passed=false},
  docs=>docs.push({...docs[0],id:'duplicate'}),docs=>docs.push({...docs[0],id:'replacement',supersedes_id:'manifest',status:'uploading'}),
 ]){const docs=fixture();change(docs);const result=items(docs);assert.equal(result.payroll.status,'incomplete');assert.equal(result.staff_allocation.status,'incomplete');}
 const legacy=fixture().map(({review_revision,validation_dependency_revisions,...doc})=>doc);for(const kind of ['coverage_manifest','payroll','staff_allocation'])assert.equal(items(legacy)[kind].status,'incomplete');
});
test('untrusted or malformed revision metadata is rejected before display',()=>{
 for(const value of [42,{},'not-a-revision'])assert.throws(()=>parseIntakeDocuments([{...fixture()[0],review_revision:value}]),/review revision/);
 for(const value of [42,[],{coverage_manifest:'not-a-revision'},{unknown:revision(1)}])assert.throws(()=>parseIntakeDocuments([{...fixture()[1],validation_dependency_revisions:value}]),/supporting review revisions/);
});

test('completed replacement with identical bytes requires the new supporting document ID',()=>{const docs=fixture();docs.push({...docs[0],id:'replacement',supersedes_id:docs[0].id});let result=items(docs);assert.equal(result.coverage_manifest.status,'complete');assert.equal(result.payroll.status,'incomplete');assert.equal(result.staff_allocation.status,'incomplete');docs[1].validation_dependencies.coverage_manifest=`replacement:${hash}`;assert.equal(items(docs).payroll.status,'complete');});
test('operating expenses require current manifest and matching overhead revision; missing reference fails closed',()=>{
 const docs=fixture().slice(0,2);docs[1]={...docs[1],id:'expenses',source_type:'operating_expenses',validation_dependencies:{...docs[1].validation_dependencies,overhead_reference:'current-overhead'}};
 // The snapshot's overhead-specific figures are irrelevant to this expense revision comparison.
 const snapshot={revisionId:'current-overhead',costBasis:'fixed_monthly_baseline',rows:[]};
 for(const reference of [null,{...snapshot,revisionId:'changed'}, {...snapshot,revisionId:''}])assert.equal(items(docs,reference).operating_expenses.status,'incomplete');
 assert.equal(items(docs,snapshot).operating_expenses.status,'complete');delete docs[1].validation_dependencies.overhead_reference;assert.equal(items(docs,snapshot).operating_expenses.status,'incomplete');
});
