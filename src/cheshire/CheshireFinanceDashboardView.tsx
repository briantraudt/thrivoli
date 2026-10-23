import { estimatedFixedOverhead } from './overheadEstimate';
import { cumulativeRevenueSummary } from '../../supabase/functions/_shared/cheshire-cumulative.ts';
import { readCumulativeReports } from './cumulativeReports';
import { CheshireCumulativeReports } from './CheshireCumulativeReports';
import { CheshireSchoolIncome } from './CheshireSchoolIncome';
import { CheshireSchoolFilters } from './CheshireSchoolFilters';
import { filterSelectedSchoolMetrics, schoolFilterIdentity, schoolFilterOptions } from './schoolFilters';
import { readSchoolIncomeSource } from './schoolIncomeSource';
import { CheshirePayrollSource } from './CheshirePayrollSource';
import { readPayrollSourceSummary } from './payrollSourceAudit';
import './cumulative-reports.css';
import { useEffect, useRef, useState } from 'react';
import { CalendarDays, FileUp, LockKeyhole, RefreshCw } from 'lucide-react';
import { CheshireMonthlyChecklist, CheshireMonthlyIntakeReview } from './CheshireMonthlyIntake';
import { CheshireReportUpload } from './CheshireReportUpload';
import { CheshireValidatedMetrics } from './CheshireValidatedMetrics';
import { CheshireLocationPicker } from './CheshireLocationPicker';
import { CheshireSummaryCategories } from './CheshireSummaryCategories';
import { CheshireOwnerSummary } from './CheshireOwnerSummary';
import { useIntake } from './intakeContext';
import { useProfitabilityPeriod } from './useProfitabilityPeriod';
import { buildPeriodSheet, headlineOverhead, knownRevenueSummary, periodLabel, type PeriodMode } from './periodSummary';
import { money, type FinanceSnapshot } from './finance';
import { filterProfitCenterMetrics, metricLocationScope, profitCenterLabel, type ProfitCenterScope } from './profitCenterScope';
import './finance-dashboard.css';
import './summary-dashboard.css';
export type FinanceLoadState = 'loading' | 'ready' | 'no-access' | 'empty' | 'error';
function cardCopy(summaryState:'Unavailable'|'Checking'|'Missing', kind:'revenue'|'expense'|'profit', hasValue:boolean, schools:boolean){
 if(summaryState==='Checking')return {text:'Checking data', className:'csd-small-status'};
 if(summaryState==='Unavailable')return {text:'Some data unavailable', className:'csd-small-status'};
 if(kind==='profit')return {text:'Not calculated yet', className:'csd-small-status'};
 if(hasValue)return {text:kind==='revenue'?'Partial · not profit':'Partial · not a full total', className:'csd-small-status'};
 return {text:kind==='revenue'?(schools?'Needs the school workbook or invoices':'Needs a PracticePro or QuickBooks payments export'):(schools?'Needs therapist time and payroll':'Needs the overhead workbook'), className:'csd-small-missing'};
}
/** Summary first. Missing totals remain explicit; source amounts live in expandable detail. */
export function CheshireFinanceDashboardView({ snapshot, state, onRefresh }: { snapshot: FinanceSnapshot | null; state: FinanceLoadState; onRefresh: () => void }) {
 const sourceReviewRef=useRef<HTMLDetailsElement>(null);
 const lastSchoolIdentity=useRef<string|null>(null);
 const intake=useIntake();const[selectedScope,setSelectedScope]=useState<ProfitCenterScope>('all');const[mode,setMode]=useState<PeriodMode>('ytd');const[uploadMonth,setUploadMonth]=useState<string|null>(null);const[detailMonth,setDetailMonth]=useState(intake.month);const[schoolSelection,setSchoolSelection]=useState('all');
 const schools=selectedScope==='schools';const scope=metricLocationScope(selectedScope);const scopeLabel=profitCenterLabel(selectedScope);
 const loadedPeriod=useProfitabilityPeriod(mode,scope);const sourcesVisible=(state==='ready'||state==='empty')&&intake.state==='ready'&&!intake.busy;
 const schoolSource=sourcesVisible?readSchoolIncomeSource(intake.documents,intake.month):{source:null,issue:null};
 const schoolIdentity=schoolFilterIdentity(schoolSource,intake.month);const schoolOptions=schoolFilterOptions(schoolSource,intake.month);
 const schoolValue=schoolOptions.some(option=>option.value===schoolSelection)?schoolSelection:'all';
 const selectedSchool=schools?schoolOptions.find(option=>option.value===schoolValue)??null:null;
 const detailScopeLabel=selectedSchool?`${scopeLabel} · ${selectedSchool.label}`:scopeLabel;
 const schoolYear=intake.month.slice(0,4);
 useEffect(()=>{setSchoolSelection('all');},[schoolYear]);
 useEffect(()=>{
  if(schoolIdentity){if(lastSchoolIdentity.current!==schoolIdentity)setSchoolSelection('all');lastSchoolIdentity.current=schoolIdentity;}
  else if(sourcesVisible||state==='no-access'||intake.state==='no-access'){lastSchoolIdentity.current=null;setSchoolSelection('all');}
 },[schoolIdentity,sourcesVisible,state,intake.state]);
 const period={...loadedPeriod,responses:sourcesVisible?Object.fromEntries(Object.entries(loadedPeriod.responses).map(([month,response])=>[month,filterSelectedSchoolMetrics(filterProfitCenterMetrics(response!,selectedScope),!!selectedSchool)])):{}};
 const safeSnapshot=state==='ready'&&!schools?snapshot:null;
 const categories=selectedScope==='all'?period.categories:period.categories.filter(category=>category.segment_index!==1);
 const sections=schools?[]:buildPeriodSheet(safeSnapshot,{...period,referenceUnavailable:state==='error'||state==='no-access',referenceLoading:state==='loading'},categories).map(section=>selectedScope!=='all'&&section.id==='revenue'?{...section,note:'Clinic reporting. Different accounting bases stay separate.',rows:section.rows.filter(row=>row.id!=='schools')}:section);
 const canUpload=intake.state==='ready'&&!intake.busy;
 useEffect(()=>{setUploadMonth(null);setDetailMonth(intake.month);},[intake.month]);
 const statusMessage=state==='no-access'?'Financial access has not been enabled for this account.':state==='empty'?(schools?null:'The first verified overhead source has not been imported.'):state==='error'?'The protected financial source is unavailable. No cached or estimated values are being displayed.':state==='loading'?'Loading your protected financial source…':null;
 const summaryState=state==='error'||state==='no-access'||period.failedMonths.length?'Unavailable':state==='loading'||period.state!=='ready'?'Checking':'Missing';
 const cumulativeReports=!schools&&sourcesVisible?readCumulativeReports(intake.documents,mode,intake.month):[];
 const payrollSource=!schools&&sourcesVisible?readPayrollSourceSummary(intake.documents,mode,intake.month,scope):null;
 const cumulativeRevenue=cumulativeRevenueSummary(cumulativeReports,scope);
 const revenue=cumulativeRevenue?{value:cumulativeRevenue.value,label:cumulativeRevenue.label,coverage:cumulativeRevenue.coverage}:knownRevenueSummary(period);
 const expenseFallback=sections.flatMap(section=>section.rows).find(row=>['monthly-overhead','payroll','operating-extra'].includes(row.id)&&row.cells[scope].value!==null);
 const fixedEstimate=estimatedFixedOverhead(safeSnapshot,mode,intake.month,scope);
 const expense=schools?{value:null,label:'School therapist labor is not yet verified'}:fixedEstimate??headlineOverhead(safeSnapshot,mode,intake.month,scope)??{value:expenseFallback?.cells[scope].value??null,label:expenseFallback?`${expenseFallback.label} · partial source costs`:''};
 const sourceMonths=period.months.filter(month=>(period.responses[month]?.sources.length??0)>0).length;
 const selectedDetailMonth=period.months.includes(detailMonth)?detailMonth:intake.month;
 return <main id="cheshire-financial-summary" className="cfd-dashboard csd-dashboard">
  <h1 className="cps-sr-only">Cheshire financial summary</h1>
  <section className="csd-controls" aria-label="Report filters"><div className="csd-period-switch" role="group" aria-label="Reporting period"><button aria-pressed={mode==='mtd'} onClick={()=>setMode('mtd')}>MTD</button><button aria-pressed={mode==='ytd'} onClick={()=>setMode('ytd')}>YTD</button></div><label><CalendarDays size={16}/><span className="cps-sr-only">Reporting month</span><input type="month" aria-label="Summary reporting month" value={intake.month} onChange={event=>intake.setMonth(event.target.value)}/></label><CheshireLocationPicker value={selectedScope} onChange={setSelectedScope}/>{schools?<CheshireSchoolFilters options={schoolOptions} value={schoolValue} onChange={setSchoolSelection}/>:null}<button className="csd-refresh" aria-label="Refresh financial summary" title="Refresh source coverage" disabled={state==='loading'||intake.busy||intake.state==='checking'} onClick={()=>{onRefresh();intake.refresh();}}><RefreshCw size={16}/></button><button className="csd-upload" disabled={!canUpload} onClick={()=>setUploadMonth(intake.month)}><FileUp size={17}/> Upload data</button></section>
  {schools?<p id="csd-school-filter-help" className="csd-school-filter-help">{selectedSchool?`Showing ${selectedSchool.label} · ${intake.month.slice(0,4)} source row ${selectedSchool.row}.`:schoolOptions.length?`All schools listed in the ${intake.month.slice(0,4)} source.`:'School options will appear when a verified source is available for this year.'} Therapist assignments are not available in the current dashboard sources. Verified school/therapist work time and matching payroll are needed for labor and profit.</p>:null}
  {statusMessage?<div className="cfd-status" role="status"><LockKeyhole size={18}/><strong>{statusMessage}</strong></div>:null}
  <section className="csd-totals" aria-label="Revenue expenses and profit summary"><article><span title={revenue.value!==null?`${revenue.label}. Coverage: ${revenue.coverage}. This is not profit.`:(schools?'School income is missing. The school workbook or monthly invoices supply it.':'Payments are missing. A PracticePro or QuickBooks payments export supplies them.')}>{schools?'Validated school invoices':cumulativeRevenue?'Reported payments':selectedScope==='all'?'Revenue source subtotal':'Revenue'}</span><strong title={revenue.value!==null?`${revenue.label}. Not profit.`:schools?'Needs the school workbook or invoices.':'Needs a PracticePro or QuickBooks payments export.'}>{revenue.value!==null?money(revenue.value):'—'}</strong><p className={cardCopy(summaryState,'revenue',revenue.value!==null,schools).className}>{cardCopy(summaryState,'revenue',revenue.value!==null,schools).text}</p></article><article><span title={expense.value!==null?`${expense.label}. This budget is not actual spending and is not subtracted from payments.`:(schools?'School labor is missing. Therapist time and payroll supply it.':'Overhead is missing. The 2026 overhead workbook supplies the budget.')}>{schools?'School therapist labor':fixedEstimate?'Estimated overhead':'Expenses'}</span><strong title={expense.value!==null?expense.label:(schools?'Needs therapist time and payroll.':'Needs the overhead workbook.')}>{expense.value!==null?money(expense.value):'—'}</strong><p className={cardCopy(summaryState,'expense',expense.value!==null,schools).className}>{cardCopy(summaryState,'expense',expense.value!==null,schools).text}</p></article><article><span title="Profit is not calculated. Payment dates, service dates, invoices, the overhead budget, and pay dates are different clocks and are not subtracted from each other.">{schools?'School profit':'Profit'}</span><strong title="Profit is not calculated. Mixed reporting clocks are not subtracted from each other.">—</strong><p className={cardCopy(summaryState,'profit',false,schools).className}>{cardCopy(summaryState,'profit',false,schools).text}</p></article></section>
  <p className="csd-scope-note">{schools?'Schools is an independent profit center. Therapist labor is its expense; Clinics absorb all non-therapist overhead. School profit is unavailable until matching therapist labor and compatible revenue are verified.':selectedScope==='all'?'All profit centers shows clinic reporting and Schools separately. School workbook observations and invoices are not added to PracticePro or QuickBooks payments until overlap and accounting basis are reconciled. There is no consolidated revenue or profit total yet.':`${scopeLabel} clinic reporting. Select Schools for the independent school profit center.`}</p>
  <CheshireOwnerSummary snapshot={summaryState==='Missing'&&state==='ready'?snapshot:null} mode={mode} month={intake.month} scope={selectedScope} checking={summaryState==='Checking'} unavailable={summaryState==='Unavailable'} onOpenLocation={setSelectedScope}/>
  <CheshirePayrollSource summary={payrollSource} onReviewSource={()=>{intake.setSelected('payroll');if(sourceReviewRef.current)sourceReviewRef.current.open=true;}}/>
  {(schools||selectedScope==='all')?<CheshireSchoolIncome result={schoolSource} selectedRow={selectedSchool?.row} mode={mode} month={intake.month} onReviewSource={()=>{intake.setSelected('school_billing');if(sourceReviewRef.current)sourceReviewRef.current.open=true;}}/>:null}
  {schools&&sourcesVisible&&!schoolSource.source&&!schoolSource.issue?<p className="csd-status" role="status">No historical school workbook is available for this reporting year. Validated monthly school invoices, when available, remain a separate source below.</p>:null}
  <div className="csd-detail-heading"><h2>Explore the detail</h2></div>
  {period.state==='loading'?<p className="csd-status" role="status">Checking the selected period and profit center. Missing months are never zero.</p>:null}
  {period.failedMonths.length?<p className="csd-status" role="status">Could not load {period.failedMonths.join(', ')}. Those months are unavailable; missing uploads have not been established. Refresh to retry.</p>:null}
  {!schools&&period.mapError?<p className="csd-status" role="status">Some map categories could not be loaded. Refresh to retry.</p>:null}
  {!schools?<CheshireSummaryCategories sections={sections} scope={scope} scopeLabel={scopeLabel} revenueReports={<CheshireCumulativeReports reports={cumulativeReports} scope={scope}/>}/>:<p className="csd-reference-note">The school workbook and monthly invoices may describe the same income. They are separate source views and are never added together. Missing school labor is unknown, not zero.</p>}
  <details className="csd-review-panel csd-reporting-details"><summary>Reporting details</summary><div className="csd-reporting-body">{revenue.value!==null?<p>{revenue.label}. Source coverage: {revenue.coverage}. This partial source figure is not a reconciled accounting revenue total.</p>:null}{expense.value!==null&&!fixedEstimate?<p>{expense.label}.</p>:null}<p><strong>{mode.toUpperCase()} · {periodLabel(mode,intake.month)} · {detailScopeLabel}</strong></p><p>{mode==='mtd'?'Monthly reports only; daily MTD cutoff is unverified.':'Reported months from January onward; daily cutoff is unverified.'}</p><p>{period.state==='loading'?'Checking source coverage…':period.state==='ready'?`${sourceMonths}/${period.months.length} months have validated source figures`:'Awaiting validated sources'}</p><p>{schools?'School invoices remain separate from reported workbook income. Profit requires verified therapist labor and compatible school revenue.':'Amounts appear only after source checks. Profit requires complete, compatible revenue and costs.'}</p>{schools?<p>Non-therapist overhead belongs to Clinics under the owner’s policy; no school overhead allocation is required.</p>:fixedEstimate?<p>Expense estimate: known fixed monthly overhead × {fixedEstimate.months} full {fixedEstimate.months===1?'month':'months'}. The 2026 budget estimate applies to every month of 2026, including November and December. It is still an estimate. {fixedEstimate.missingCells} original cost cells remain unknown and are not treated as zero. This is not reconciled actual expenses, and the revenue report may stop earlier in the month.</p>:<p>Fixed monthly overhead is a reference, never multiplied into YTD actuals.</p>}</div></details>
  <details ref={sourceReviewRef} id="csd-source-review" className="csd-review-panel"><summary>Workspace-wide data requests & source review<span>{intake.month}</span></summary><CheshireMonthlyChecklist/><p className="csd-upload-help">These requests cover the entire workspace across profit centers. Use Upload data above to recognize a report, confirm its mapping and populate supported figures. Original files and source checks stay here.</p><CheshireMonthlyIntakeReview snapshot={safeSnapshot} showUploadActions={false}/></details>
  <details className="csd-review-panel"><summary>{schools?'School source figures & provenance':'Source figures, payer detail & provenance'}<span>{detailScopeLabel}</span></summary>{mode==='ytd'?<label className="csd-detail-month">Source month<select aria-label="Source detail month" value={selectedDetailMonth} onChange={event=>setDetailMonth(event.target.value)}>{period.months.map(month=><option key={month}>{month}</option>)}</select></label>:null}<CheshireValidatedMetrics scopeLabel={detailScopeLabel} data={period.responses[selectedDetailMonth]??null} state={period.state==='ready'?(period.failedMonths.includes(selectedDetailMonth)?'error':'ready'):period.state} month={selectedDetailMonth}/></details>
  {uploadMonth===intake.month&&intake.state==='ready'?<CheshireReportUpload key={intake.month} onClose={()=>setUploadMonth(null)}/>:null}
 </main>;
}
