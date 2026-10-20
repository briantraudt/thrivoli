import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSchoolIncomeAudit, schoolAmount, schoolUnits, schoolPeriodTotal, selectedSchoolPeriods } from '../supabase/functions/_shared/cheshire-school-income.ts';
import { readSchoolIncomeSource } from '../src/cheshire/schoolIncomeSource.ts';
import { parseIntakeDocuments, buildMonthlyChecklist } from '../src/cheshire/intake.ts';
import { schoolAuditFixture, schoolDocumentFixture } from './helpers/school-income-fixture.mjs';

test('school source retains repeated labels, exact signed values and source-cell states',()=>{
  const a=schoolAuditFixture(); const sh=a.sheets[0];
  sh.rows[0].values[0].income.value='-10.25';sh.rawHundredths='4000';
  const parsed=parseSchoolIncomeAudit(a,'a'.repeat(64));
  assert.equal(parsed.sheets[0].rows.length,2);
  assert.equal(schoolAmount(schoolUnits('-10.25')),'-10.25');
  assert.equal(schoolPeriodTotal(parsed.sheets[0],[0]).hundredths,0n);
  assert.equal(schoolPeriodTotal(parsed.sheets[0],[1]).hundredths,null);
  sh.rows[0].values[1].income={ref:'E4',state:'error',value:'#VALUE!',formula:'=-V3'};
  sh.rows[1].values[1].income={ref:'E5',state:'dash',value:'-',formula:null};sh.populatedPairs+=2;
  const errors=parseSchoolIncomeAudit(a).sheets[0];
  assert.equal(schoolPeriodTotal(errors,[1]).errors,1);assert.equal(schoolPeriodTotal(errors,[1]).dashes,1);
  assert.equal(errors.rows[0].values[1].income.formula,'=-V3');
});
test('combined July/August and ambiguous December cannot become invented monthly income',()=>{
  const sh=parseSchoolIncomeAudit(schoolAuditFixture({leading:true})).sheets[0];
  const selected=(mode,m)=>selectedSchoolPeriods(sh,mode,m).map(p=>p.i);
  assert.equal(schoolPeriodTotal(sh,selected('ytd',7)).hundredths,2050n);
  assert.equal(schoolPeriodTotal(sh,selected('ytd',8)).hundredths,6050n);
  assert.equal(schoolPeriodTotal(sh,selected('mtd',7)).hundredths,null);
  assert.equal(schoolPeriodTotal(sh,selected('mtd',8)).hundredths,null);
  assert.equal(schoolPeriodTotal(sh,selected('ytd',12)).hundredths,6050n);
});
test('malformed and unverified school inputs fail closed',()=>{
  for(const change of [
    a=>{a.currency='USD'},a=>{a.source.sha256='invalid'},a=>{a.source.bank_account='hidden'},
    a=>{a.sheets[0].rows[0].ssn='private'},a=>{a.sheets[0].rawHundredths='1'},
    a=>{a.sheets[0].numericCells++},a=>{a.sheets[0].populatedPairs++},
    a=>{a.sheets[0].rows[1].row=4},a=>{a.sheets[0].rows[0].values.pop()},
    a=>{a.sheets[0].rows[0].values[0].income.ref='C5'},
    a=>{a.sheets[0].rows[0].values[0].income.value='1.001'},
    a=>{a.sheets[0].rows[0].values[0].income.value='1e2'},
    a=>{a.sheets[0].rows[0].values[0].income.value='900719925474099.99'},
    a=>{a.sheets[0].rows[0].values[1].income.value='0'},
    a=>{a.sheets[0].periods[6].end=7},
    a=>{const s=a.sheets[0];for(const key of ['hoursColumn','incomeColumn'])[s.periods[0][key],s.periods[1][key]]=[s.periods[1][key],s.periods[0][key]];for(const r of s.rows)[r.values[0],r.values[1]]=[r.values[1],r.values[0]]},
    a=>{a.sheets.push(structuredClone(a.sheets[0]))},
  ]){const a=schoolAuditFixture();change(a);assert.throws(()=>parseSchoolIncomeAudit(a))}
});
test('protected source reader blocks invalid, conflicting and overlapping exports without changing checklist',()=>{
  const doc=schoolDocumentFixture();
  assert.ok(readSchoolIncomeSource([doc],'2026-09').source);
  assert.ok(readSchoolIncomeSource([doc,{...doc,id:'identical'}],'2026-09').source);
  const conflict=structuredClone(doc);conflict.validation.school_income_audit.sheets[0].notes.push('Conflicting audit');
  assert.ok(readSchoolIncomeSource([doc,conflict],'2026-09').issue);
  const overlap=structuredClone(doc);overlap.content_sha256='b'.repeat(64);overlap.validation.school_income_audit.source.sha256=overlap.content_sha256;
  assert.ok(readSchoolIncomeSource([doc,overlap],'2026-09').issue);
  for(const patch of [{status:'complete'},{source_origin:'portal_upload'},{requested_month:'2026-09'},{storage_path:'private/path'}]){
    assert.equal(readSchoolIncomeSource([{...doc,...patch}],'2026-09').source,null);
  }
  assert.equal(readSchoolIncomeSource([doc,{...doc,id:'replacement',supersedes_id:doc.id,validation:null}],'2026-09').source,null);
  assert.equal(readSchoolIncomeSource([doc],'2027-01').source,null);
  assert.equal(buildMonthlyChecklist(parseIntakeDocuments([doc]),'2026-09',null).find(r=>r.id==='school_billing').status,'missing');
});
