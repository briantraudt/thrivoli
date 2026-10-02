import {financeSummary,type FinanceSnapshot} from './finance.ts';
import type {CumulativeScope} from '../../supabase/functions/_shared/cheshire-cumulative.ts';
/** Owner-approved 2026 estimate: count full reporting months, including October. */
export const FIXED_OVERHEAD_ESTIMATE={year:'2026',lastApprovedMonth:'2026-10',basis:'full_calendar_months',approvalDate:'2026-10-02'} as const;
export function estimatedFixedOverhead(snapshot:FinanceSnapshot|null,mode:'mtd'|'ytd',month:string,scope:CumulativeScope){
 if(!snapshot||snapshot.costBasis!=='fixed_monthly_baseline'||!/^2026-(0[1-9]|10)$/.test(month))return null;
 const summary=financeSummary(snapshot,scope);if(!summary.knownCells)return null;
 const months=mode==='ytd'?Number(month.slice(5)):1;const value=summary.knownTotalCents*months;if(!Number.isSafeInteger(value))return null;
 return{value,label:`Fixed overhead estimate · ${months===1?'full month':`${months} full months`}`,months,knownCells:summary.knownCells,missingCells:summary.missingCellCount,monthlyValue:summary.knownTotalCents};
}
