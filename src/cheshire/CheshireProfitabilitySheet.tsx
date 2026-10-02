import { Fragment, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, FileUp, Info } from 'lucide-react';
import { LOCATIONS, money, type FinanceSnapshot } from './finance';
import { buildProfitabilitySheet, type MapCategory, type ScopeMetrics, type SheetCell, type SheetScope } from './profitabilitySheet';
import type { SourceType } from './intake';
import './profitability-sheet.css';

export function CheshireProfitabilitySheet({ snapshot, metrics, categories, location, canUpload, onUpload }: {
  snapshot: FinanceSnapshot | null; metrics: ScopeMetrics; categories: MapCategory[]; location: string; canUpload: boolean; onUpload: (source: SourceType, context: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { if (scroller.current) scroller.current.scrollLeft = 0; }, [location]);
  const sections = buildProfitabilitySheet(snapshot, metrics, categories);
  const scopes: SheetScope[] = [...LOCATIONS.filter(name => location === 'all' || name === location), 'all'];
  return <section className="cps-sheet" aria-labelledby="cps-title">
    <header className="cps-sheet-heading"><div><h2 id="cps-title">The profitability sheet</h2><p>Locations across. Revenue and every cost flowing down to profit.</p></div><span>USD · source-supported amounts</span></header>
    <div className="cps-scroll-hint" id="cps-help"><span>Scroll across for all locations. Row labels and headers stay in view.</span><span><i className="cps-unknown-key"/> Unknown <i className="cps-source-key"/> Source amount</span></div>
    <div ref={scroller} className="cps-scroll" role="region" aria-label="Profitability by location, scrollable spreadsheet" aria-describedby="cps-help" tabIndex={0}>
      <table className={`cps-table ${location !== 'all' ? 'cps-filtered' : ''}`}>
        <caption className="cps-sr-only">Source-backed profitability by location. Unknown cells offer uploads. Reference overhead and unlike revenue bases are not combined into profit.</caption>
        <colgroup><col className="cps-label-col"/>{scopes.map(scope => <col key={scope}/>)}</colgroup>
        <thead><tr><th scope="col">Revenue / cost category<span>Expand a value for its source</span></th>{scopes.map(scope => <th scope="col" key={scope} className={scope === 'all' ? 'cps-company' : ''}>{scope === 'all' ? 'All-source subtotal' : scope}<span>{scope === 'all' ? 'Coverage varies by source' : 'Location evidence only'}</span></th>)}</tr></thead>
        {sections.map(section => <tbody key={section.id} className={`cps-section cps-${section.id}`}>
          <tr className="cps-section-row"><th scope="row"><button aria-expanded={!collapsed.has(section.id)} aria-controls={`cps-rows-${section.id}`} onClick={() => setCollapsed(prior => { const next = new Set(prior); if (next.has(section.id)) next.delete(section.id); else next.add(section.id); return next; })}>{collapsed.has(section.id) ? <ChevronRight size={15}/> : <ChevronDown size={15}/>} {section.title}</button></th><td colSpan={scopes.length}>{section.note}</td></tr>
          <Fragment key={`cps-rows-${section.id}`}>
            {section.rows.map((row, index) => <tr key={row.id} id={index === 0 ? `cps-rows-${section.id}` : undefined} hidden={collapsed.has(section.id)} className={`cps-row cps-${row.kind}`}>
              <th scope="row"><strong>{row.label}</strong><span>{row.detail}</span></th>
              {scopes.map(scope => <td key={scope} className={scope === 'all' ? 'cps-company' : ''}><SheetValue cell={row.cells[scope]} label={`${row.label} · ${scope === 'all' ? 'all-source subtotal' : scope}`} result={row.kind === 'result'} canUpload={canUpload} onUpload={onUpload}/></td>)}
            </tr>)}
          </Fragment>
        </tbody>)}
      </table>
    </div>
    <footer className="cps-sheet-footer"><Info size={15}/><p>Known subtotals are partial. Map categories may overlap payroll or overhead, so they are not added twice. Profit stays unavailable until revenue, cost coverage and accounting periods reconcile.</p></footer>
  </section>;
}
function SheetValue({ cell, label, result, canUpload, onUpload }: { cell: SheetCell; label: string; result: boolean; canUpload: boolean; onUpload: (source: SourceType, context: string) => void }) {
  return cell.value !== null ? <details className="cps-value"><summary aria-label={`${label}: ${money(cell.value)}. View source`}><span>{money(cell.value)}{cell.coverageLabel ? <small>{cell.coverageLabel}</small> : null}</span><Info size={12}/></summary><div><p>{cell.note}</p>{cell.source ? <p className="cps-provenance">{cell.source}</p> : null}</div></details> : <div className="cps-missing"><details className="cps-reason"><summary aria-label={`${label}: ${result ? 'not yet available' : 'unknown'}. View what is needed`}>{result ? 'Not yet available' : 'Unknown'}</summary><div><p>{cell.note}</p>{cell.source ? <p>{cell.source}</p> : null}</div></details>{cell.sourceType ? <button disabled={!canUpload} title={cell.note} aria-label={`Upload ${label}`} onClick={() => onUpload(cell.sourceType!, label)}><FileUp size={12}/> Upload</button> : <small>Reconciliation needed</small>}{cell.source ? <small className="cps-cell-reference" title={cell.source}>Blank source cell</small> : null}</div>;
}
