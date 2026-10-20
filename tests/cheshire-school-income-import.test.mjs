import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';
import {prepareSchoolIncomeDocument,schoolIncomeImportSQL} from '../scripts/prepare-school-income-import.mjs';
import {schoolAuditFixture} from './helpers/school-income-fixture.mjs';
test('private school import inserts atomically, identical replay does nothing, conflicts and overlap reject',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create table public.cheshire_intake_document(id uuid primary key,source_type text,source_origin text,status text,requested_month date,reported_month date,storage_path text,file_name text,content_sha256 text,byte_size integer,mime_type text,no_phi_attested_at timestamptz,reviewed_at timestamptz,review_revision uuid,source_period_label text,source_scope_label text,figure_unlocked text,validation jsonb,supersedes_id uuid);create unique index dedup on public.cheshire_intake_document(source_type,coalesce(requested_month,date '0001-01-01'),content_sha256);`);
  const input=schoolAuditFixture();input.sheets[0].notes.push("Literal $school_guard$; drop table never_execute; --");
  const sql=schoolIncomeImportSQL(prepareSchoolIncomeDocument(input));
  await db.exec(sql);const before=(await db.query('select * from public.cheshire_intake_document')).rows;
  assert.equal(before.length,1);assert.equal(before[0].status,'incomplete');
  await db.exec(schoolIncomeImportSQL(prepareSchoolIncomeDocument(input,'2026-10-01T00:00:00Z')));
  assert.deepEqual((await db.query('select * from public.cheshire_intake_document')).rows,before);
  const conflict=structuredClone(input);conflict.sheets[0].notes.push('Changed evidence');
  await assert.rejects(db.exec(schoolIncomeImportSQL(prepareSchoolIncomeDocument(conflict))),/Conflicting same-hash/);await db.exec('rollback');
  const overlap=structuredClone(input);overlap.source.sha256='b'.repeat(64);
  await assert.rejects(db.exec(schoolIncomeImportSQL(prepareSchoolIncomeDocument(overlap))),/Overlapping school source/);await db.exec('rollback');
  const malformed=schoolIncomeImportSQL(prepareSchoolIncomeDocument(overlap)).replace('"rawHundredths":"6050"','"rawHundredths":"6051"');
  await assert.rejects(db.exec(malformed),/arithmetic failed/);await db.exec('rollback');
  assert.deepEqual((await db.query('select * from public.cheshire_intake_document')).rows,before);
  assert.doesNotMatch(sql,/create policy|grant |alter table|update public\.cheshire_intake_document|delete from/i);
  const bad=prepareSchoolIncomeDocument(input);bad.status='complete';assert.throws(()=>schoolIncomeImportSQL(bad),/envelope/);
 }finally{await db.close()}
});
