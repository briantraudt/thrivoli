/** Source observations only. These values never supply normalized revenue, labor or profit. */
export type SchoolCell = { ref: string; state: 'number' | 'blank' | 'dash' | 'error'; value: string | null; formula: string | null };
export type SchoolPeriod = { id: string; label: string; start: number | null; end: number | null; hoursColumn: string; incomeColumn: string };
export type SchoolRow = { row: number; label: string; values: { hours: SchoolCell; income: SchoolCell }[] };
export type SchoolSheet = {
  sheet: string; year: number; periods: SchoolPeriod[]; rows: SchoolRow[];
  controls: SchoolCell[]; notes: string[];
  numericCells: number; populatedPairs: number; rawHundredths: string;
};
export type SchoolIncomeAudit = {
  version: 'school-income-audit-v1';
  source: { sha256: string; filename: string; byteSize: number; libraryId: string; libraryVersion: number };
  currency: null; accountingBasis: null; hoursBasis: null; mappings: null;
  sheets: SchoolSheet[];
};
function fail(message: string): never { throw new Error(`School income: ${message}`); }
function object(v: unknown, keys: string[]): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail('invalid object');
  const o = v as Record<string, unknown>;
  if (Object.keys(o).sort().join('|') !== [...keys].sort().join('|')) fail('unexpected or missing fields');
  return o;
}
function text(v: unknown, max = 200): string {
  if (typeof v !== 'string' || !v.trim() || v.length > max || [...v].some(c => c.charCodeAt(0) < 32 && !['\t', '\n', '\r'].includes(c))) fail('invalid text');
  return v;
}
function integer(v: unknown, min: number, max: number): number {
  if (!Number.isSafeInteger(v) || Number(v) < min || Number(v) > max) fail('invalid count');
  return Number(v);
}
/** Signed source adjustments are retained exactly; never rounded or coerced from text. */
export function schoolUnits(v: string, places = 2): bigint {
  if (!/^-?(0|[1-9]\d*)(\.\d+)?$/.test(v) || (v.split('.')[1]?.length ?? 0) > places) fail('invalid decimal precision');
  const negative = v.startsWith('-'), [whole, fraction = ''] = v.replace(/^-/, '').split('.');
  const units = BigInt(whole) * 10n ** BigInt(places) + BigInt(fraction.padEnd(places, '0'));
  if (units > 9007199254740991n) fail('unsafe amount');
  return negative ? -units : units;
}
export function schoolAmount(units: bigint | string): string {
  const n = BigInt(units), a = n < 0n ? -n : n;
  return `${n < 0n ? '-' : ''}$${new Intl.NumberFormat('en-US').format(a / 100n)}.${String(a % 100n).padStart(2, '0')}`;
}
function cell(input: unknown, ref?: string, precision = 2): SchoolCell {
  const o = object(input, ['ref', 'state', 'value', 'formula']);
  const coordinate = text(o.ref, 12);
  if (!/^[A-Z]{1,3}[1-9]\d{0,4}$/.test(coordinate) || ref && ref !== coordinate) fail('cell provenance mismatch');
  if (o.formula !== null && !text(o.formula, 500).startsWith('=')) fail('invalid formula');
  if (o.state === 'number') schoolUnits(text(o.value, 40), precision);
  else if (o.state === 'blank') { if (o.value !== null || o.formula !== null) fail('invalid blank'); }
  else if (o.state === 'dash') { if (o.value !== '-' || o.formula !== null) fail('invalid dash'); }
  else if (o.state === 'error') { if (!text(o.value, 60).startsWith('#')) fail('invalid error'); }
  else fail('unsupported cell state');
  return { ref: coordinate, state: o.state as SchoolCell['state'], value: o.value as string | null, formula: o.formula as string | null };
}
export function parseSchoolIncomeAudit(input: unknown, expectedHash?: string): SchoolIncomeAudit {
  const o = object(input, ['version', 'source', 'currency', 'accountingBasis', 'hoursBasis', 'mappings', 'sheets']);
  if (o.version !== 'school-income-audit-v1' || o.currency !== null || o.accountingBasis !== null || o.hoursBasis !== null || o.mappings !== null) fail('unsupported basis or mapping');
  const s = object(o.source, ['sha256', 'filename', 'byteSize', 'libraryId', 'libraryVersion']);
  const hash = text(s.sha256, 64);
  if (!/^[a-f0-9]{64}$/.test(hash) || expectedHash && hash !== expectedHash) fail('source hash mismatch');
  const source = { sha256: hash, filename: text(s.filename), byteSize: integer(s.byteSize, 1, 5 * 1024 * 1024), libraryId: text(s.libraryId, 100), libraryVersion: integer(s.libraryVersion, 0, 10000) };
  if (!/^libfile_[a-zA-Z0-9_-]+$/.test(source.libraryId) || !source.filename.endsWith('.xlsx')) fail('invalid source reference');
  if (!Array.isArray(o.sheets) || !o.sheets.length || o.sheets.length > 20) fail('invalid sheets');
  const years = new Set<number>();
  const sheets: SchoolSheet[] = o.sheets.map(inputSheet => {
    const sh = object(inputSheet, ['sheet', 'year', 'periods', 'rows', 'controls', 'notes', 'numericCells', 'populatedPairs', 'rawHundredths']);
    const year = integer(sh.year, 2000, 2100), name = text(sh.sheet, 31);
    if (name !== String(year) || years.has(year)) fail('duplicate or ambiguous year');
    years.add(year);
    if (!Array.isArray(sh.periods) || ![11, 12].includes(sh.periods.length)) fail('invalid period layout');
    const seenColumns = new Set<string>();
    const periods: SchoolPeriod[] = sh.periods.map((inputPeriod, index) => {
      const p = object(inputPeriod, ['id', 'label', 'start', 'end', 'hoursColumn', 'incomeColumn']);
      const extra = sh.periods instanceof Array && sh.periods.length === 12;
      const ordinal = index - (extra ? 1 : 0);
      const start = ordinal < 0 ? null : ordinal < 6 ? ordinal + 1 : ordinal === 6 ? 7 : ordinal + 2;
      const end = start === 7 ? 8 : start;
      const id = start === null ? 'unassigned-december' : start === 7 ? '07-08' : String(start).padStart(2, '0');
      if (p.id !== id || p.start !== start || p.end !== end) fail('split, duplicated or ambiguous period');
      const hoursColumn = text(p.hoursColumn, 3), incomeColumn = text(p.incomeColumn, 3);
      const expectedIncome = (extra ? [3, 5, 7, 9, 11, 13, 15, 18, 20, 22, 24, 26] : [3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23])[index];
      if (hoursColumn !== String.fromCharCode(64 + expectedIncome - 1) || incomeColumn !== String.fromCharCode(64 + expectedIncome)) fail('period column mapping differs from reviewed layout');
      for (const col of [hoursColumn, incomeColumn]) {
        if (!/^[A-Z]{1,3}$/.test(col) || seenColumns.has(col)) fail('duplicate source column');
        seenColumns.add(col);
      }
      return { id, label: text(p.label), start, end, hoursColumn, incomeColumn };
    });
    if (!Array.isArray(sh.rows) || !sh.rows.length || sh.rows.length > 1000) fail('invalid school rows');
    const rowIds = new Set<number>(); let numericCells = 0, populatedPairs = 0, total = 0n;
    const rows = sh.rows.map(inputRow => {
      const r = object(inputRow, ['row', 'label', 'values']), row = integer(r.row, 4, 10000);
      if (rowIds.has(row)) fail('duplicate source row');
      rowIds.add(row);
      if (!Array.isArray(r.values) || r.values.length !== periods.length) fail('missing source cells');
      const values = r.values.map((v, i) => {
        const pair = object(v, ['hours', 'income']);
        const hours = cell(pair.hours, `${periods[i].hoursColumn}${row}`, 4);
        const income = cell(pair.income, `${periods[i].incomeColumn}${row}`);
        if (income.state === 'number') { numericCells++; total += schoolUnits(income.value!); }
        if (hours.state !== 'blank' || income.state !== 'blank') populatedPairs++;
        return { hours, income };
      });
      return { row, label: text(r.label), values };
    });
    if (sh.numericCells !== numericCells || sh.populatedPairs !== populatedPairs || sh.rawHundredths !== String(total) || total > 9007199254740991n || total < -9007199254740991n) fail('leaf totals do not reconcile');
    if (!Array.isArray(sh.controls) || sh.controls.length > 200 || !Array.isArray(sh.notes) || sh.notes.length > 100) fail('invalid source controls');
    const controls = sh.controls.map(c => cell(c, undefined, 8));
    if (new Set(controls.map(c => c.ref)).size !== controls.length || controls.some(c => rowIds.has(Number(c.ref.match(/\d+$/)![0])))) fail('control overlaps leaf data');
    return { sheet: name, year, periods, rows, controls, notes: sh.notes.map(n => text(n, 600)), numericCells, populatedPairs, rawHundredths: String(total) };
  });
  return { version: 'school-income-audit-v1', source, currency: null, accountingBasis: null, hoursBasis: null, mappings: null, sheets };
}

export function selectedSchoolPeriods(sheet: SchoolSheet, mode: 'mtd' | 'ytd', month: number) {
  return sheet.periods.map((p, i) => ({ p, i })).filter(({ p }) => p.start !== null && p.end !== null && (mode === 'mtd' ? p.start === month && p.end === month : p.end <= month));
}
export function schoolPeriodTotal(sheet: SchoolSheet, indices: number[]) {
  const cells = sheet.rows.flatMap(row => indices.map(i => row.values[i].income));
  const numeric = cells.filter(c => c.state === 'number');
  return { hundredths: numeric.length ? numeric.reduce((sum, c) => sum + schoolUnits(c.value!), 0n) : null, numeric: numeric.length, blank: cells.filter(c => c.state === 'blank').length, errors: cells.filter(c => c.state === 'error').length, dashes: cells.filter(c => c.state === 'dash').length };
}
