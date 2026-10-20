import { isMonth, type IntakeDocument } from '../../supabase/functions/_shared/cheshire-intake.ts';
import { parseSchoolIncomeAudit, type SchoolIncomeAudit } from '../../supabase/functions/_shared/cheshire-school-income.ts';

export type SchoolSource = { audit: SchoolIncomeAudit; documentId: string };
export type SchoolSourceResult = { source: SchoolSource | null; issue: string | null };
/** Reuse the protected intake query. No extra credentials, endpoints or normalized facts. */
export function readSchoolIncomeSource(documents: IntakeDocument[], month: string): SchoolSourceResult {
  if (!isMonth(month)) return { source: null, issue: null };
  const superseded = new Set(documents.map(d => d.supersedes_id).filter(Boolean));
  const candidates = documents.filter(d => !superseded.has(d.id) && d.source_type === 'school_billing' && d.validation?.school_income_audit);
  const unique = new Map<string, SchoolSource>();
  for (const doc of candidates) {
    try {
      if (doc.source_origin !== 'existing_source' || doc.status !== 'incomplete' || doc.requested_month !== null || doc.reported_month !== null || doc.storage_path !== null || doc.validation?.validator_version !== 'source-audit-v1' || doc.validation.status !== 'incomplete') throw new Error('Invalid envelope');
      const audit = parseSchoolIncomeAudit(doc.validation.school_income_audit, doc.content_sha256);
      const previous = unique.get(audit.source.sha256);
      if (previous && JSON.stringify(previous.audit) !== JSON.stringify(audit)) throw new Error('Conflicting retained hash');
      unique.set(audit.source.sha256, { audit, documentId: doc.id });
    } catch { return { source: null, issue: 'School source validation failed. Review the retained source before displaying amounts.' }; }
  }
  const eligible = [...unique.values()].filter(s => s.audit.sheets.some(sh => sh.year === Number(month.slice(0, 4))));
  if (eligible.length > 1) return { source: null, issue: 'Overlapping school exports need review. Their amounts have not been added together.' };
  return { source: eligible[0] ?? null, issue: null };
}
