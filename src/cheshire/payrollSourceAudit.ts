import { isMonth, type IntakeDocument } from '../../supabase/functions/_shared/cheshire-intake.ts';

export type PayrollSourceMonth = { month: string; grossHundredths: number; rows: number; staffCount: number };
export type PayrollSourceAudit = {
  sourceHash: string;
  currency: string | null;
  firstPayDate: string;
  lastPayDate: string;
  grossHundredths: number;
  detailRows: number;
  staffCount: number;
  months: PayrollSourceMonth[];
};
export type PayrollSourceSummary = {
  audit: PayrollSourceAudit;
  months: PayrollSourceMonth[];
  grossHundredths: number;
  requestedMonthCount: number;
  documentId: string;
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid payroll source audit');
  return value as Record<string, unknown>;
}
function count(value: unknown, minimum = 0): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > 10_000_000) throw new Error('Invalid payroll source count');
  return Number(value);
}
function hundredths(value: unknown): number {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)\.\d{2}$/.test(value)) throw new Error('Invalid payroll source amount');
  const result = Number(value.replace('.', ''));
  if (!Number.isSafeInteger(result)) throw new Error('Unsafe payroll source amount');
  return result;
}
function date(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !isMonth(value.slice(0, 7))) throw new Error('Invalid payroll pay date');
  const parsed = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('Invalid payroll pay date');
  return value;
}

/** Read only reconciled aggregate fields. Never return employee rows, names or payment details. */
export function parsePayrollSourceAudit(input: unknown, sourceHash: string): PayrollSourceAudit {
  const audit = record(input), provenance = record(audit.provenance);
  if (audit.version !== 'payroll-private-audit-v1' || !/^[a-f0-9]{64}$/.test(sourceHash) || provenance.sha256 !== sourceHash) throw new Error('Unverified payroll source');
  if (provenance.currency !== null && (typeof provenance.currency !== 'string' || !/^[A-Z]{3}$/.test(provenance.currency))) throw new Error('Invalid payroll source currency');
  if (!Array.isArray(provenance.actual_pay_dates) || provenance.actual_pay_dates.length !== 2) throw new Error('Invalid payroll source period');
  const firstPayDate = date(provenance.actual_pay_dates[0]), lastPayDate = date(provenance.actual_pay_dates[1]);
  if (firstPayDate > lastPayDate) throw new Error('Invalid payroll source period');
  const detailRows = count(audit.detail_rows, 1), staffCount = count(audit.staff_count, 1);
  if (staffCount > detailRows) throw new Error('Invalid payroll staff count');
  const gross = record(record(audit.reconciliation).gross_pay);
  const grossHundredths = hundredths(gross.detail_sum);
  if (hundredths(gross.source_control) !== grossHundredths || hundredths(gross.difference) !== 0 || count(gross.blank_rows) !== 0) throw new Error('Unreconciled payroll gross wages');
  const entries = Object.entries(record(audit.pay_date_month_summaries));
  if (!entries.length || entries.length > 120) throw new Error('Invalid payroll month coverage');
  const months = entries.map(([month, value]) => {
    if (!isMonth(month) || month < firstPayDate.slice(0, 7) || month > lastPayDate.slice(0, 7)) throw new Error('Invalid payroll source month');
    const row = record(value), rows = count(row.rows, 1), staff = count(row.staff_ids, 1);
    if (staff > rows || staff > staffCount) throw new Error('Invalid monthly payroll staff count');
    return { month, grossHundredths: hundredths(row.gross_pay), rows, staffCount: staff };
  }).sort((a, b) => a.month.localeCompare(b.month));
  const sum = months.reduce((total, month) => total + month.grossHundredths, 0);
  if (!Number.isSafeInteger(sum) || sum !== grossHundredths || months.reduce((total, month) => total + month.rows, 0) !== detailRows || staffCount > months.reduce((total, month) => total + month.staffCount, 0) || months[0].month !== firstPayDate.slice(0, 7) || months.at(-1)!.month !== lastPayDate.slice(0, 7)) throw new Error('Payroll monthly totals do not reconcile');
  return { sourceHash, currency: provenance.currency as string | null, firstPayDate, lastPayDate, grossHundredths, detailRows, staffCount, months };
}

/** Historical source subtotals never enter normalized labor, company expenses, or profit. */
export function readPayrollSourceSummary(documents: IntakeDocument[], mode: 'mtd' | 'ytd', month: string, scope: string): PayrollSourceSummary | null {
  if (!isMonth(month) || !['mtd', 'ytd'].includes(mode) || scope !== 'all') return null;
  const superseded = new Set(documents.map(document => document.supersedes_id).filter(Boolean));
  const candidates: PayrollSourceSummary[] = [];
  for (const document of documents) {
    if (superseded.has(document.id) || document.source_type !== 'payroll' || document.source_origin !== 'existing_source' || document.status !== 'incomplete' || document.requested_month !== null || document.reported_month !== null || document.storage_path !== null || document.validation?.validator_version !== 'source-audit-v1' || document.validation.status !== 'incomplete' || !document.validation.payroll_source_audit) continue;
    try {
      const audit = parsePayrollSourceAudit(document.validation.payroll_source_audit, document.content_sha256);
      const months = audit.months.filter(row => mode === 'mtd' ? row.month === month : row.month.slice(0, 4) === month.slice(0, 4) && row.month <= month);
      if (!months.length) continue;
      candidates.push({ audit, months, grossHundredths: months.reduce((sum, row) => sum + row.grossHundredths, 0), requestedMonthCount: mode === 'mtd' ? 1 : Number(month.slice(5, 7)), documentId: document.id });
    } catch { /* An invalid historical audit cannot supply displayed source amounts. */ }
  }
  // Never choose or add overlapping exports. Identical retained hashes count only once.
  const unique = new Map<string, PayrollSourceSummary>();
  for (const candidate of candidates) {
    const previous = unique.get(candidate.audit.sourceHash);
    if (previous && JSON.stringify(previous.audit) !== JSON.stringify(candidate.audit)) return null;
    unique.set(candidate.audit.sourceHash, candidate);
  }
  return unique.size === 1 ? [...unique.values()][0] : null;
}

export function formatPayrollSourceAmount(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid payroll display amount');
  const exact = BigInt(value);
  return `$${new Intl.NumberFormat('en-US').format(exact / 100n)}.${String(exact % 100n).padStart(2, '0')}`;
}

export function payrollDateLabel(value: string): string {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
