import { useEffect, useState } from 'react';
import { Building2, CalendarDays, FileUp, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react';
import { CheshireMonthlyIntakeReview } from './CheshireMonthlyIntake';
import { CheshireReportUpload } from './CheshireReportUpload';
import { CheshireValidatedMetrics } from './CheshireValidatedMetrics';
import { CheshireProfitabilitySheet } from './CheshireProfitabilitySheet';
import { useIntake } from './intakeContext';
import { useProfitabilitySheet } from './useProfitabilitySheet';
import { LOCATIONS, financeSummary, money, type FinanceSnapshot } from './finance';
import type { SourceType } from './intake';
import './finance-dashboard.css';

export type FinanceLoadState = 'loading' | 'ready' | 'no-access' | 'empty' | 'error';
/** All figures are from protected originals or validated monthly source metrics. */
export function CheshireFinanceDashboardView({ snapshot, state, onRefresh }: { snapshot: FinanceSnapshot | null; state: FinanceLoadState; onRefresh: () => void }) {
  const intake = useIntake();
  const sheet = useProfitabilitySheet();
  const [location, setLocation] = useState('all');
  const [uploading, setUploading] = useState<{ source: SourceType | 'auto'; month: string; context?: string } | null>(null);
  useEffect(() => { setUploading(null); }, [intake.month]);
  const safeSnapshot = state === 'ready' ? snapshot : null;
  const summary = safeSnapshot ? financeSummary(safeSnapshot, location) : null;
  const canUpload = intake.state === 'ready' && !intake.busy;
  const selectedMetrics = sheet.metrics[location as keyof typeof sheet.metrics] ?? null;
  const statusMessage = state === 'no-access' ? 'Financial access has not been enabled for this account.' : state === 'empty' ? 'The first verified overhead source has not been imported.' : state === 'error' ? 'The protected financial source is unavailable. No cached or estimated values are being displayed.' : state === 'loading' ? 'Loading your protected financial source…' : null;
  const period = safeSnapshot?.costBasis === 'fixed_monthly_baseline' ? 'Fixed monthly baseline' : safeSnapshot?.effectiveMonth ?? 'Month to confirm';
  return <main className="cfd-dashboard cps-dashboard">
    <div className="cfd-topline"><span><span className="cfd-live-dot"/> Cheshire Fitness Zone</span><span><ShieldCheck size={14}/> Private financial workspace</span></div>
    <header className="cfd-heading"><div><p className="cfd-eyebrow">YOUR BUSINESS, LINE BY LINE</p><h1>Cheshire profitability</h1><p>The profitability map, organized into a source-backed spreadsheet.</p></div><button className="cps-primary-upload" disabled={!canUpload} onClick={() => setUploading({ source: 'auto', month: intake.month })}><FileUp size={16}/> Upload a report</button></header>
    <section className="cfd-controls cps-controls" aria-label="Report filters">
      <label><span>REPORTING MONTH</span><div><CalendarDays size={16}/><input type="month" aria-label="Spreadsheet reporting month" value={intake.month} onChange={event => intake.setMonth(event.target.value)}/></div></label>
      <label><span>LOCATION</span><div><Building2 size={16}/><select aria-label="Location" value={location} onChange={event => setLocation(event.target.value)}><option value="all">All 7 locations</option>{LOCATIONS.map(name => <option key={name}>{name}</option>)}</select></div></label>
      <div className="cps-basis"><span>OVERHEAD REFERENCE</span><strong>{period}</strong><small>Separate from monthly actuals</small></div>
      <button className="cfd-refresh" disabled={state === 'loading' || intake.busy || intake.state === 'checking'} onClick={() => { onRefresh(); intake.refresh(); }}><RefreshCw size={15}/><span>Refresh</span></button>
    </section>
    {statusMessage ? <div className="cfd-status" role="status"><LockKeyhole size={19}/><div><strong>{statusMessage}</strong><p>Financial information is available only to approved readers. Missing data is never treated as zero.</p></div></div> : null}
    <section className="cps-summary" aria-label="Financial overview"><div><span>Known {safeSnapshot?.costBasis === 'fixed_monthly_baseline' ? 'fixed monthly' : 'monthly'} overhead</span><strong>{summary && summary.knownCells > 0 ? money(summary.knownTotalCents) : '—'}</strong><small>Source-backed subtotal only</small></div><div><span>Overhead source coverage</span><strong>{summary ? `${summary.knownCells} of ${summary.totalCells}` : 'Awaiting source'}</strong><small>{summary ? `${summary.missingCellCount} blank cells remain unknown` : 'Unknowns are never zero'}</small></div><div><span>Operating profit</span><strong className="cps-pending">Not yet available</strong><small>Complete matching revenue and costs needed</small></div></section>
    {sheet.state === 'loading' ? <p className="cps-load-note" role="status">Checking current source versions for every location…</p> : null}
    {sheet.failedScopes.length ? <p className="cps-load-note" role="status">Monthly figures could not be loaded for {sheet.failedScopes.map(scope => scope === 'all' ? 'all-source scope' : scope).join(', ')}. Those cells remain unknown. Refresh to retry.</p> : null}
    {sheet.mapError ? <p className="cps-load-note" role="status">The map’s cost-category detail could not be loaded. Original overhead and validated source subtotals remain separate; refresh to retry.</p> : null}
    <CheshireProfitabilitySheet snapshot={safeSnapshot} metrics={sheet.metrics} categories={sheet.categories} location={location} canUpload={canUpload} onUpload={(source, context) => { intake.setSelected(source); setUploading({ source, month: intake.month, context }); }}/>
    <section className="cps-support"><CheshireMonthlyIntakeReview snapshot={safeSnapshot}/><details className="cps-source-detail"><summary>Source figures, payer detail & verification</summary><CheshireValidatedMetrics data={selectedMetrics} state={sheet.state === 'ready' ? (sheet.failedScopes.includes(location as never) ? 'error' : 'ready') : sheet.state} month={intake.month}/></details></section>
    {safeSnapshot ? <footer className="cps-origin"><ShieldCheck size={14}/><span>{safeSnapshot.sourceName} · Imported {new Date(safeSnapshot.importedAt).toLocaleString('en-US', { timeZone: 'UTC' })} UTC · Read-only original amounts</span></footer> : null}
    {uploading && uploading.month === intake.month && intake.state === 'ready' ? <CheshireReportUpload key={`${uploading.source}:${intake.month}`} source={uploading.source === 'auto' ? undefined : uploading.source} context={uploading.context} onClose={() => setUploading(null)}/> : null}
  </main>;
}
