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
import { CalendarDays, FileUp, LockKeyhole, RefreshCw, UsersRound } from 'lucide-react';
import { CheshireMonthlyChecklist, CheshireMonthlyIntakeReview } from './CheshireMonthlyIntake';
import { CheshireReportUpload } from './CheshireReportUpload';
import { CheshireValidatedMetrics } from './CheshireValidatedMetrics';
import { CheshireLocationPicker } from './CheshireLocationPicker';
import { CheshireSummaryCategories } from './CheshireSummaryCategories';
import { CheshireOwnerSummary } from './CheshireOwnerSummary';
import { CategoryBoard } from './CheshireExecutive';
import { useIntake } from './intakeContext';
import { useProfitabilityPeriod } from './useProfitabilityPeriod';
import { buildPeriodSheet, periodLabel, type PeriodMode } from './periodSummary';
import { financeSummary, money, type FinanceSnapshot, type LocationName } from './finance';
import { filterProfitCenterMetrics, metricLocationScope, profitCenterLabel, type ProfitCenterScope } from './profitCenterScope';
import {
  buildExecutive, collectMetricCents, comparisonText, comparisonWindows, executiveMonths, executiveSearch, overheadCategoryBreakdown,
  parseExecutiveSearch, periodTitle, readTherapistIds, type ExecutivePeriod, type MoneyPart,
} from './executiveView';
import './finance-dashboard.css';
import './summary-dashboard.css';
import './executive-dashboard.css';

export type FinanceLoadState = 'loading' | 'ready' | 'no-access' | 'empty' | 'error';
export type SampleParts = { clinic: MoneyPart | null; schools: MoneyPart | null; cash: MoneyPart | null };

function cardCopy(summaryState: 'Unavailable' | 'Checking' | 'Missing', kind: 'revenue' | 'expense' | 'profit', hasValue: boolean, waiting: string) {
  if (summaryState === 'Checking') return { text: 'Checking data', className: 'csd-small-status' };
  if (kind === 'profit') return { text: hasValue ? 'Same reporting basis' : summaryState === 'Unavailable' ? 'Some data unavailable' : 'Not calculated yet', className: 'csd-small-status' };
  if (hasValue) return { text: kind === 'revenue' ? 'Partial · not profit' : 'Partial · not a full total', className: 'csd-small-status' };
  if (summaryState === 'Unavailable') return { text: 'Some data unavailable', className: 'csd-small-status' };
  return { text: waiting, className: 'csd-small-missing' };
}

function budgetFor(snapshot: FinanceSnapshot | null, scope: ProfitCenterScope, months: readonly string[]): (MoneyPart & { months: number }) | null {
  if (!snapshot || snapshot.costBasis !== 'fixed_monthly_baseline' || scope === 'schools' || scope === 'cash') return null;
  if (!months.length || months.some(month => !/^2026-(0[1-9]|1[0-2])$/.test(month))) return null;
  const summary = financeSummary(snapshot, scope);
  if (!summary.knownCells) return null;
  const cents = summary.knownTotalCents * months.length;
  return Number.isSafeInteger(cents) ? { cents, basis: '2026 overhead budget', partial: summary.missingCellCount > 0, months: months.length } : null;
}

function metricPart(responses: Parameters<typeof collectMetricCents>[0], months: readonly string[], source: string, keys: readonly string[], basis: string): MoneyPart | null {
  const collected = collectMetricCents(responses, months, source, keys, basis);
  return collected ? { cents: collected.cents, basis, partial: collected.partial } : null;
}

function initialFilters() {
  if (typeof window === 'undefined') return { period: 'ytd' as ExecutivePeriod, location: 'all' as ProfitCenterScope, therapist: 'all', month: null as string | null };
  const parsed = parseExecutiveSearch(window.location.search);
  return { period: parsed.period, location: parsed.location, therapist: parsed.therapist, month: parsed.month };
}

/** Executive summary first. Missing totals stay blank; source amounts stay in the rows below. */
export function CheshireFinanceDashboardView({ snapshot, state, onRefresh, sampleParts, sampleBanner }: {
  snapshot: FinanceSnapshot | null; state: FinanceLoadState; onRefresh: () => void; sampleParts?: SampleParts; sampleBanner?: string;
}) {
  const sourceReviewRef = useRef<HTMLDetailsElement>(null);
  const lastSchoolIdentity = useRef<string | null>(null);
  const intake = useIntake();
  const starting = initialFilters();
  const [selectedScope, setSelectedScope] = useState<ProfitCenterScope>(starting.location);
  const [period, setPeriod] = useState<ExecutivePeriod>(starting.period);
  const [therapist, setTherapist] = useState(starting.therapist);
  const [uploadMonth, setUploadMonth] = useState<string | null>(null);
  const [detailMonth, setDetailMonth] = useState(intake.month);
  const [schoolSelection, setSchoolSelection] = useState('all');
  const [openLine, setOpenLine] = useState<string | null>(null);
  const schools = selectedScope === 'schools';
  const cash = selectedScope === 'cash';
  const scope = metricLocationScope(selectedScope);
  const scopeLabel = profitCenterLabel(selectedScope);
  const legacyMode: PeriodMode = period === 'month' ? 'mtd' : 'ytd';
  const currentMonths = executiveMonths(period, intake.month);
  const loadedPeriod = useProfitabilityPeriod(legacyMode, scope, period === 'quarter' || period === 't12' ? currentMonths : undefined, !sampleParts);
  const sourcesVisible = (state === 'ready' || state === 'empty') && intake.state === 'ready' && !intake.busy;
  const schoolSource = sourcesVisible ? readSchoolIncomeSource(intake.documents, intake.month) : { source: null, issue: null };
  const schoolIdentity = schoolFilterIdentity(schoolSource, intake.month);
  const schoolOptions = schoolFilterOptions(schoolSource, intake.month);
  const schoolValue = schoolOptions.some(option => option.value === schoolSelection) ? schoolSelection : 'all';
  const selectedSchool = schools ? schoolOptions.find(option => option.value === schoolValue) ?? null : null;
  const detailScopeLabel = selectedSchool ? `${scopeLabel} · ${selectedSchool.label}` : scopeLabel;
  const schoolYear = intake.month.slice(0, 4);
  const therapistIds = readTherapistIds(intake.documents);
  const therapistOptions = therapist !== 'all' && !therapistIds.includes(therapist) ? [therapist, ...therapistIds] : therapistIds;
  useEffect(() => { setSchoolSelection('all'); }, [schoolYear]);
  useEffect(() => {
    if (schoolIdentity) { if (lastSchoolIdentity.current !== schoolIdentity) setSchoolSelection('all'); lastSchoolIdentity.current = schoolIdentity; }
    else if (sourcesVisible || state === 'no-access' || intake.state === 'no-access') { lastSchoolIdentity.current = null; setSchoolSelection('all'); }
  }, [schoolIdentity, sourcesVisible, state, intake.state]);
  const intakeRef = useRef(intake);
  intakeRef.current = intake;
  const urlReady = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const apply = (search: string) => {
      const next = parseExecutiveSearch(search);
      setPeriod(next.period); setSelectedScope(next.location); setTherapist(next.therapist); setOpenLine(null);
      if (next.month) intakeRef.current.setMonth(next.month);
    };
    if (!urlReady.current) {
      urlReady.current = true;
      const parsed = parseExecutiveSearch(window.location.search);
      if (parsed.month && parsed.month !== intakeRef.current.month) intakeRef.current.setMonth(parsed.month);
    }
    const onPop = () => apply(window.location.search);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined' || !urlReady.current) return;
    const parsed = parseExecutiveSearch(window.location.search);
    if (parsed.month && parsed.month !== intake.month) return;
    const next = executiveSearch({ period, location: selectedScope, therapist, month: intake.month });
    if (next === window.location.search.replace(/^\?/, '')) return;
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash}`);
  }, [period, selectedScope, therapist, intake.month]);
  const periodResponses = sourcesVisible ? Object.fromEntries(Object.entries(loadedPeriod.responses).map(([month, response]) => [month, filterSelectedSchoolMetrics(filterProfitCenterMetrics(response!, selectedScope), !!selectedSchool)])) : {};
  const periodView = { ...loadedPeriod, responses: periodResponses };
  const safeSnapshot = state === 'ready' && !schools && !cash ? snapshot : null;
  const categories = selectedScope === 'all' ? periodView.categories : periodView.categories.filter(category => category.segment_index !== 1);
  const sections = schools || cash ? [] : buildPeriodSheet(safeSnapshot, { ...periodView, referenceUnavailable: state === 'error' || state === 'no-access', referenceLoading: state === 'loading' }, categories).map(section => selectedScope !== 'all' && section.id === 'revenue' ? { ...section, note: 'Clinic reporting. Different accounting bases stay separate.', rows: section.rows.filter(row => row.id !== 'schools') } : section);
  const canUpload = intake.state === 'ready' && !intake.busy;
  useEffect(() => { setUploadMonth(null); setDetailMonth(intake.month); }, [intake.month]);
  const statusMessage = state === 'no-access' ? 'Financial access has not been enabled for this account.' : state === 'empty' ? (schools ? null : 'The first verified overhead source has not been imported.') : state === 'error' ? 'The protected financial source is unavailable. No cached or estimated values are being displayed.' : state === 'loading' ? 'Loading your protected financial source…' : null;
  const summaryState = state === 'error' || state === 'no-access' || periodView.failedMonths.length ? 'Unavailable' : state === 'loading' || periodView.state !== 'ready' ? 'Checking' : 'Missing';
  const cumulativeReports = !schools && !cash && period === 'ytd' && sourcesVisible ? readCumulativeReports(intake.documents, legacyMode, intake.month) : [];
  const payrollSource = selectedScope === 'all' && sourcesVisible ? readPayrollSourceSummary(intake.documents, legacyMode, intake.month, scope, currentMonths) : null;
  const cumulativeRevenue = cumulativeReports.length ? cumulativeRevenueSummary(cumulativeReports, scope) : null;
  const windows = comparisonWindows(period, intake.month);
  const priorLabel = period === 'ytd' || period === 't12' ? 'prior year' : 'prior period';
  const overhead = budgetFor(safeSnapshot, selectedScope, currentMonths);
  const priorOverheadMonths = overhead && windows.priorPeriod.every(month => /^2026-/.test(month)) ? windows.priorPeriod.length : null;
  const monthlyBudget = overhead ? overhead.cents / overhead.months : null;
  const priorOverhead = monthlyBudget !== null && priorOverheadMonths !== null ? monthlyBudget * priorOverheadMonths : null;
  const clinic = sampleParts
    ? selectedScope === 'all' ? sampleParts.clinic : null
    : schools || cash ? null
      : cumulativeRevenue?.value != null
        ? { cents: cumulativeRevenue.value, basis: cumulativeRevenue.label, partial: false }
        : metricPart(periodResponses, currentMonths, 'insurance_revenue', ['insurance_payments', 'patient_payments'], 'payment_date');
  const schoolRevenue = sampleParts
    ? selectedScope === 'all' || schools ? sampleParts.schools : null
    : selectedScope === 'all' || schools ? metricPart(periodResponses, currentMonths, 'school_billing', ['school_invoices'], 'invoice_reported_month') : null;
  const cashRevenue = sampleParts
    ? selectedScope === 'all' || cash ? sampleParts.cash : null
    : selectedScope === 'all' || cash ? metricPart(periodResponses, currentMonths, 'cash_programs', ['cash_program_income'], 'program_reported_month') : null;
  const payroll = payrollSource ? { cents: payrollSource.grossHundredths, basis: 'Pay-date gross wages', partial: payrollSource.months.length !== currentMonths.length } : null;
  const model = buildExecutive({
    scope: selectedScope, therapist,
    clinic, schools: schoolRevenue, cash: cashRevenue, overhead, payroll,
    overheadCategories: overhead && safeSnapshot ? overheadCategoryBreakdown(safeSnapshot, scope as 'all' | LocationName) : null,
    priorClinic: null, priorSchools: null, priorCash: null,
    priorOverhead: priorOverhead !== null && Number.isSafeInteger(priorOverhead) ? priorOverhead : null,
    priorOverheadMonths, priorPayroll: null, priorLabel,
  });
  const overheadSummary = overhead && safeSnapshot ? financeSummary(safeSnapshot, selectedScope) : null;
  const sourceMonths = periodView.months.filter(month => (periodView.responses[month]?.sources.length ?? 0) > 0).length;
  const selectedDetailMonth = periodView.months.includes(detailMonth) ? detailMonth : intake.month;
  const revenueCopy = cardCopy(summaryState, 'revenue', model.revenue !== null, model.revenueWaiting);
  const expenseCopy = cardCopy(summaryState, 'expense', model.expenses !== null, model.expenseWaiting);
  const profitCopy = cardCopy(summaryState, 'profit', model.profitCents !== null, model.profitWaiting);
  const priorProfit = model.profitCents !== null && model.priorRevenue !== null && model.priorExpenses !== null ? model.priorRevenue - model.priorExpenses : null;
  const marginLabel = model.margin === null ? null : new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 }).format(model.margin);
  const chooseScope = (next: ProfitCenterScope) => { setSelectedScope(next); setOpenLine(null); };
  const reportStrong = period === 'month' || period === 'ytd'
    ? `${legacyMode.toUpperCase()} · ${periodLabel(legacyMode, intake.month)} · ${detailScopeLabel}`
    : `${period === 'quarter' ? 'Quarter' : 'Trailing 12'} · ${periodTitle(period, intake.month)} · ${detailScopeLabel}`;
  return <main id="cheshire-financial-summary" className="cfd-dashboard csd-dashboard">
    <h1 className="cps-sr-only">Cheshire financial summary</h1>
    {sampleBanner ? <p className="ced-banner" role="note">{sampleBanner}</p> : null}
    <section className="csd-controls" aria-label="Report filters">
      <div className="ced-filter"><span>Period</span><div className="ced-periods" role="group" aria-label="Reporting period">
        <button type="button" aria-pressed={period === 'month'} onClick={() => setPeriod('month')}>Month</button>
        <button type="button" aria-pressed={period === 'quarter'} onClick={() => setPeriod('quarter')}>Quarter</button>
        <button type="button" aria-pressed={period === 'ytd'} onClick={() => setPeriod('ytd')}>YTD</button>
        <button type="button" aria-pressed={period === 't12'} onClick={() => setPeriod('t12')}>12 months</button>
      </div></div>
      <label><CalendarDays size={16}/><span className="cps-sr-only">Reporting month</span><input type="month" aria-label="Summary reporting month" value={intake.month} onChange={event => intake.setMonth(event.target.value)}/></label>
      <div className="ced-filter"><span>Location</span><CheshireLocationPicker value={selectedScope} onChange={chooseScope}/></div>
      {schools ? <CheshireSchoolFilters options={schoolOptions} value={schoolValue} onChange={setSchoolSelection}/> : null}
      <label className="csd-school-filter csd-therapist-filter"><UsersRound size={16} aria-hidden="true"/><span>Therapist</span>
        <select aria-label="Therapist" value={therapist} onChange={event => { setTherapist(event.target.value); setOpenLine(null); }}>
          <option value="all">All therapists</option>
          {therapistOptions.map(id => <option key={id} value={id}>{id}</option>)}
        </select>
      </label>
      <button type="button" className="csd-refresh" aria-label="Refresh financial summary" title="Refresh source coverage" disabled={state === 'loading' || intake.busy || intake.state === 'checking'} onClick={() => { onRefresh(); intake.refresh(); }}><RefreshCw size={16}/></button>
      <button type="button" className="csd-upload" disabled={!canUpload} onClick={() => setUploadMonth(intake.month)}><FileUp size={17}/> Upload data</button>
    </section>
    {therapistIds.length === 0 ? <p className="ced-headline-note">Waiting on a payroll or timesheet export with therapist IDs. Company totals are not one therapist’s numbers.</p> : null}
    {schools ? <p id="csd-school-filter-help" className="csd-school-filter-help">{selectedSchool ? `Showing ${selectedSchool.label} · ${intake.month.slice(0, 4)} source row ${selectedSchool.row}.` : schoolOptions.length ? `All schools listed in the ${intake.month.slice(0, 4)} source.` : 'School options will appear when a verified source is available for this year.'} Therapist assignments are not available in the current dashboard sources. Verified school/therapist work time and matching payroll are needed for labor and profit.</p> : null}
    {statusMessage ? <div className="cfd-status" role="status"><LockKeyhole size={18}/><strong>{statusMessage}</strong></div> : null}
    <p className="ced-headline-note">{periodTitle(period, intake.month)} · {scopeLabel}</p>
    <section className="csd-totals" aria-label="Revenue expenses and profit summary">
      <article><span title={model.revenue ? `${model.revenue.basis}. This is not profit.` : model.revenueWaiting}>Revenue</span><strong>{model.revenue ? money(model.revenue.cents) : '—'}</strong><p className={revenueCopy.className}>{revenueCopy.text}</p><span className="ced-compare">{comparisonText(model.revenueComparison, model.revenue?.cents ?? null, model.priorRevenue)}</span></article>
      <article><span title={model.expenses ? `${model.expenses.basis}. This budget is not actual spending and does not include pay-date wages.` : model.expenseWaiting}>Expenses</span><strong>{model.expenses ? money(model.expenses.cents) : '—'}</strong><p className={expenseCopy.className}>{expenseCopy.text}</p><span className="ced-compare">{comparisonText(model.expenseComparison, model.expenses?.cents ?? null, model.priorExpenses)}</span></article>
      <article><span title="Profit is shown only when revenue and expenses share one complete basis.">Profit</span><strong className={model.profitCents !== null && model.profitCents < 0 ? 'ced-negative' : undefined}>{model.profitCents !== null ? money(model.profitCents) : '—'}</strong><p className={profitCopy.className}>{profitCopy.text}</p>{marginLabel ? <span className={model.margin !== null && model.margin < 0 ? 'ced-margin ced-negative' : 'ced-margin'}>{marginLabel} margin</span> : <span className="ced-margin">Margin not calculated</span>}<span className="ced-compare">{comparisonText(model.profitCents !== null && priorProfit !== null ? { label: priorLabel, text: priorProfit === model.profitCents ? `Flat vs ${priorLabel}` : '', tone: priorProfit === model.profitCents ? 'flat' : model.profitCents! > priorProfit ? 'up' : 'down' } : null, model.profitCents, priorProfit)}</span></article>
    </section>
    <p className="csd-scope-note">{schools ? 'Schools is an independent profit center. Therapist labor is its expense; Clinics absorb all non-therapist overhead. School profit is unavailable until matching therapist labor and compatible revenue are verified.' : cash ? 'Cash programs are their own line. Clinic overhead is not applied. Profit waits on program income and direct program costs.' : selectedScope === 'all' ? 'All business keeps clinic payments, school income, and cash programs separate. They are not added together until overlap and accounting basis are reconciled. There is no consolidated revenue or profit total yet.' : `${scopeLabel} clinic reporting. Select Schools for the independent school profit center.`}</p>
    <CategoryBoard title="Revenue by category" lines={model.revenueLines} openId={openLine} onOpen={id => setOpenLine(current => current === id ? null : id)}/>
    <CategoryBoard title="Expenses by category" lines={model.expenseLines} openId={openLine} onOpen={id => setOpenLine(current => current === id ? null : id)}/>
    <section className="ced-shared" aria-label="Profit before and after shared overhead"><h2>Profit and shared overhead</h2><p>{model.beforeShared}</p><p>{model.afterShared}</p></section>
    <details className="ced-later"><summary>Profitability by location and break-even visits</summary>
      <CheshireOwnerSummary snapshot={state === 'ready' ? snapshot : null} mode={legacyMode} month={intake.month} selectedMonths={currentMonths} scope={selectedScope} checking={summaryState === 'Checking'} unavailable={state === 'error' || state === 'no-access'} onOpenLocation={chooseScope}/>
      <a className="ced-map-link" href="/cheshire/map">Open the profitability map</a>
    </details>
    <CheshirePayrollSource summary={payrollSource} onReviewSource={() => { intake.setSelected('payroll'); if (sourceReviewRef.current) sourceReviewRef.current.open = true; }}/>
    {(schools || selectedScope === 'all') ? <CheshireSchoolIncome result={schoolSource} selectedRow={selectedSchool?.row} mode={legacyMode} month={intake.month} selectedMonths={currentMonths} periodName={period === 'quarter' ? 'Quarter-to-date' : period === 't12' ? 'Trailing twelve months' : undefined} onReviewSource={() => { intake.setSelected('school_billing'); if (sourceReviewRef.current) sourceReviewRef.current.open = true; }}/> : null}
    {schools && sourcesVisible && !schoolSource.source && !schoolSource.issue ? <p className="csd-status" role="status">No historical school workbook is available for this reporting year. Validated monthly school invoices, when available, remain a separate source below.</p> : null}
    <div className="csd-detail-heading"><h2>Explore the detail</h2></div>
    {periodView.state === 'loading' ? <p className="csd-status" role="status">Checking the selected period and profit center. Missing months are never zero.</p> : null}
    {periodView.failedMonths.length ? <p className="csd-status" role="status">Could not load {periodView.failedMonths.join(', ')}. Those months are unavailable; missing uploads have not been established. Refresh to retry.</p> : null}
    {!schools && !cash && periodView.mapError ? <p className="csd-status" role="status">Some map categories could not be loaded. Refresh to retry.</p> : null}
    {!schools && !cash ? <CheshireSummaryCategories sections={sections} scope={scope} scopeLabel={scopeLabel} revenueReports={<CheshireCumulativeReports reports={cumulativeReports} scope={scope}/>}/> : schools ? <p className="csd-reference-note">The school workbook and monthly invoices may describe the same income. They are separate source views and are never added together. Missing school labor is unknown, not zero.</p> : null}
    <details className="csd-review-panel csd-reporting-details"><summary>Reporting details</summary><div className="csd-reporting-body">{model.revenue ? <p>{model.revenue.basis}. This partial source figure is not a reconciled accounting revenue total.</p> : null}{model.expenses ? <p>{model.expenses.basis}. This overhead budget is not pay-date wages or actual spending.</p> : null}<p><strong>{reportStrong}</strong></p><p>{period === 'month' ? 'Monthly reports only; daily cutoff is unverified.' : period === 'quarter' ? 'Quarter to date; daily cutoff is unverified.' : period === 't12' ? 'Trailing twelve months; daily cutoff is unverified.' : 'Reported months from January onward; daily cutoff is unverified.'}</p><p>{periodView.state === 'loading' ? 'Checking source coverage…' : periodView.state === 'ready' ? `${sourceMonths}/${periodView.months.length} months have validated source figures` : 'Awaiting validated sources'}</p><p>{schools ? 'School invoices remain separate from reported workbook income. Profit requires verified therapist labor and compatible school revenue.' : 'Amounts appear only after source checks. Profit requires complete, compatible revenue and costs.'}</p>{schools || cash ? <p>Non-therapist overhead belongs to Clinics under the owner’s policy; no school or cash-program overhead allocation is required.</p> : overhead && overheadSummary ? <p>Expense estimate: known fixed monthly overhead × {overhead.months} full {overhead.months === 1 ? 'month' : 'months'}. The 2026 budget estimate applies to every month of 2026, including November and December. It is still an estimate. {overheadSummary.missingCellCount} original cost cells remain unknown and are not treated as zero. This is not reconciled actual expenses, and the revenue report may stop earlier in the month.</p> : <p>Fixed monthly overhead is a reference, never multiplied into YTD actuals.</p>}</div></details>
    <details ref={sourceReviewRef} id="csd-source-review" className="csd-review-panel"><summary>Workspace-wide data requests & source review<span>{intake.month}</span></summary><CheshireMonthlyChecklist/><p className="csd-upload-help">These requests cover the entire workspace across profit centers. Use Upload data above to recognize a report, confirm its mapping and populate supported figures. Original files and source checks stay here.</p><CheshireMonthlyIntakeReview snapshot={safeSnapshot} showUploadActions={false}/></details>
    <details className="csd-review-panel"><summary>{schools ? 'School source figures & provenance' : 'Source figures, payer detail & provenance'}<span>{detailScopeLabel}</span></summary>{legacyMode === 'ytd' ? <label className="csd-detail-month">Source month<select aria-label="Source detail month" value={selectedDetailMonth} onChange={event => setDetailMonth(event.target.value)}>{periodView.months.map(month => <option key={month}>{month}</option>)}</select></label> : null}<CheshireValidatedMetrics scopeLabel={detailScopeLabel} data={periodView.responses[selectedDetailMonth] ?? null} state={periodView.state === 'ready' ? (periodView.failedMonths.includes(selectedDetailMonth) ? 'error' : 'ready') : periodView.state} month={selectedDetailMonth}/></details>
    {uploadMonth === intake.month && intake.state === 'ready' ? <CheshireReportUpload key={intake.month} onClose={() => setUploadMonth(null)}/> : null}
  </main>;
}
