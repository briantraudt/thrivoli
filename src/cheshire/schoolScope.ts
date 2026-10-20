import type { IntakeDocument } from '../../supabase/functions/_shared/cheshire-intake.ts';

export const SCHOOL_SCOPE_NOTE = 'Schools operate independently of clinic locations. The clinic filter does not change these figures.';

// Owner clarification changes presentation, never the immutable source evidence or replay payload.
const clarifiedText = new Map([
  ['Source currency, accounting basis, hours meaning and school/location/provider mappings are unconfirmed.', 'Schools are independent of clinic locations. Source currency, accounting basis, hours meaning and school/provider identities remain unconfirmed.'],
  ['School-level source rows; currency, accounting basis and location/provider mapping unconfirmed', 'School-level source rows, independent of clinic locations; currency, accounting basis and school/provider identities remain unconfirmed'],
  ['Approve school/location/provider mappings and reconcile overlap with PracticePro and QuickBooks before combining revenue.', 'Confirm school and therapist identities and reconcile overlap with PracticePro and QuickBooks before combining revenue.'],
  ['Provide matching fully loaded labor and overhead before calculating school or location profit.', 'Provide matching school labor and applicable shared costs before calculating school profit.'],
]);

export function schoolScopeText(text: string): string {
  return clarifiedText.get(text) ?? text;
}

export function schoolSourceReviewText(document: IntakeDocument, text: string): string {
  const audit = document.validation?.school_income_audit;
  const schoolAudit = document.source_type === 'school_billing' && document.source_origin === 'existing_source'
    && document.validation?.validator_version === 'source-audit-v1' && audit && typeof audit === 'object'
    && 'version' in audit && audit.version === 'school-income-audit-v1';
  return schoolAudit ? schoolScopeText(text) : text;
}
