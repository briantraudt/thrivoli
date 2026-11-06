import test from 'node:test';
import assert from 'node:assert/strict';
import { schoolRevenueObservation, supportedSchoolIntervals } from '../src/cheshire/schoolRevenueObservation.ts';
import { schoolAuditFixture } from './helpers/school-income-fixture.mjs';
const fixture = () => {
  const audit = schoolAuditFixture();
  audit.sheets[0].controls = [
    {ref:'C62',state:'number',value:'20.50',formula:'=SUM(C4:C60)'},
    {ref:'O62',state:'number',value:'40',formula:'=SUM(O4:O60)'},
  ];
  return {source:{audit,documentId:'fictional'},issue:null};
};
const ytd = Array.from({length:11},(_,i)=>`2026-${String(i+1).padStart(2,'0')}`);
test('reports supported partial workbook intervals without splitting combined months',()=>{
 const result=fixture();
 assert.equal(schoolRevenueObservation(result,ytd).cents,6050);
 assert.match(schoolRevenueObservation(result,ytd).note,/partial workbook.*currency and billed\/collected basis unconfirmed/);
 assert.equal(schoolRevenueObservation(result,['2026-07']),null);
 assert.equal(schoolRevenueObservation(result,['2026-08']),null);
 assert.equal(schoolRevenueObservation(result,['2026-07','2026-08']).cents,4000);
 assert.equal(schoolRevenueObservation(result,['2026-09']),null);
 assert.equal(schoolRevenueObservation(result,ytd,4).cents,3025);
 assert.equal(schoolRevenueObservation(result,ytd,99),null);
});
test('quarantines unmatched controls and numeric rows omitted by control ranges',()=>{
 const result=fixture();const sheet=result.source.audit.sheets[0];
 sheet.rows[0].values[8].income={ref:'S4',state:'number',value:'7',formula:null};
 sheet.controls.push({ref:'S62',state:'number',value:'0',formula:'=SUM(S5:S60)'});
 assert.deepEqual(supportedSchoolIntervals(sheet),[0,6]);
 assert.equal(schoolRevenueObservation(result,ytd).cents,6050);
 assert.equal(schoolRevenueObservation(result,['2026-10']),null);
 sheet.rows[0].values[8].income.value='0';assert.ok(supportedSchoolIntervals(sheet).includes(8));
 sheet.controls[0].value='21';assert.equal(schoolRevenueObservation(result,ytd).cents,4000);
 sheet.controls=[];assert.equal(schoolRevenueObservation(result,ytd),null);
});
test('fails closed on missing sources, validation errors and other source years',()=>{
 assert.equal(schoolRevenueObservation({source:null,issue:null},ytd),null);
 assert.equal(schoolRevenueObservation({...fixture(),issue:'Invalid'},ytd),null);
 assert.equal(schoolRevenueObservation(fixture(),['2027-01']),null);
});
