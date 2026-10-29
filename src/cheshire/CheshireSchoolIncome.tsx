import { useState } from 'react';
import { reportingMonths } from './periodSummary';
import { schoolAmount, schoolPeriodTotal, type SchoolCell } from '../../supabase/functions/_shared/cheshire-school-income.ts';
import { SCHOOL_SCOPE_NOTE, schoolScopeText } from './schoolScope';
import type { SchoolSourceResult } from './schoolIncomeSource';
import './school-income.css';

function cellLabel(cell: SchoolCell): string {
  if (cell.state === 'blank') return 'Blank';
  if (cell.state === 'error') return `${cell.value} · quarantined`;
  if (cell.state === 'dash') return 'Dash · unresolved';
  return cell.value!;
}
export function CheshireSchoolIncome({ result, mode, month, selectedRow, selectedMonths, periodName, onReviewSource }: {
  result: SchoolSourceResult; mode: 'mtd' | 'ytd'; month: string; selectedRow?: number | null; selectedMonths?: readonly string[]; periodName?: string; onReviewSource: () => void;
}) {
  const [search, setSearch] = useState('');
  if (result.issue) return <section className="csi-source" role="status"><h2>Reported school income</h2><p>{result.issue}</p><a href="#csd-source-review" onClick={onReviewSource}>Review school source</a></section>;
  if (!result.source) return null;
  const { audit } = result.source;
  const sheet = audit.sheets.find(s => s.year === Number(month.slice(0, 4)))!;
  const selectedSchool = selectedRow == null ? null : sheet.rows.find(row => row.row === selectedRow);
  if (selectedRow != null && !selectedSchool) return <section className="csi-source" role="status"><h2>Reported school income</h2><p>The selected school source row is unavailable. Select a school again.</p></section>;
  const scopedSheet = selectedSchool ? { ...sheet, rows: [selectedSchool] } : sheet;
  const requestedMonths = reportingMonths(mode, month, selectedMonths);
  const intervalMonths = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, index) => `${sheet.year}-${String(start + index).padStart(2, '0')}`);
  const selected = sheet.periods.map((p, i) => ({ p, i })).filter(({ p }) => p.start !== null && p.end !== null && intervalMonths(p.start, p.end).every(value => requestedMonths.includes(value)));
  const outsideYear = requestedMonths.filter(value => !value.startsWith(`${sheet.year}-`));
  const total = schoolPeriodTotal(scopedSheet, selected.map(p => p.i));
  const partialCombined = sheet.periods.some(p => p.start !== null && p.end !== null && intervalMonths(p.start, p.end).some(value => requestedMonths.includes(value)) && !intervalMonths(p.start, p.end).every(value => requestedMonths.includes(value)));
  const rows = scopedSheet.rows.filter(r => selectedSchool || r.label.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <section className="csi-source" aria-labelledby="csi-title">
    <div className="csi-head"><div><p>Private school workbook · {sheet.year}</p><h2 id="csi-title">Reported school income</h2><p>{periodName ?? mode.toUpperCase()} source subtotal{outsideYear.length ? ` · ${sheet.year} portion only` : ''} · {selected.length} selected source intervals</p></div><div><strong>{total.hundredths === null ? 'No numeric source values' : schoolAmount(total.hundredths)}</strong><span>Currency unconfirmed</span></div></div>
    {selectedSchool?<p className="csi-selected-school"><strong>{selectedSchool.label}</strong> · source row {sheet.sheet}!A{selectedSchool.row}. This is a source label; school and therapist mappings still need confirmation.</p>:null}
    <p className="csi-scope">{SCHOOL_SCOPE_NOTE}</p>
    <p>Partial numeric source observations. Accounting basis and completeness are unconfirmed. These amounts are separate from PracticePro payments, QuickBooks revenue and profit.</p>
    <p>{total.numeric} numeric income cells · {total.blank} blank · {total.dashes} dash · {total.errors} error. Blank and error amounts are unknown.</p>
    {outsideYear.length ? <p className="csi-warning">{outsideYear.join(', ')} are outside this {sheet.year} source-year subtotal. This is not the full selected-period total; school identities and amounts from other years have not been combined.</p> : null}
    {partialCombined ? <p className="csi-warning">July/August is a combined source interval. Both months must fall inside the selected reporting window. Otherwise its amount is excluded from this selected subtotal.</p> : null}
    {sheet.periods.some(p => p.start === null) ? <p className="csi-warning">The leading December has an unconfirmed year and is excluded from calendar-period subtotals.</p> : null}
    <details><summary>School income detail, coverage and source checks</summary>
      <div className="csi-scroll"><table><caption>{selectedSchool?`${selectedSchool.label} · ${sheet.sheet}!A${selectedSchool.row} · all source periods`:`All source periods in ${sheet.year}`}. Numeric detail subtotals do not establish complete monthly or annual revenue.</caption><thead><tr><th scope="col">Source period</th><th scope="col">Numeric income subtotal</th><th scope="col">Numeric / blank / dash / error cells</th></tr></thead><tbody>{sheet.periods.map((p, i) => {
        const t = schoolPeriodTotal(scopedSheet, [i]);
        return <tr key={p.id}><th scope="row">{p.label}{p.start === null ? ' · year unresolved' : ''}</th><td>{t.hundredths === null ? 'Unknown' : schoolAmount(t.hundredths)}</td><td>{t.numeric} / {t.blank} / {t.dashes} / {t.errors}</td></tr>;
      })}</tbody></table></div>
      {!selectedSchool?<label className="csi-search">Find a school <input type="search" value={search} onChange={e => setSearch(e.target.value)} /></label>:null}
      <p>{rows.length} of {scopedSheet.rows.length} source school rows{selectedSchool?' in this selection':''}. Repeated labels remain separate. School and therapist identities still need confirmation.</p>
      <div className="csi-schools">{rows.map(row => <details key={row.row}><summary>{row.label} · {sheet.sheet}!A{row.row}</summary><div className="csi-scroll"><table><caption>Original hours and income cells. Hours meaning is unconfirmed; no rate has been inferred.</caption><thead><tr><th scope="col">Period</th><th scope="col">Hours source</th><th scope="col">Income source</th></tr></thead><tbody>{row.values.map((pair, i) => <tr key={sheet.periods[i].id}><th scope="row">{sheet.periods[i].label}</th>{(['hours', 'income'] as const).map(key => <td key={key}>{cellLabel(pair[key])}<small>{sheet.sheet}!{pair[key].ref}{pair[key].formula ? ` · ${pair[key].formula}` : ''}</small></td>)}</tr>)}</tbody></table></div></details>)}</div>
      <h3>Workbook-wide source review notes</h3><ul>{sheet.notes.map((note, i) => <li key={i}>{schoolScopeText(note)}</li>)}</ul>
      <details><summary>Original control formulas and cached results · full workbook</summary><ul>{sheet.controls.map(c => <li key={c.ref}>{sheet.sheet}!{c.ref}: {c.formula} · cached {cellLabel(c)}</li>)}</ul><p>These unfiltered workbook controls are evidence only, not figures for the selected school, and are never added to school detail amounts.</p></details>
      <h3>Still needed for validated revenue and profitability</h3>
      <ul><li>Confirm currency, invoice/payment/service basis, hours meaning, reporting cutoff and complete school coverage.</li><li>Resolve formula errors, ambiguous December, repeated labels, alias mappings, omitted subtotal rows and possible carried-forward activity.</li><li>Provide monthly invoices or receipts, district and therapist IDs, billing basis, quantities, contract rates and effective dates, plus reconciled control totals.</li><li>Confirm school and therapist identities and reconcile overlap with QuickBooks and PracticePro before combining revenue; provide verified therapist labor for school profit. Clinics absorb all non-therapist overhead.</li></ul>
      <p>Original: {audit.source.filename} · private Library version {audit.source.libraryVersion}. SHA-256: <code>{audit.source.sha256}</code>. Retained years: {audit.sheets.map(s => s.year).join(', ')}.</p>
      <a href="#csd-source-review" onClick={onReviewSource}>Review school source and missing data</a>
    </details>
  </section>;
}
