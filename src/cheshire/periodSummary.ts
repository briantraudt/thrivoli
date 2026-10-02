import { isMonth } from './intake.ts';
import { buildProfitabilitySheet, type MapCategory, type SheetCell, type SheetRow, type SheetScope } from './profitabilitySheet.ts';
import type { FinanceSnapshot } from './finance.ts';
import type { MetricResponse } from './metrics.ts';
export type PeriodMode = 'mtd' | 'ytd';
export type PeriodEvidence = { months: string[]; scope: SheetScope; responses: Partial<Record<string, MetricResponse>>; failedMonths: string[] };
export function reportingMonths(mode: PeriodMode, month: string): string[] {
  if (!isMonth(month) || !['mtd','ytd'].includes(mode)) throw new Error('Invalid reporting period');
  return mode === 'mtd' ? [month] : Array.from({length:Number(month.slice(5,7))}, (_,i)=>`${month.slice(0,4)}-${String(i+1).padStart(2,'0')}`);
}
export function periodLabel(mode: PeriodMode, month: string) {
  const end = new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-US',{month:'short',year:'numeric',timeZone:'UTC'});
  return mode === 'mtd' ? end : `Jan–${end}`;
}
/** Only adds the same source measure/basis across distinct reported months. Never adds a fixed reference across time. */
export function buildPeriodSheet(snapshot: FinanceSnapshot|null, evidence: PeriodEvidence, categories: MapCategory[]) {
  if (new Set(evidence.months).size !== evidence.months.length || evidence.months.length < 1 || evidence.months.length > 12 || evidence.months.some(month=>!isMonth(month))) throw new Error('Invalid period coverage');
  const sheets = evidence.months.map(month=> {
    const response=evidence.responses[month];
    if(response && (response.month!==month || response.location!==evidence.scope)) throw new Error('Mismatched period evidence');
    return buildProfitabilitySheet(null,response?{[evidence.scope]:response}:{},categories);
  });
  return buildProfitabilitySheet(snapshot,{},categories).map(section=> {
    const ids=new Set(section.rows.map(row=>row.id));const rows=[...section.rows];
    for(const sheet of sheets){for(const row of sheet.find(item=>item.id===section.id)!.rows){if(!ids.has(row.id)){ids.add(row.id);const before=rows.findIndex(item=>item.kind!=='value');rows.splice(before<0?rows.length:before,0,row);}}}
    return {...section, rows:rows.map(row=> {
      if(row.id.startsWith('overhead-') || row.id==='known-overhead') return {...row,detail: `${row.detail} · monthly reference, not period actuals`};
      const observed = evidence.months.flatMap((month,index)=> {const candidate=sheets[index].find(item=>item.id===section.id)!.rows.find(item=>item.id===row.id)?.cells[evidence.scope];return candidate?.value!==null && candidate?.value!==undefined ? [{month,cell:candidate}] : [];});
      // Report-as-of figures are snapshots. Different months are not proven disjoint flows.
      if (evidence.months.length>1 && row.id.endsWith('-as-of')) {
        const latest=observed.at(-1);
        const cell:SheetCell=latest?{...latest.cell,coverageLabel:`${latest.month} snapshot · not YTD`,note:`Latest available report-as-of snapshot from ${latest.month}. Snapshots are not added across months; this is not a YTD revenue total. ${latest.cell.note}`}:{...row.cells[evidence.scope],value:null};
        return {...row,cells:{...row.cells,[evidence.scope]:cell}};
      }
      const sum=observed.reduce((total,item)=>total+item.cell.value!,0);
      const known=observed.length;const missing=evidence.months.filter(month=>!observed.some(item=>item.month===month));
      const cell:SheetCell=known && Number.isSafeInteger(sum)?{value:sum,coverageLabel:`${known}/${evidence.months.length} months${missing.length?' · partial':''}`,note:`Same measure and reporting basis only. ${known} of ${evidence.months.length} requested months have source amounts. ${missing.length?`Missing months: ${missing.join(', ')}. `:''}Reported monthly totals; a daily as-of cutoff has not been verified. Not a reconciled business total.`,source:observed.map(({month,cell})=>`${month}: ${cell.source??'Source reference unavailable'}`).join('\n'),sourceType:observed[0].cell.sourceType}:{...row.cells[evidence.scope],value:null,note:(known&&!Number.isSafeInteger(sum)?'Source subtotal exceeds the safe exact numeric range; review is required.':row.cells[evidence.scope].note)+` Requested months: ${evidence.months.join(', ')}. Missing months are never treated as zero.`};
      return {...row,cells:{...row.cells,[evidence.scope]:cell}} as SheetRow;
    })};
  });
}
/** A shared per-view queue bounds even overlapping filter changes to three requests. */
export function createRequestQueue(limit=3){
  let active=0;const pending:Array<()=>void>=[];
  const drain=()=>{while(active<limit&&pending.length){pending.shift()!();}};
  return {run<T>(task:()=>Promise<T>,current:()=>boolean):Promise<T|null>{return new Promise((resolve,reject)=>{pending.push(()=>{if(!current()){resolve(null);queueMicrotask(drain);return;}active++;void task().then(resolve,reject).finally(()=>{active--;drain();});});drain();});}};
}
