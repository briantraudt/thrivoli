import { useState } from 'react';
import { schoolAmount, schoolPeriodTotal, selectedSchoolPeriods, type SchoolCell } from '../../supabase/functions/_shared/cheshire-school-income.ts';
import type { SchoolSourceResult } from './schoolIncomeSource';
import './school-income.css';

function cellLabel(cell: SchoolCell): string {
  if (cell.state === 'blank') return 'Blank';
  if (cell.state === 'error') return `${cell.value} · quarantined`;
  if (cell.state === 'dash') return 'Dash · unresolved';
  return cell.value!;
}
export function CheshireSchoolIncome({ result, mode, month, scope, onReviewSource }: {
  result: SchoolSourceResult; mode: 'mtd' | 'ytd'; month: string; scope: string; onReviewSource: () => void;
}) {
  const [search, setSearch] = useState('');
  if (result.issue) return <section className="csi-source" role="status"><h2>Reported school income</h2><p>{result.issue}</p><a href="#csd-source-review" onClick={onReviewSource}>Review school source</a></section>;
  if (!result.source) return null;
  const { audit } = result.source;
  const sheet = audit.sheets.find(s => s.year === Number(month.slice(0, 4)))!;
  if (scope !== 'all') return <section className="csi-source"><h2>Reported school income</h2><p>School-to-clinic mappings are unconfirmed. Select All locations to review school source amounts.</p></section>;
  const selected = selectedSchoolPeriods(sheet, mode, Number(month.slice(5)));
  const total = schoolPeriodTotal(sheet, selected.map(p => p.i));
  const partialCombined = sheet.periods.some(p => p.start === 7 && (mode === 'mtd' && [7, 8].includes(Number(month.slice(5))) || mode === 'ytd' && Number(month.slice(5)) === 7));
  const rows = sheet.rows.filter(r => r.label.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <section className="csi-source" aria-labelledby="csi-title">
    <div className="csi-head"><div><p>Private school workbook · {sheet.year}</p><h2 id="csi-title">Reported school income</h2><p>{mode.toUpperCase()} source subtotal · {selected.length} selected source intervals</p></div><div><strong>{total.hundredths === null ? 'No numeric source values' : schoolAmount(total.hundredths)}</strong><span>Currency unconfirmed</span></div></div>
    <p>Partial numeric source observations. Accounting basis and completeness are unconfirmed. These amounts are separate from PracticePro payments, QuickBooks revenue and profit.</p>
    <p>{total.numeric} numeric income cells · {total.blank} blank · {total.dashes} dash · {total.errors} error. Blank and error amounts are unknown.</p>
    {partialCombined ? <p className="csi-warning">July/August is a combined source interval. It cannot supply either individual month or July YTD, so its amount is excluded from this selected subtotal.</p> : null}
    {sheet.periods.some(p => p.start === null) ? <p className="csi-warning">The leading December has an unconfirmed year and is excluded from calendar-period subtotals.</p> : null}
    <details><summary>School income detail, coverage and source checks</summary>
      <div className="csi-scroll"><table><caption>All source periods in {sheet.year}. Numeric detail subtotals do not establish complete monthly or annual revenue.</caption><thead><tr><th scope="col">Source period</th><th scope="col">Numeric income subtotal</th><th scope="col">Numeric / blank / dash / error cells</th></tr></thead><tbody>{sheet.periods.map((p, i) => {
        const t = schoolPeriodTotal(sheet, [i]);
        return <tr key={p.id}><th scope="row">{p.label}{p.start === null ? ' · year unresolved' : ''}</th><td>{t.hundredths === null ? 'Unknown' : schoolAmount(t.hundredths)}</td><td>{t.numeric} / {t.blank} / {t.dashes} / {t.errors}</td></tr>;
      })}</tbody></table></div>
      <label className="csi-search">Find a school <input type="search" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <p>{rows.length} of {sheet.rows.length} source school rows. Repeated labels remain separate. School labels are not clinic or therapist mappings.</p>
      <div className="csi-schools">{rows.map(row => <details key={row.row}><summary>{row.label} · {sheet.sheet}!A{row.row}</summary><div className="csi-scroll"><table><caption>Original hours and income cells. Hours meaning is unconfirmed; no rate has been inferred.</caption><thead><tr><th scope="col">Period</th><th scope="col">Hours source</th><th scope="col">Income source</th></tr></thead><tbody>{row.values.map((pair, i) => <tr key={sheet.periods[i].id}><th scope="row">{sheet.periods[i].label}</th>{(['hours', 'income'] as const).map(key => <td key={key}>{cellLabel(pair[key])}<small>{sheet.sheet}!{pair[key].ref}{pair[key].formula ? ` · ${pair[key].formula}` : ''}</small></td>)}</tr>)}</tbody></table></div></details>)}</div>
      <h3>Source review notes</h3><ul>{sheet.notes.map((note, i) => <li key={i}>{note}</li>)}</ul>
      <details><summary>Original control formulas and cached results</summary><ul>{sheet.controls.map(c => <li key={c.ref}>{sheet.sheet}!{c.ref}: {c.formula} · cached {cellLabel(c)}</li>)}</ul><p>Controls are evidence only and are never added to school detail amounts.</p></details>
      <h3>Still needed for validated revenue and profitability</h3>
      <ul><li>Confirm currency, invoice/payment/service basis, hours meaning, reporting cutoff and complete school coverage.</li><li>Resolve formula errors, ambiguous December, repeated labels, alias mappings, omitted subtotal rows and possible carried-forward activity.</li><li>Provide monthly invoices or receipts, district and therapist IDs, billing basis, quantities, contract rates and effective dates, plus reconciled control totals.</li><li>Approve school/location/provider mappings and reconcile overlap with QuickBooks and PracticePro before combining revenue; provide matching labor and overhead for profit.</li></ul>
      <p>Original: {audit.source.filename} · private Library version {audit.source.libraryVersion}. SHA-256: <code>{audit.source.sha256}</code>. Retained years: {audit.sheets.map(s => s.year).join(', ')}.</p>
      <a href="#csd-source-review" onClick={onReviewSource}>Review school source and missing data</a>
    </details>
  </section>;
}
