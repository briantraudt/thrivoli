import type { CategoryLine } from './executiveView';

export type CompactCategoryLine = Pick<CategoryLine, 'id' | 'label' | 'cents'> & { badges: string[] };

function missingLabel(line: CategoryLine): string {
  const waiting = line.waiting ?? '';
  if (/therapist IDs/i.test(waiting)) return 'Missing therapist IDs';
  if (/therapist time by location/i.test(waiting)) return 'Missing location labor';
  if (/therapist time.*payroll/i.test(waiting)) return 'Missing therapist time + payroll';
  if (/school-only costs/i.test(waiting)) return 'Missing school costs';
  if (/direct costs/i.test(waiting)) return 'Missing direct costs';
  if (/PracticePro|QuickBooks/i.test(waiting)) return 'Missing clinic payments';
  if (/school workbook|invoices/i.test(waiting)) return 'Missing school income';
  if (/cash-program/i.test(waiting)) return 'Missing program income';
  if (/payroll export/i.test(waiting)) return 'Missing payroll';
  if (/overhead workbook/i.test(waiting)) return 'Missing overhead';
  return 'Missing data';
}

/** Presentation only: never substitute zero or add independently reported sources. */
export function compactCategoryLines(lines: readonly CategoryLine[]): CompactCategoryLine[] {
  return lines.map(line => {
    // Callers can supply precise coverage dates and gaps without exposing source details.
    const badges = line.sourceNote?.trim()
      ? line.sourceNote.split(' · ').map(note => note.trim()).filter(Boolean)
      : [];
    if (!badges.length) {
      if (line.cents === null) badges.push(missingLabel(line));
      else {
        if (/budget|estimat/i.test(line.basis)) badges.push('Estimate');
        if (/partial|incomplete/i.test(line.basis)) badges.push('Partial');
        if (/unconfirmed|unverified/i.test(line.basis)) badges.push('Unconfirmed');
        const blanks = line.drill.match(/(\d+) blank cells? (?:are|is) unknown/i);
        if (blanks && Number(blanks[1]) > 0) badges.push(`Missing ${blanks[1]} ${Number(blanks[1]) === 1 ? 'cell' : 'cells'}`);
      }
    }
    return { id: line.id, label: line.label, cents: line.cents, badges: [...new Set(badges)] };
  });
}
