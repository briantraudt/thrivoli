/** Patient-data screen. Findings name the kind of detail, never the cell text. */
export type PrivacyFinding = 'column' | 'ssn' | 'email' | 'phone' | 'birth_date' | 'diagnosis' | 'name';

const BLOCKED = new Set([
  'patient', 'patientname', 'patientid', 'patientdob', 'patientfirstname', 'patientlastname',
  'firstname', 'lastname', 'middlename', 'fullname', 'clientname', 'clientfirstname', 'clientlastname',
  'birthdate', 'birthdt', 'dateofbirth', 'dob',
  'mrn', 'medicalrecordnumber', 'medicalrecord',
  'diagnosis', 'diagnoses', 'diagnosiscode', 'diagnosiscodes', 'clinicalnotes', 'clinicalnote',
  'icd10', 'icd9', 'icdcode', 'dx', 'dxcode',
  'ssn', 'socialsecuritynumber', 'socialsecurity',
  'memberid', 'membernumber', 'membername', 'subscriberid', 'subscribername', 'subscriberdob',
  'insuredid', 'insuredname', 'insurname', 'policynumber', 'policyid', 'policyholder', 'policynum',
  'guarantor', 'guarantorname', 'guarantorid',
  'address', 'streetaddress', 'homeaddress', 'mailingaddress', 'patientaddress', 'street',
  'phone', 'phonenumber', 'telephone', 'mobile', 'mobilephone', 'cellphone',
  'email', 'emailaddress', 'patientemail',
  'student', 'studentname', 'studentid', 'studentdob', 'childname', 'childdob',
  'accountnumber', 'accountno', 'accountnum', 'acctnumber', 'acctno', 'acctnum', 'patientaccount',
  'chartnumber', 'chartno', 'chartnum', 'chartid',
]);

const SSN = /\b\d{3}-\d{2}-\d{4}\b/;
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
const PHONE = /\b(?:\+?1[-.\s])?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/;
const US_DATE = /\b(?:0?[1-9]|1[0-2])[/-](?:0?[1-9]|[12]\d|3[01])[/-](?:19|20)\d{2}\b/;
const ISO_DATE = /\b(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b/;
const ICD = /\b[A-TV-Z]\d{2}\.\d{1,4}\b/;
const ICD_LABEL = /\b(?:icd-?10|diagnosis|dx)\b[:\s#-]*[A-TV-Z]\d{2}(?:\.[0-9A-TV-Z]{1,4})?/i;
const PERSON = /\b[A-Z][a-z]{1,24} [A-Z][a-z]{1,24}\b/;
const PERSON_ONLY = /^[A-Z][a-z]{1,24}(?: [A-Z][a-z]{1,24}){1,2}$/;
const FREE_TEXT = /^(notes?|comments?|memo|description|narrative|freetext|remarks?)$/;

export function canonicalHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** True when a column title is a patient, student, or subscriber identifier. */
export function headerPrivacyHit(header: string): boolean {
  const raw = header.trim();
  const normalized = canonicalHeader(raw);
  if (!normalized || normalized.length > 80) return false;
  if (BLOCKED.has(normalized) || /^dx\d+$/.test(normalized)) return true;
  if (/\b(account|acct|chart)\s*(?:#|number|no\.?|num)(?!\w)/i.test(raw)) return true;
  if (/\b(policy|member|insured|subscriber|patient|guarantor|student)\s*(?:#|number|no\.?|num|id)(?!\w)/i.test(raw)) return true;
  if (/\b(first|last|middle|full|client|patient|student|child|guarantor)\s+names?\b/i.test(raw)) return true;
  if (/(patient|student|child|guarantor|subscriber|insured).*(name|identifier|birth|dob|address|email|phone|record|ssn)/.test(normalized)) return true;
  if (/(firstname|lastname|middlename|birthdate|dateofbirth|socialsecurity|medicalrecord)/.test(normalized)) return true;
  return false;
}

function push(findings: Set<PrivacyFinding>, finding: PrivacyFinding) {
  findings.add(finding);
}

/** Scan one cell. A reporting date or a staff id by itself is not a patient marker. */
export function cellPrivacyHits(header: string, value: string): PrivacyFinding[] {
  const text = value.trim();
  if (!text || text.length > 20000) return [];
  const findings = new Set<PrivacyFinding>();
  const headerNorm = canonicalHeader(header);
  if (header && header.length <= 80 && headerPrivacyHit(header)) push(findings, 'column');
  if (text.length <= 80 && headerPrivacyHit(text)) push(findings, 'column');
  if (SSN.test(text)) push(findings, 'ssn');
  if (EMAIL.test(text)) push(findings, 'email');
  if (PHONE.test(text)) push(findings, 'phone');
  if (ICD.test(text) || ICD_LABEL.test(text)) push(findings, 'diagnosis');
  const usDate = text.match(US_DATE);
  const named = PERSON.test(text);
  if (usDate) {
    const year = Number(usDate[0].slice(-4));
    if (named || findings.has('column') || year <= 2020) push(findings, 'birth_date');
  }
  if (named && (usDate || ISO_DATE.test(text) || ICD.test(text) || SSN.test(text) || EMAIL.test(text) || PHONE.test(text))) push(findings, 'name');
  if (FREE_TEXT.test(headerNorm) && PERSON_ONLY.test(text)) push(findings, 'name');
  return [...findings];
}

export function scanMatrix(matrix: (string | null)[][]): PrivacyFinding[] {
  const findings = new Set<PrivacyFinding>();
  if (!matrix.length) return [];
  const headers = matrix[0].map(value => value ?? '');
  headers.forEach(header => { if (headerPrivacyHit(header)) findings.add('column'); });
  matrix.forEach((row, rowIndex) => {
    row.forEach((value, column) => {
      if (!value) return;
      const header = rowIndex === 0 ? '' : headers[column] ?? '';
      for (const finding of cellPrivacyHits(header, value)) findings.add(finding);
    });
  });
  return [...findings];
}

const FINDING_LABEL: Record<PrivacyFinding, string> = {
  column: 'a column titled like a patient or student identifier (such as a name, birth date, account or chart number, diagnosis, insurance ID, address, phone, or email)',
  ssn: 'a Social Security number',
  email: 'an email address',
  phone: 'a phone number',
  birth_date: 'a birth date',
  diagnosis: 'a diagnosis or ICD-10 code',
  name: 'a person’s name next to a birth date, diagnosis, or other identifier',
};

/** Owner-facing rejection. The wording never repeats the cell that triggered it. */
export function privacyRejectionMessage(findings: PrivacyFinding[]): string {
  const unique = [...new Set(findings)];
  const why = unique.map(finding => FINDING_LABEL[finding]).join('; ');
  return `This file was not saved. Cheshire does not store patient or student details, and this file includes ${why}. Export the report again with totals only — no names, birth dates, account or chart numbers, diagnosis codes, insurance IDs, addresses, phone numbers, emails, or Social Security numbers — and upload that spreadsheet.`;
}

export const UNINSPECTABLE_UPLOAD_MESSAGE = 'This file was not saved. Cheshire can only check CSV and Excel (.xlsx) spreadsheets for patient details. PDF, photos, and older .xls files are not accepted. Save the report as .xlsx or CSV with totals only, then upload that file.';
export const UNREADABLE_UPLOAD_MESSAGE = 'This file was not saved. It could not be read safely, so Cheshire did not store it. Save it again as a CSV or Excel (.xlsx) spreadsheet and upload that file.';
