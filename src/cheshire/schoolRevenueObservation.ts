import { schoolPeriodTotal, schoolUnits, type SchoolSheet } from '../../supabase/functions/_shared/cheshire-school-income.ts';
import type { SchoolSourceResult } from './schoolIncomeSource';

/** A source observation, never a normalized financial metric or reconciled accounting total. */
export function supportedSchoolIntervals(sheet: SchoolSheet): number[] {
  return sheet.periods.flatMap((period, index) => {
    const total = schoolPeriodTotal(sheet, [index]);
    if (period.start === null || total.hundredths === null || total.errors || total.dashes) return [];
    const controls = sheet.controls.filter(cell => cell.ref.replace(/\d+$/, '') === period.incomeColumn);
    if (controls.length !== 1) return [];
    const control = controls[0];
    const range = control.formula?.match(/^=SUM\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)$/i);
    if (control.state !== 'number' || !range || range[1] !== period.incomeColumn || range[3] !== period.incomeColumn) return [];
    if (sheet.rows.some(row => row.values[index].income.state === 'number' && schoolUnits(row.values[index].income.value!) !== 0n && (row.row < Number(range[2]) || row.row > Number(range[4])))) return [];
    try { return schoolUnits(control.value!) === total.hundredths ? [index] : []; } catch { return []; }
  });
}

export function schoolRevenueObservation(result: SchoolSourceResult, months: readonly string[], selectedRow?: number | null) {
  if (result.issue || !result.source || !months.length) return null;
  // Never merge identities or accounting observations across source years.
  const year = Number(months.at(-1)!.slice(0, 4));
  const sheet = result.source.audit.sheets.find(sheet => sheet.year === year);
  if (!sheet || (selectedRow != null && !sheet.rows.some(row => row.row === selectedRow))) return null;
  const indices = supportedSchoolIntervals(sheet).filter(index => {
    const p = sheet.periods[index];
    return Array.from({ length: p.end! - p.start! + 1 }, (_, i) => `${year}-${String(p.start! + i).padStart(2, '0')}`).every(month => months.includes(month));
  });
  const scoped = selectedRow == null ? sheet : { ...sheet, rows: sheet.rows.filter(row => row.row === selectedRow) };
  const total = schoolPeriodTotal(scoped, indices);
  if (total.hundredths === null || total.hundredths > BigInt(Number.MAX_SAFE_INTEGER) || total.hundredths < BigInt(Number.MIN_SAFE_INTEGER)) return null;
  const coverage = indices.filter(index => schoolPeriodTotal(scoped, [index]).hundredths !== null).map(index => sheet.periods[index].label).join(', ');
  const coveredMonths = indices.filter(index => schoolPeriodTotal(scoped, [index]).hundredths !== null).flatMap(index => {
    const p = sheet.periods[index];
    return Array.from({ length: p.end! - p.start! + 1 }, (_, i) => `${year}-${String(p.start! + i).padStart(2, '0')}`);
  });
  return { coveredMonths, missingMonths: months.filter(month => !coveredMonths.includes(month)), combined: indices.some(index => sheet.periods[index].start !== sheet.periods[index].end), cents: Number(total.hundredths), note: `${year}: ${coverage} · partial workbook income · currency and billed/collected basis unconfirmed`, detail: 'Only numeric source intervals matching their workbook controls are included. Blank months and unresolved values are unknown, not zero. July/August remains combined. Included once with clinic collections in the partial all-business source subtotal, never added to school invoices. Overlap, complete coverage and therapist labor still need reconciliation.' };
}
