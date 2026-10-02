import test from 'node:test';import assert from 'node:assert/strict';
import {parseCumulativeReport,cumulativeScopeTotals,cumulativeReportsForPeriod,cumulativeRevenueSummary} from '../supabase/functions/_shared/cheshire-cumulative.ts';
import {readCumulativeReports} from '../src/cheshire/cumulativeReports.ts';
import {cumulativeFixture} from './helpers/cumulative-fixture.mjs';
const clone=x=>structuredClone(x);
test('cumulative leaves reconcile once, preserve source zero and never acquire an absent scope',()=>{
 const r=parseCumulativeReport(cumulativeFixture());assert.equal(cumulativeScopeTotals(r,'Cheshire').total_payments,14000);assert.equal(cumulativeScopeTotals(r,'Pool'),null);assert.equal(cumulativeScopeTotals(r,'all','OT'),null);assert.equal(cumulativeScopeTotals(r,'all').visits,2);
 const zero=clone(r);zero.rows[0].values={visits:0,insurance_payments:0,patient_payments:0,total_payments:0};zero.totals={...zero.rows[0].values};assert.equal(cumulativeScopeTotals(parseCumulativeReport(zero),'all').total_payments,0);
});
test('cumulative reports appear only in compatible YTD, never MTD or earlier months/years',()=>{
 const r=cumulativeFixture();assert.equal(cumulativeReportsForPeriod([r],'mtd','2026-10').length,0);assert.equal(cumulativeReportsForPeriod([r],'ytd','2026-09').length,0);assert.equal(cumulativeReportsForPeriod([r],'ytd','2027-10').length,0);assert.equal(cumulativeReportsForPeriod([r],'ytd','2026-10')[0].period.end,'2026-10-02');assert.equal(cumulativeReportsForPeriod([r],'ytd','2026-12')[0].period.end,'2026-10-02','later selections retain exact observed cutoff rather than claiming extended coverage');
 assert.equal(cumulativeReportsForPeriod([r,clone(r)],'ytd','2026-10').length,1);const conflict=clone(r);conflict.source.sha256='b'.repeat(64);assert.equal(cumulativeReportsForPeriod([r,conflict],'ytd','2026-10').length,0);
});
test('different financial bases are never added; provider collections cannot be allocated to location or therapy',()=>{
 const provider=cumulativeFixture('provider_posted_payments'),insurance=cumulativeFixture(),facility=cumulativeFixture('facility_reported_activity');const reports=[facility,insurance,provider];assert.equal(cumulativeRevenueSummary(reports,'all').value,14000);assert.equal(cumulativeRevenueSummary(reports,'all').report.kind,'facility_reported_activity');assert.equal(cumulativeRevenueSummary(reports,'Cheshire').report.kind,'facility_reported_activity');assert.equal(cumulativeRevenueSummary([facility],'all').report.period.basis,'unresolved_title_filter');assert.equal(cumulativeRevenueSummary(reports,'Pool').value,null);assert.equal(cumulativeScopeTotals(provider,'Pool'),null);assert.equal(cumulativeScopeTotals(provider,'all','PT'),null);
});
test('reject malformed provenance, non-YTD date ranges, subtotal duplication, broken controls and inferred dimensions',()=>{
 for(const change of [r=>r.source.sha256='invalid',r=>r.period.end='2026-02-30',r=>r.period.start='2026-02-01',r=>r.period.basis='payment_posting_date',r=>r.rows.push(clone(r.rows[0])),r=>r.rows[0].values.insurance_payments++,r=>r.totals.total_payments++,r=>r.rows[0].values.visits=-1,r=>r.control_total={source:r.rows[0].source,values:r.totals}]){const r=cumulativeFixture();change(r);assert.throws(()=>parseCumulativeReport(r));}
 const provider=cumulativeFixture('provider_posted_payments');provider.rows[0].location='Pool';assert.throws(()=>parseCumulativeReport(provider));const badControl=cumulativeFixture('provider_posted_payments');badControl.control_total.values.total_payments++;assert.throws(()=>parseCumulativeReport(badControl));assert.throws(()=>parseCumulativeReport(cumulativeFixture(),'b'.repeat(64)));
});
test('signed payment/adjustment values are source facts, and unposted blanks remain null at facility grain',()=>{
 const r=cumulativeFixture('provider_posted_payments');r.rows[0].values={insurance_payments:-100,patient_payments:20,total_payments:-80};r.totals={...r.rows[0].values};r.control_total.values={...r.rows[0].values};assert.equal(cumulativeScopeTotals(parseCumulativeReport(r),'all').total_payments,-80);
 const f=parseCumulativeReport(cumulativeFixture('facility_reported_activity'));assert.equal(f.unposted.find(row=>row.location==='Cromwell').value,null);assert.equal(f.unposted.find(row=>row.location==='Pool').value,0);assert.equal('unposted' in cumulativeScopeTotals(f,'all'),false);
});
test('only protected reviewed existing-source envelopes can populate cumulative views',()=>{
 const report=cumulativeFixture();const doc={id:'synthetic',content_sha256:report.source.sha256,status:'incomplete',source_origin:'existing_source',requested_month:null,reported_month:null,storage_path:null,validation:{validator_version:'source-audit-v1',cumulative_report:report}};assert.equal(readCumulativeReports([doc],'ytd','2026-10').length,1);
 for(const invalid of[{...doc,status:'complete'},{...doc,source_origin:'portal_upload'},{...doc,requested_month:'2026-10'},{...doc,content_sha256:'b'.repeat(64)}])assert.equal(readCumulativeReports([invalid],'ytd','2026-10').length,0);
 assert.equal(readCumulativeReports([doc,{...doc,id:'replacement',supersedes_id:'synthetic',validation:null}],'ytd','2026-10').length,0);
});

test('approved fixed overhead estimate counts full October without inventing unknown cells or profit',async()=>{
 const{estimatedFixedOverhead}=await import('../src/cheshire/overheadEstimate.ts');const{parseFinanceSnapshot,LOCATIONS,CATEGORIES}=await import('../src/cheshire/finance.ts');const snapshot=parseFinanceSnapshot({source_name:'Synthetic',cadence:'monthly',effective_month:null,imported_at:'2026-10-02T00:00:00Z',cost_basis:'fixed_monthly_baseline',basis_note:'Synthetic confirmed baseline',basis_confirmed_at:'2026-10-02T00:00:00Z',overhead_rows:LOCATIONS.flatMap((location,i)=>CATEGORIES.map((category,j)=>({location,category,sourceCell:String.fromCharCode(68+i)+(j+5),amount:i===0&&j===0?null:'1'})))});
 const mtd=estimatedFixedOverhead(snapshot,'mtd','2026-10','all');const ytd=estimatedFixedOverhead(snapshot,'ytd','2026-10','all');assert.equal(mtd.value,13900);assert.equal(ytd.value,139000);assert.equal(ytd.missingCells,1);assert.equal(ytd.months,10);assert.equal(estimatedFixedOverhead(snapshot,'ytd','2026-10','Cheshire').value,19000);assert.equal(estimatedFixedOverhead(snapshot,'ytd','2026-11','all'),null);assert.equal(estimatedFixedOverhead(snapshot,'ytd','2025-10','all'),null);assert.equal(estimatedFixedOverhead({...snapshot,costBasis:'monthly_source'},'ytd','2026-10','all'),null);
});
