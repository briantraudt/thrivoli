import type { MetricResponse } from './metrics.ts';
import type { SchoolSourceResult } from './schoolIncomeSource.ts';

export type SchoolFilterOption = { value: string; label: string; sourceLabel: string; row: number };

export function schoolFilterIdentity(result: SchoolSourceResult, month: string): string | null {
  const year = Number(month.slice(0, 4));
  return !result.issue && result.source?.audit.sheets.some(sheet => sheet.year === year)
    ? `${result.source.audit.source.sha256}:${year}` : null;
}

/** Source-row identities are not confirmed school/district mappings. Never merge repeated names. */
export function schoolFilterOptions(result: SchoolSourceResult, month: string): SchoolFilterOption[] {
  const identity = schoolFilterIdentity(result, month);
  const sheet = result.source?.audit.sheets.find(item => item.year === Number(month.slice(0, 4)));
  if (!identity || !sheet) return [];
  const labelCounts = new Map<string, number>();
  for (const row of sheet.rows) {
    const key = row.label.trim().toLowerCase();
    labelCounts.set(key, (labelCounts.get(key) ?? 0) + 1);
  }
  return sheet.rows.map(row => ({
    value: `${identity}:${row.row}`,
    label: `${row.label}${labelCounts.get(row.label.trim().toLowerCase())! > 1 ? ` · ${sheet.sheet}!A${row.row}` : ''}`,
    sourceLabel: row.label,
    row: row.row,
  })).sort((a, b) => a.sourceLabel.localeCompare(b.sourceLabel) || a.row - b.row);
}

/** Served invoices have no school/therapist dimension. Do not attribute the all-school subtotal. */
export function filterSelectedSchoolMetrics(response: MetricResponse, selected: boolean): MetricResponse {
  if (!selected) return response;
  return {
    ...response,
    sources: response.sources.filter(source => source.source_type !== 'school_billing'),
    blocked: [
      ...response.blocked.filter(source => source.source_type !== 'school_billing'),
      { source_type: 'school_billing', reason: 'Validated monthly invoices are not linked to this school. Select All schools to view the separate all-school invoice source.' },
    ],
  };
}
