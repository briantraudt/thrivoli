import {reportingMonths} from './periodSummary.ts';
import {financeSummary,type FinanceSnapshot} from './finance.ts';
import type {CumulativeScope} from '../../supabase/functions/_shared/cheshire-cumulative.ts';
/** Owner-approved 2026 monthly estimate. Every full calendar month in 2026 uses the same baseline, including November and December. Other years are not estimated. */
export const FIXED_OVERHEAD_ESTIMATE={year:'2026',lastApprovedMonth:'2026-12',basis:'full_calendar_months',approvalDate:'2026-10-02'} as const;
export function estimatedFixedOverhead(snapshot:FinanceSnapshot|null,mode:'mtd'|'ytd',month:string,scope:CumulativeScope,selectedMonths?:readonly string[]){
 if(!snapshot||snapshot.costBasis!=='fixed_monthly_baseline'||!/^2026-(0[1-9]|1[0-2])$/.test(month))return null;
 const requested=reportingMonths(mode,month,selectedMonths);if(requested.some(value=>!/^2026-(0[1-9]|1[0-2])$/.test(value)))return null;
 const summary=financeSummary(snapshot,scope);if(!summary.knownCells)return null;
 const months=requested.length;const value=summary.knownTotalCents*months;if(!Number.isSafeInteger(value)||months<1)return null;
 return{value,label:`Fixed overhead estimate · ${months===1?'full month':`${months} full months`}`,months,knownCells:summary.knownCells,missingCells:summary.missingCellCount,monthlyValue:summary.knownTotalCents};
}
