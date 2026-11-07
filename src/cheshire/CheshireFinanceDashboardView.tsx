import { coverageLabels, monthEnd } from './sourceCoverage';
import { cumulativeRevenueSummary } from '../../supabase/functions/_shared/cheshire-cumulative.ts';
import { readCumulativeReports } from './cumulativeReports';
import { CheshireSchoolFilters } from './CheshireSchoolFilters';
import { filterSelectedSchoolMetrics, schoolFilterIdentity, schoolFilterOptions } from './schoolFilters';
import { schoolRevenueObservation } from './schoolRevenueObservation';
import { readSchoolIncomeSource } from './schoolIncomeSource';
import { payrollDateLabel, readPayrollSourceSummary } from './payrollSourceAudit';
import './cumulative-reports.css';
import { useEffect, useRef, useState } from 'react';
import { CalendarDays, FileUp, RefreshCw, UsersRound } from 'lucide-react';
import { CheshireReportUpload } from './CheshireReportUpload';
import { CheshireLocationPicker } from './CheshireLocationPicker';
import { CategoryBoard } from './CheshireExecutive';
import { useIntake } from './intakeContext';
import { useProfitabilityPeriod } from './useProfitabilityPeriod';
import { type PeriodMode } from './periodSummary';
import { financeSummary, money, type FinanceSnapshot, type LocationName } from './finance';
import { filterProfitCenterMetrics, metricLocationScope, profitCenterLabel, type ProfitCenterScope } from './profitCenterScope';
import {
  buildExecutive, collectMetricCents, comparisonWindows, executiveMonths, executiveSearch, overheadCategoryBreakdown,
  parseExecutiveSearch, periodTitle, readTherapistIds, type ExecutivePeriod, type MoneyPart,
} from './executiveView';
import './finance-dashboard.css';
import './summary-dashboard.css';
import './executive-dashboard.css';

export type FinanceLoadState = 'loading' | 'ready' | 'no-access' | 'empty' | 'error';
export type SampleParts = { clinic: MoneyPart | null; schools: MoneyPart | null; cash: MoneyPart | null };

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

/** Executive summary first. Profit estimates subtract displayed source subtotals; missing inputs stay blank. */
export function CheshireFinanceDashboardView({ snapshot, state, onRefresh, sampleParts, sampleBanner }: {
  snapshot: FinanceSnapshot | null; state: FinanceLoadState; onRefresh: () => void; sampleParts?: SampleParts; sampleBanner?: string;
}) {
  const lastSchoolIdentity = useRef<string | null>(null);
  const intake = useIntake();
  const starting = initialFilters();
  const [selectedScope, setSelectedScope] = useState<ProfitCenterScope>(starting.location);
  const [period, setPeriod] = useState<ExecutivePeriod>(starting.period);
  const [therapist, setTherapist] = useState(starting.therapist);
  const [uploadMonth, setUploadMonth] = useState<string | null>(null);
  const [schoolSelection, setSchoolSelection] = useState('all');
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
      setPeriod(next.period); setSelectedScope(next.location); setTherapist(next.therapist);
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
  const safeSnapshot = state === 'ready' && !schools && !cash ? snapshot : null;
  const canUpload = intake.state === 'ready' && !intake.busy;
  useEffect(() => { setUploadMonth(null); }, [intake.month]);
  const statusMessage = state === 'no-access' ? 'Financial access has not been enabled for this account.' : state === 'empty' ? (schools ? null : 'The first verified overhead source has not been imported.') : state === 'error' ? 'The protected financial source is unavailable. No cached or estimated values are being displayed.' : state === 'loading' ? 'Loading your protected financial source…' : null;
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
  const payroll = payrollSource ? { cents: payrollSource.grossHundredths, basis: `All-staff gross wages · selected pay months ${payrollSource.months.map(row => row.month).join(', ')} · export pay dates ${payrollDateLabel(payrollSource.audit.firstPayDate)} to ${payrollDateLabel(payrollSource.audit.lastPayDate)} · ${payrollSource.audit.currency ?? 'currency unconfirmed'}`, partial: true } : null;
  const schoolObservation = !sampleParts && therapist === 'all' && !schoolRevenue && (schools || selectedScope === 'all')
    ? schoolRevenueObservation(schoolSource, currentMonths, selectedSchool?.row) : null;
  const schoolPart = schoolRevenue ?? (schoolObservation ? { cents: schoolObservation.cents, basis: schoolObservation.note, partial: true } : null);
  const model = buildExecutive({
    scope: selectedScope, therapist,
    clinic, schools: schoolPart, cash: cashRevenue, overhead, payroll,
    overheadCategories: overhead && safeSnapshot ? overheadCategoryBreakdown(safeSnapshot, scope as 'all' | LocationName) : null,
    priorClinic: null, priorSchools: null, priorCash: null,
    priorOverhead: priorOverhead !== null && Number.isSafeInteger(priorOverhead) ? priorOverhead : null,
    priorOverheadMonths, priorPayroll: null, priorLabel,
  });
  // The same selected school source feeds the category and the partial headline, once.
  if (schoolObservation) {
    model.revenueLines = model.revenueLines.map(line => line.id === 'schools' ? {
      ...line, label: 'School contract income · reported', cents: schoolObservation.cents,
      sourceNote: schoolObservation.note, basis: schoolObservation.note, drill: schoolObservation.detail,
      waiting: null, share: null, trend: null, priorCents: null,
    } : line);
    if (schools) model.revenueWaiting = 'Partial workbook income shown below; accounting revenue unconfirmed';
  }
  const chooseScope = (next: ProfitCenterScope) => { setSelectedScope(next); };
  const unavailableScope = therapist !== 'all';
  const clinicPeriod = cumulativeRevenue?.report.period;
  const sourceState = state === 'no-access' || intake.state === 'no-access' ? 'Access required'
    : state === 'error' || intake.state === 'unavailable' ? 'Source unavailable'
    : state === 'loading' || intake.state === 'checking' || intake.busy || loadedPeriod.state === 'loading' ? 'Checking' : null;
  const metricCoverage = (source: string, keys: readonly string[], basis: string) => {
    const observed = sampleParts ? currentMonths : currentMonths.filter(month => metricPart(periodResponses, [month], source, keys, basis) !== null);
    return coverageLabels(currentMonths, observed, { failed: loadedPeriod.failedMonths });
  };
  const compactRevenueLines = model.revenueLines.map(line => {
    if (sourceState && line.cents === null) return { ...line, sourceNote: sourceState };
    if (line.id === 'schools' && schoolSource.issue && !schoolPart) return { ...line, sourceNote: 'Source review required' };
    if (unavailableScope) return { ...line, sourceNote: 'Missing therapist allocation' };
    if (line.id === 'clinic' && clinic) {
      const observed = clinicPeriod ? currentMonths.filter(month => month >= clinicPeriod.start.slice(0, 7) && month <= clinicPeriod.end.slice(0, 7)) : [];
      const partial = clinicPeriod ? [...new Set([...(clinicPeriod.start.slice(8) !== '01' ? [clinicPeriod.start.slice(0, 7)] : []), ...(clinicPeriod.end < monthEnd(clinicPeriod.end.slice(0, 7)) ? [clinicPeriod.end.slice(0, 7)] : [])])] : [];
      return { ...line, label: cumulativeRevenue?.report.kind === 'facility_reported_activity' ? 'Clinic collections · reported' : cumulativeRevenue?.report.kind === 'insurance_service_cohort' ? 'Clinic collections · service cohort' : 'Clinic collections', sourceNote: clinicPeriod ? coverageLabels(currentMonths, observed, { through: clinicPeriod.end, partial }) : metricCoverage('insurance_revenue', ['insurance_payments', 'patient_payments'], 'payment_date') };
    }
    if (line.id === 'schools' && schoolObservation) return { ...line, label: 'School income · reported', sourceNote: coverageLabels(currentMonths, schoolObservation.coveredMonths, { combined: schoolObservation.combined }) };
    if (line.id === 'schools' && schoolPart) return { ...line, label: 'School income · invoices', sourceNote: metricCoverage('school_billing', ['school_invoices'], 'invoice_reported_month') };
    if (line.id === 'schools' && schoolSource.source && !schoolPart) return { ...line, label: 'School income', sourceNote: coverageLabels(currentMonths, []) };
    if (line.id === 'cash') return { ...line, label: selectedScope === 'all' ? 'Cash programs · excluded' : 'Cash programs', sourceNote: metricCoverage('cash_programs', ['cash_program_income'], 'program_reported_month') };
    return { ...line, sourceNote: coverageLabels(currentMonths, [], { failed: loadedPeriod.failedMonths }) };
  });
  const compactExpenseLines = model.expenseLines.map(line => {
    if (sourceState && line.cents === null) return { ...line, sourceNote: sourceState };
    if (unavailableScope) return { ...line, sourceNote: 'Missing therapist allocation' };
    if (line.id === 'payroll' && payrollSource) return { ...line, label: 'Payroll · all staff gross', sourceNote: coverageLabels(currentMonths, payrollSource.months.map(row => row.month), { through: payrollSource.audit.lastPayDate, partial: payrollSource.audit.lastPayDate < monthEnd(payrollSource.audit.lastPayDate.slice(0, 7)) ? [payrollSource.audit.lastPayDate.slice(0, 7)] : [] }) + ' · Employer costs missing' };
    if (line.id === 'payroll') return { ...line, sourceNote: selectedScope === 'all' ? coverageLabels(currentMonths, []) : 'Missing location labor allocation' };
    if (line.id.startsWith('overhead-') && overhead) {
      const category = overheadCategoryBreakdown(safeSnapshot!, scope as 'all' | LocationName).find(category => `overhead-${category.category}` === line.id);
      return { ...line, sourceNote: `Estimate${category?.missing ? ` · Missing ${category.missing} cost cells` : ''}` };
    }
    return line;
  });
  const gap = (id: string, label: string, sourceNote: string) => ({ id, label, sourceNote, cents: null, share: null, trend: null, priorCents: null, waiting: null, basis: '', drill: '' });
  const therapistGaps = [
    gap('therapist-revenue', 'Revenue ↔ therapist', sourceState ?? 'Match not verified'),
    gap('therapist-payroll', 'Therapist labor', sourceState ?? 'Allocation missing'),
    gap('therapist-profit', 'Therapist profit', sourceState ?? 'Missing matched revenue + labor'),
  ];
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
        <select aria-label="Therapist" value={therapist} onChange={event => { setTherapist(event.target.value); }}>
          <option value="all">All therapists</option>
          {therapistOptions.map(id => <option key={id} value={id}>{id}</option>)}
        </select>
      </label>
      <button type="button" className="csd-refresh" aria-label="Refresh financial summary" title="Refresh source coverage" disabled={state === 'loading' || intake.busy || intake.state === 'checking'} onClick={() => { onRefresh(); intake.refresh(); }}><RefreshCw size={16}/></button>
      <button type="button" className="csd-upload" disabled={!canUpload} onClick={() => setUploadMonth(intake.month)}><FileUp size={17}/> Upload data</button>
    </section>
    <h2 className="ced-headline-note">{periodTitle(period, intake.month)} · {scopeLabel}</h2>
    {statusMessage ? <span className="ced-access-state" role="status">{state === 'loading' ? 'Loading' : state === 'no-access' ? 'Access required' : state === 'error' ? 'Source unavailable' : 'Overhead missing'}</span> : null}
    <section className="csd-totals" aria-label="Revenue expenses and profit summary">
      <article><span>Revenue{model.revenue?.partial ? ' · partial' : ''}</span><strong>{model.revenue ? money(model.revenue.cents) : '—'}</strong></article>
      <article><span>Expenses{model.expenses ? ' · estimate' : ''}</span><strong>{model.expenses ? money(model.expenses.cents) : '—'}</strong></article>
      <article><span>Profit · estimate</span><strong className={model.profitCents !== null && model.profitCents < 0 ? 'ced-negative' : undefined}>{model.profitCents !== null ? money(model.profitCents) : '—'}</strong></article>
    </section>
    {model.revenue || model.expenses ? <span className="ced-estimate-note" role="note">Estimate · mixed periods · overlap unverified</span> : null}
    <div id="csd-source-review" className="ced-category-grid">
      <CategoryBoard title="Revenue" lines={compactRevenueLines}/>
      <CategoryBoard title="Expenses" lines={compactExpenseLines}/>
    </div>
    <CategoryBoard title="Therapist profitability" lines={therapistGaps}/>
    {uploadMonth === intake.month && intake.state === 'ready' ? <CheshireReportUpload key={intake.month} onClose={() => setUploadMonth(null)}/> : null}
  </main>;
}
