import { estimatedFixedOverhead } from './overheadEstimate';
import { cumulativeRevenueSummary } from '../../supabase/functions/_shared/cheshire-cumulative.ts';
import { readCumulativeReports } from './cumulativeReports';
import { CheshireCumulativeReports } from './CheshireCumulativeReports';
import './cumulative-reports.css';
import { useEffect, useState } from 'react';
import { CalendarDays, FileUp, LockKeyhole, RefreshCw } from 'lucide-react';
import { CheshireMonthlyChecklist, CheshireMonthlyIntakeReview } from './CheshireMonthlyIntake';
import { CheshireReportUpload } from './CheshireReportUpload';
import { CheshireValidatedMetrics } from './CheshireValidatedMetrics';
import { CheshireLocationPicker } from './CheshireLocationPicker';
import { CheshireSummaryCategories } from './CheshireSummaryCategories';
import { useIntake } from './intakeContext';
import { useProfitabilityPeriod } from './useProfitabilityPeriod';
import { buildPeriodSheet, headlineOverhead, knownRevenueSummary, periodLabel, type PeriodMode } from './periodSummary';
import { money, type FinanceSnapshot } from './finance';
import type { SheetScope } from './profitabilitySheet';
import './finance-dashboard.css';
import './summary-dashboard.css';
export type FinanceLoadState = 'loading' | 'ready' | 'no-access' | 'empty' | 'error';
/** Summary first. Missing totals remain explicit; source amounts live in expandable detail. */
export function CheshireFinanceDashboardView({ snapshot, state, onRefresh }: { snapshot: FinanceSnapshot | null; state: FinanceLoadState; onRefresh: () => void }) {
 const intake=useIntake();const[scope,setScope]=useState<SheetScope>('all');const[mode,setMode]=useState<PeriodMode>('ytd');const[uploadMonth,setUploadMonth]=useState<string|null>(null);const[detailMonth,setDetailMonth]=useState(intake.month);
 const period=useProfitabilityPeriod(mode,scope);const safeSnapshot=state==='ready'?snapshot:null;const sections=buildPeriodSheet(safeSnapshot,{...period,referenceUnavailable:state==='error'||state==='no-access',referenceLoading:state==='loading'},period.categories);
 const canUpload=intake.state==='ready'&&!intake.busy;
 useEffect(()=>{setUploadMonth(null);setDetailMonth(intake.month);},[intake.month]);
 const statusMessage=state==='no-access'?'Financial access has not been enabled for this account.':state==='empty'?'The first verified overhead source has not been imported.':state==='error'?'The protected financial source is unavailable. No cached or estimated values are being displayed.':state==='loading'?'Loading your protected financial source…':null;
 const summaryState=state==='error'||state==='no-access'||period.failedMonths.length?'Unavailable':state==='loading'||period.state!=='ready'?'Checking':'Missing';
 const cumulativeReports=intake.state==='ready'&&!intake.busy?readCumulativeReports(intake.documents,mode,intake.month):[];
 const cumulativeRevenue=cumulativeRevenueSummary(cumulativeReports,scope);
 const revenue=cumulativeRevenue?{value:cumulativeRevenue.value,label:cumulativeRevenue.label,coverage:cumulativeRevenue.coverage}:knownRevenueSummary(period);
 const expenseFallback=sections.flatMap(section=>section.rows).find(row=>['monthly-overhead','payroll','operating-extra'].includes(row.id)&&row.cells[scope].value!==null);
 const fixedEstimate=estimatedFixedOverhead(safeSnapshot,mode,intake.month,scope);
 const expense=fixedEstimate??headlineOverhead(safeSnapshot,mode,intake.month,scope)??{value:expenseFallback?.cells[scope].value??null,label:expenseFallback?`${expenseFallback.label} · partial source costs`:''};
 const sourceMonths=period.months.filter(month=>(period.responses[month]?.sources.length??0)>0).length;
 const selectedDetailMonth=period.months.includes(detailMonth)?detailMonth:intake.month;
 return <main id="cheshire-financial-summary" className="cfd-dashboard csd-dashboard">
  <h1 className="cps-sr-only">Cheshire financial summary</h1>
  <section className="csd-controls" aria-label="Report filters"><div className="csd-period-switch" role="group" aria-label="Reporting period"><button aria-pressed={mode==='mtd'} onClick={()=>setMode('mtd')}>MTD</button><button aria-pressed={mode==='ytd'} onClick={()=>setMode('ytd')}>YTD</button></div><label><CalendarDays size={16}/><span className="cps-sr-only">Reporting month</span><input type="month" aria-label="Summary reporting month" value={intake.month} onChange={event=>intake.setMonth(event.target.value)}/></label><CheshireLocationPicker value={scope} onChange={setScope}/><button className="csd-refresh" aria-label="Refresh financial summary" title="Refresh source coverage" disabled={state==='loading'||intake.busy||intake.state==='checking'} onClick={()=>{onRefresh();intake.refresh();}}><RefreshCw size={16}/></button><button className="csd-upload" disabled={!canUpload} onClick={()=>setUploadMonth(intake.month)}><FileUp size={17}/> Upload data</button></section>
  {statusMessage?<div className="cfd-status" role="status"><LockKeyhole size={18}/><strong>{statusMessage}</strong></div>:null}
  <section className="csd-totals" aria-label="Revenue expenses and profit summary"><article><span>{cumulativeRevenue?'Reported payments':'Revenue'}</span><strong>{revenue.value!==null?money(revenue.value):'—'}</strong><p className={summaryState==='Missing'?'csd-small-missing':'csd-small-status'}>{summaryState==='Missing'?'Need Data':summaryState==='Checking'?'Checking data':'Some data unavailable'}</p></article><article><span>{fixedEstimate?'Estimated overhead':'Expenses'}</span><strong>{expense.value!==null?money(expense.value):'—'}</strong><p className={summaryState==='Missing'?'csd-small-missing':'csd-small-status'}>{summaryState==='Missing'?'Need Data':summaryState==='Checking'?'Checking data':'Some data unavailable'}</p></article><article><span>Profit</span><strong>—</strong><p className={summaryState==='Missing'?'csd-small-missing':'csd-small-status'}>{summaryState==='Missing'?'Need Data':summaryState==='Checking'?'Checking data':'Some data unavailable'}</p></article></section>
  <div className="csd-detail-heading"><h2>Explore the detail</h2></div>
  {period.state==='loading'?<p className="csd-status" role="status">Checking the selected period and location. Missing months are never zero.</p>:null}
  {period.failedMonths.length?<p className="csd-status" role="status">Could not load {period.failedMonths.join(', ')}. Those months are unavailable; missing uploads have not been established. Refresh to retry.</p>:null}
  {period.mapError?<p className="csd-status" role="status">Some map categories could not be loaded. Refresh to retry.</p>:null}
  <CheshireSummaryCategories sections={sections} scope={scope} revenueReports={<CheshireCumulativeReports reports={cumulativeReports} scope={scope}/>}/>
  <details className="csd-review-panel csd-reporting-details"><summary>Reporting details</summary><div className="csd-reporting-body">{revenue.value!==null?<p>{revenue.label}. Source coverage: {revenue.coverage}. This partial source figure is not a reconciled accounting revenue total.</p>:null}{expense.value!==null&&!fixedEstimate?<p>{expense.label}.</p>:null}<p><strong>{mode.toUpperCase()} · {periodLabel(mode,intake.month)} · {scope==='all'?'All locations':scope}</strong></p><p>{mode==='mtd'?'Monthly reports only; daily MTD cutoff is unverified.':'Reported months from January onward; daily cutoff is unverified.'}</p><p>{period.state==='loading'?'Checking source coverage…':period.state==='ready'?`${sourceMonths}/${period.months.length} months have validated source figures`:'Awaiting validated sources'}</p><p>Amounts appear only after source checks. Profit requires complete, compatible revenue and costs.</p>{fixedEstimate?<p>Expense estimate: known fixed monthly overhead × {fixedEstimate.months} full {fixedEstimate.months===1?'month':'months'}. The owner approved full October in the 2026 estimate. {fixedEstimate.missingCells} original cost cells remain unknown. This is a partial fixed-cost estimate, not reconciled actual expenses; the revenue report may stop earlier in the month.</p>:<p>Fixed monthly overhead is a reference, never multiplied into YTD actuals.</p>}</div></details>
  <details id="csd-source-review" className="csd-review-panel"><summary>Data requests & source review<span>{intake.month}</span></summary><CheshireMonthlyChecklist/><p className="csd-upload-help">Use Upload data above to recognize a report, confirm its mapping and populate supported figures. Original files and source checks stay here.</p><CheshireMonthlyIntakeReview snapshot={safeSnapshot} showUploadActions={false}/></details>
  <details className="csd-review-panel"><summary>Source figures, payer detail & provenance<span>{scope==='all'?'All locations':scope}</span></summary>{mode==='ytd'?<label className="csd-detail-month">Source month<select aria-label="Source detail month" value={selectedDetailMonth} onChange={event=>setDetailMonth(event.target.value)}>{period.months.map(month=><option key={month}>{month}</option>)}</select></label>:null}<CheshireValidatedMetrics data={period.responses[selectedDetailMonth]??null} state={period.state==='ready'?(period.failedMonths.includes(selectedDetailMonth)?'error':'ready'):period.state} month={selectedDetailMonth}/></details>
  {uploadMonth===intake.month&&intake.state==='ready'?<CheshireReportUpload key={intake.month} onClose={()=>setUploadMonth(null)}/>:null}
 </main>;
}
