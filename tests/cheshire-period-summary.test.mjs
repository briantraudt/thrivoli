import test from 'node:test';import assert from 'node:assert/strict';
import{buildPeriodSheet,reportingMonths,createRequestQueue}from'../src/cheshire/periodSummary.ts';
import{LOCATIONS,CATEGORIES,parseFinanceSnapshot}from'../src/cheshire/finance.ts';
import{METRICS}from'../supabase/functions/_shared/cheshire-metrics.ts';
const response=(month,value,key='cash_program_income',basis='program_reported_month')=>({month,location:'all',sources:[{source_type:key==='cash_program_income'?'cash_programs':'insurance_revenue',document_id:`synthetic-${month}`,content_sha256:'a'.repeat(64),validator_version:'cheshire-intake-v1',normalizer_version:'cheshire-metrics-v1',metrics:[{key,...METRICS[key],value,basis,source_rows:1,source_locations:['Cheshire']}]}],blocked:[]});
const row=(sheet,id)=>sheet.flatMap(group=>group.rows).find(item=>item.id===id);
const source=()=>parseFinanceSnapshot({source_name:'Synthetic reference',cost_basis:'fixed_monthly_baseline',basis_note:'Synthetic confirmation',basis_confirmed_at:'2026-01-01T12:00:00Z',cadence:'monthly',effective_month:null,imported_at:'2026-01-01T12:00:00Z',overhead_rows:LOCATIONS.flatMap((location,i)=>CATEGORIES.map((category,j)=>({location,category,sourceCell:String.fromCharCode(68+i)+(j+5),amount:'1'})))});
test('period filters request only the selected month or bounded January-through-month range',()=>{assert.deepEqual(reportingMonths('mtd','2026-10'),['2026-10']);assert.equal(reportingMonths('ytd','2026-10').length,10);assert.equal(reportingMonths('ytd','2026-12').length,12);assert.throws(()=>reportingMonths('ytd','2026-13'));});
test('YTD adds same-basis source flows only, labels missing months and preserves observed zero/provenance',()=>{
 const evidence={scope:'all',months:['2026-01','2026-02','2026-03'],responses:{'2026-01':response('2026-01',100),'2026-03':response('2026-03',0)},failedMonths:[]};
 const sheet=buildPeriodSheet(source(),evidence,[]);const value=row(sheet,'programs').cells.all;
 assert.equal(value.value,100);assert.equal(value.coverageLabel,'2/3 months · partial');assert.match(value.note,/Missing months: 2026-02/);assert.match(value.source,/synthetic-2026-01[\s\S]*synthetic-2026-03/);assert.match(value.note,/daily as-of cutoff has not been verified/);
 assert.equal(row(sheet,'known-overhead').cells.all.value,14000,'fixed reference must not be multiplied by three months');assert.match(row(sheet,'known-overhead').detail,/not period actuals/);
 for(const id of['revenue-total','cost-total','profit'])assert.equal(row(sheet,id).cells.all.value,null);
});
test('report-as-of snapshots use latest available snapshot and are never summed into YTD',()=>{
 const evidence={scope:'all',months:['2026-01','2026-02'],responses:{'2026-01':response('2026-01',100,'insurance_payments','report_as_of'),'2026-02':response('2026-02',250,'insurance_payments','report_as_of')},failedMonths:[]};const sheet=buildPeriodSheet(null,evidence,[]);assert.equal(row(sheet,'insurance-as-of').cells.all.value,250);assert.match(row(sheet,'insurance-as-of').cells.all.coverageLabel,/snapshot · not YTD/);assert.match(row(sheet,'insurance-as-of').cells.all.note,/Snapshots are not added/);assert.equal(sheet[0].rows.at(-1).id,'revenue-total');
});
test('wrong months/scopes, duplicate coverage and overflowing source sums fail closed',()=>{
 const base={scope:'all',months:['2026-01'],responses:{'2026-01':response('2026-02',100)},failedMonths:[]};assert.throws(()=>buildPeriodSheet(null,base,[]));assert.throws(()=>buildPeriodSheet(null,{...base,months:['2026-01','2026-01'],responses:{}},[]));assert.throws(()=>buildPeriodSheet(null,{...base,scope:'Pool'},[]));
 const large={scope:'all',months:['2026-01','2026-02'],responses:{'2026-01':response('2026-01',Number.MAX_SAFE_INTEGER),'2026-02':response('2026-02',10)},failedMonths:[]};assert.equal(row(buildPeriodSheet(null,large,[]),'programs').cells.all.value,null);
});
test('bounded queue never runs more than three requests and skips cancelled queued work',async()=>{let live=true,active=0,max=0,started=0;const releases=[];const queue=createRequestQueue(3);const work=()=>new Promise(resolve=>{active++;started++;max=Math.max(max,active);releases.push(()=>{active--;resolve(started);});});const promises=Array.from({length:12},()=>queue.run(work,()=>live));assert.equal(started,3);live=false;releases.forEach(release=>release());const result=await Promise.all(promises);assert.equal(max,3);assert.equal(started,3);assert.equal(result.filter(value=>value===null).length,9);});
