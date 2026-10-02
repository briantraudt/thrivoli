import { ChevronDown, Info } from 'lucide-react';
import { money } from './finance';
import type { SheetCell, SheetSection, SheetScope } from './profitabilitySheet';
const titles:Record<string,{title:string;detail:string}>={revenue:{title:'Revenue',detail:'Clinic payments, school billing & private programs'},labor:{title:'Labor',detail:'Payroll, benefits & staff allocation'},overhead:{title:'Location overhead',detail:'Original overhead source · monthly reference'},operations:{title:'Operating & shared costs',detail:'Operating expenses, location costs & shared services'},profit:{title:'Profit & reconciliation',detail:'What is still needed for a complete profit calculation'}};
export function CheshireSummaryCategories({sections,scope}:{sections:SheetSection[];scope:SheetScope}){
 return <section className="csd-categories" aria-label="Expandable financial categories">{sections.map(section=>{
   const known=section.rows.filter(row=>row.cells[scope].value!==null).length;const meta=titles[section.id];
   return <details className={`csd-category csd-category-${section.id}`} key={section.id}><summary><div><h2>{meta.title}</h2><p>{meta.detail}</p></div><span className={known?'csd-has-data':'csd-missing'}>{section.id==='overhead'&&known?'Partial reference':known?'Source figures':'Missing'}</span><ChevronDown size={18}/></summary>
    <div className="csd-category-body"><p className="csd-category-note">{section.note}</p><table className="csd-detail-table"><caption className="cps-sr-only">{meta.title} · {scope==='all'?'All locations':scope}. Missing figures are not zero.</caption><thead><tr><th scope="col">Category</th><th scope="col">{scope==='all'?'All locations':scope}<small>USD · source subtotals</small></th></tr></thead><tbody>{section.rows.map(row=><tr key={row.id} className={`csd-row-${row.kind}`}><th scope="row"><strong>{row.label}</strong><small>{row.detail}</small></th><td><EvidenceValue cell={row.cells[scope]} label={`${row.label} · ${scope==='all'?'All locations':scope}`}/></td></tr>)}</tbody></table></div>
   </details>;
 })}</section>;
}
function EvidenceValue({cell,label}:{cell:SheetCell;label:string}){
 return <details className={`csd-evidence ${cell.value===null?'csd-is-missing':''}`}><summary aria-label={`${label}: ${cell.value===null?'Missing':money(cell.value)}. View source and coverage`}><span>{cell.value===null?'Missing':money(cell.value)}{cell.value!==null&&cell.coverageLabel?<small>{cell.coverageLabel}</small>:null}</span><Info size={12}/></summary><div><p>{cell.note}</p>{cell.source?<p className="csd-provenance">{cell.source}</p>:null}</div></details>;
}
