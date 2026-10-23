import test from 'node:test';
import assert from 'node:assert/strict';
import { headerPrivacyHit, cellPrivacyHits, privacyRejectionMessage, scanMatrix, UNINSPECTABLE_UPLOAD_MESSAGE } from '../supabase/functions/_shared/cheshire-privacy.ts';
import { screenUploadBytes } from '../supabase/functions/_shared/cheshire-report-mapping.ts';
import { tableFromMatrix, validateTable } from '../supabase/functions/_shared/cheshire-intake.ts';

const blockedHeaders = [
  'Client Name', 'Patient Name', 'First Name', 'Last Name', 'Birth Date', 'DOB',
  'Account #', 'Chart #', 'MRN', 'ICD-10', 'Dx 1', 'Insured ID', 'Policy Number',
  'Guarantor', 'Address', 'Phone', 'Email', 'SSN', 'Student Name',
];

test('patient and student column titles are blocked and ordinary business columns are not', () => {
  for (const header of blockedHeaders) assert.equal(headerPrivacyHit(header), true, header);
  for (const header of ['Account', 'patient_payments', 'Patient Payments', 'Provider ID', 'Therapist', 'Utilities phone', 'Location', 'Program', 'Payer']) {
    assert.equal(headerPrivacyHit(header), false, header);
  }
});

test('free-text cells are scanned without treating reporting dates or service names as patient data', () => {
  assert.ok(cellPrivacyHits('Notes', 'Jane Doe').includes('name'));
  assert.ok(cellPrivacyHits('Notes', 'Jane Doe 03/14/2017 F84.0').includes('name'));
  assert.ok(cellPrivacyHits('Notes', 'Jane Doe 03/14/2017 F84.0').includes('birth_date'));
  assert.ok(cellPrivacyHits('Notes', 'Jane Doe 03/14/2017 F84.0').includes('diagnosis'));
  assert.ok(cellPrivacyHits('Notes', 'F84.0').includes('diagnosis'));
  assert.ok(cellPrivacyHits('Notes', 'reach jane@example.test').includes('email'));
  assert.ok(cellPrivacyHits('Notes', 'Call (203) 555-0100').includes('phone'));
  assert.ok(cellPrivacyHits('Notes', 'SSN 123-45-6789').includes('ssn'));
  assert.ok(cellPrivacyHits('Notes', '03/14/2017').includes('birth_date'));
  assert.deepEqual(cellPrivacyHits('Pay date', '01/09/2026'), []);
  assert.deepEqual(cellPrivacyHits('Service date', '2026-09-01'), []);
  assert.deepEqual(cellPrivacyHits('Service', 'Physical Therapy'), []);
  assert.deepEqual(cellPrivacyHits('Program', 'SYNTHETIC_PRIVATE_NEVER_TRANSMIT'), []);
});

test('a rejection explains the kind of detail and never repeats the cell', () => {
  const findings = scanMatrix([
    ['Notes', 'Amount'],
    ['Jane Doe 03/14/2017 F84.0 123-45-6789', '12'],
  ]);
  const message = privacyRejectionMessage(findings);
  assert.match(message, /was not saved/);
  assert.match(message, /totals only/);
  assert.doesNotMatch(message, /Jane Doe|123-45-6789|F84\.0|03\/14\/2017/);
});

test('spreadsheets with patient columns are rejected before they can be treated as complete', () => {
  const table = tableFromMatrix([['Client Name', 'Amount'], ['Jane Doe', '10']], 'cash_programs');
  assert.ok(table.blockedFields.includes('restricted_patient_data'));
  const review = validateTable(table, 'cash_programs', '2026-10');
  const privacy = review.checks.find(check => check.key === 'privacy');
  assert.equal(privacy.passed, false);
  assert.equal(review.status === 'complete', false);
  assert.doesNotMatch(JSON.stringify(review), /Jane Doe/);
});

test('only inspectable spreadsheets can pass the upload screen', () => {
  const clean = new TextEncoder().encode('location,category,amount\nCheshire,Rent,10\n');
  assert.equal(screenUploadBytes(clean, 'totals.csv', 'text/csv').ok, true);
  const phi = new TextEncoder().encode('Client Name,Amount\nJane Doe,10\n');
  const rejected = screenUploadBytes(phi, 'patients.csv', 'text/csv');
  assert.equal(rejected.ok, false);
  assert.match(rejected.message, /was not saved/);
  assert.doesNotMatch(rejected.message, /Jane Doe/);
  for (const [name, mime] of [['report.pdf', 'application/pdf'], ['scan.png', 'image/png'], ['legacy.xls', 'application/vnd.ms-excel']]) {
    const result = screenUploadBytes(new Uint8Array([1, 2, 3]), name, mime);
    assert.equal(result.ok, false, name);
    assert.equal(result.message, UNINSPECTABLE_UPLOAD_MESSAGE);
  }
  const broken = screenUploadBytes(new TextEncoder().encode('not a workbook'), 'book.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.equal(broken.ok, false);
  assert.match(broken.message, /was not saved/);
});
