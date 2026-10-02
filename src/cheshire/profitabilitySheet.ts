import { CATEGORIES, LOCATIONS, type FinanceSnapshot } from './finance.ts';
import { amountToCents } from './overhead.ts';
import { BASIS_LABELS, type MetricResponse } from './metrics.ts';
import type { MetricBasis, MetricKey } from '../../supabase/functions/_shared/cheshire-metrics.ts';
import type { SourceType } from './intake.ts';

export type SheetScope = 'all' | typeof LOCATIONS[number];
export type SheetCell = { value: number | null; note: string; source?: string; sourceType?: SourceType; coverageLabel?: string };
export type SheetRow = { id: string; label: string; detail: string; kind: 'value' | 'subtotal' | 'result'; cells: Record<SheetScope, SheetCell> };
export type SheetSection = { id: string; title: string; note: string; rows: SheetRow[] };
export type MapCategory = { category: string; value: string; segment_index: number | null; position: number };
export type ScopeMetrics = Partial<Record<SheetScope, MetricResponse>>;
const SCOPES: SheetScope[] = [...LOCATIONS, 'all'];
const ACCOUNTING = 'A common accounting basis, matching periods and complete cost coverage are required. No estimated profit is shown.';
const cells = (make: (scope: SheetScope) => SheetCell) => Object.fromEntries(SCOPES.map(scope => [scope, make(scope)])) as Record<SheetScope, SheetCell>;
const unknown = (note: string, sourceType?: SourceType): SheetCell => ({ value: null, note, sourceType });
function metricRow(id: string, label: string, detail: string, sourceType: SourceType, metricKey: MetricKey, basis: MetricBasis, metrics: ScopeMetrics): SheetRow {
  return { id, label, detail, kind: 'value', cells: cells(scope => {
    const response = metrics[scope];
    const source = response?.sources.find(item => item.source_type === sourceType);
    const metric = source?.metrics.find(item => item.key === metricKey && item.basis === basis);
    if (!metric || !source) return unknown(response?.blocked.find(item => item.source_type === sourceType)?.reason ?? (['payroll', 'school_billing'].includes(sourceType) && scope !== 'all' ? 'This report has no source-supported location allocation. Company-scope amounts remain separate.' : 'A current validated source is needed for this month, location and reporting basis.'), sourceType);
    return { value: metric.value, coverageLabel: scope === 'all' ? 'Source subtotal only' : undefined, note: `${BASIS_LABELS[basis]}. ${metric.source_rows} source rows; ${metric.source_locations.length ? `${metric.source_locations.length} reported locations` : 'company scope; no location attribution'}. Source subtotal, not complete business coverage.`, sourceType, source: `Document ${source.document_id} · SHA-256 ${source.content_sha256} · ${source.validator_version} · ${source.normalizer_version}` };
  }) };
}
function blockedRow(id: string, label: string, detail: string, sourceType?: SourceType): SheetRow {
  return { id, label, detail, kind: id === 'profit' || id === 'margin' ? 'result' : 'subtotal', cells: cells(() => unknown(ACCOUNTING, sourceType)) };
}
function mapRows(categories: MapCategory[], type: string, sourceType: SourceType): SheetRow[] {
  const groups = new Map<string, { value: string; segments: Set<string> }>();
  for (const item of categories.filter(item => item.category === type).sort((a, b) => a.position - b.position)) {
    const value = item.value.trim(); if (!value) continue;
    const key = value.toLocaleLowerCase(); const group = groups.get(key) ?? { value, segments: new Set<string>() };
    group.segments.add(item.segment_index === 0 ? 'Clinics' : item.segment_index === 1 ? 'Schools' : item.segment_index === 2 ? 'Private programs' : 'Shared'); groups.set(key, group);
  }
  return [...groups.values()].map((group, index) => ({ id: `map-${type}-${index}`, label: group.value, detail: `${[...group.segments].join(' · ')} · map category`, kind: 'value', cells: cells(() => unknown('The profitability map defines this cost category, but does not supply an amount or allocation. Upload supporting evidence; overlapping categories must be reconciled before totaling.', sourceType)) }));
}
/** Display source evidence without imputing, allocating or combining unlike accounting bases. */
export function buildProfitabilitySheet(snapshot: FinanceSnapshot | null, metrics: ScopeMetrics, categories: MapCategory[] = []): SheetSection[] {
  const baseline = snapshot?.costBasis === 'fixed_monthly_baseline';
  const overheadRows: SheetRow[] = CATEGORIES.map(category => ({ id: `overhead-${category}`, label: category, detail: baseline ? 'Fixed monthly reference' : 'Supplied overhead source', kind: 'value', cells: cells(scope => {
    const rows = snapshot?.rows.filter(row => row.category === category && (scope === 'all' || row.location === scope)) ?? [];
    const known = rows.filter(row => row.amount !== null); const total = known.reduce((sum, row) => sum + amountToCents(row.amount!), 0);
    const expected = scope === 'all' ? LOCATIONS.length : 1;
    if (!known.length) return { ...unknown('The original source cell is blank or unavailable. An unknown amount is never zero.', 'overhead'), source: rows.length ? `${snapshot!.sourceName} · ${rows.map(row => `${row.location} ${row.sourceCell}`).join(', ')}` : undefined };
    return { value: total, coverageLabel: scope === 'all' ? `${known.length}/${expected} known${known.length < expected ? ' · partial' : ''}` : undefined, note: scope === 'all' ? `${known.length}/${expected} source cells known. ${known.length < expected ? 'Partial known subtotal.' : 'Source subtotal.'} ${baseline ? 'Baseline, not monthly actual.' : 'Source period requires reconciliation.'}` : `${baseline ? 'Fixed monthly baseline' : 'Supplied source amount'}; ${total === 0 ? 'explicit source zero' : 'original source amount'}.`, sourceType: 'overhead', source: `${snapshot!.sourceName} · ${known.map(row => `${row.location} ${row.sourceCell}`).join(', ')} · ${snapshot!.effectiveMonth ?? 'month unconfirmed'} · revision ${snapshot!.revisionId ?? 'unavailable'}` };
  }) }));
  const overheadSubtotal: SheetRow = { id: 'known-overhead', label: 'Known overhead subtotal', detail: baseline ? 'Partial fixed baseline · excluded from actual profit' : 'Partial supplied costs · accounting match needed', kind: 'subtotal', cells: cells(scope => {
    const rows = snapshot?.rows.filter(row => scope === 'all' || row.location === scope) ?? []; const known = rows.filter(row => row.amount !== null); const expected = scope === 'all' ? LOCATIONS.length * CATEGORIES.length : CATEGORIES.length; const missing = expected - known.length;
    return { value: known.length ? known.reduce((sum, row) => sum + amountToCents(row.amount!), 0) : null, coverageLabel: `${known.length}/${expected} known${missing ? ' · partial' : ''}`, note: `${known.length}/${rows.length || (scope === 'all' ? 140 : 20)} cells have amounts. ${missing} blank cells remain unknown. Not a complete expense total.`, sourceType: 'overhead', source: snapshot ? `${snapshot.sourceName} · revision ${snapshot.revisionId ?? 'unavailable'}` : undefined };
  }) };
  const revenue = [
    metricRow('insurance-payments', 'Insurance payments', 'Clinics · payment-date basis', 'insurance_revenue', 'insurance_payments', 'payment_date', metrics),
    metricRow('patient-payments', 'Patient payments', 'Clinics · payment-date basis', 'insurance_revenue', 'patient_payments', 'payment_date', metrics),
    metricRow('schools', 'School invoices', 'Schools · invoiced, not collected cash', 'school_billing', 'school_invoices', 'invoice_reported_month', metrics),
    metricRow('programs', 'Private-program income', 'Private programs · receipt timing unconfirmed', 'cash_programs', 'cash_program_income', 'program_reported_month', metrics),
  ];
  // Service-date payment figures must remain visible and distinct if a source supplies them.
  if (Object.values(metrics).some(response => response?.sources.some(source => source.metrics.some(metric => ['insurance_payments', 'patient_payments'].includes(metric.key) && metric.basis === 'service_date')))) {
    revenue.push(metricRow('insurance-service', 'Insurance payments · service attribution', 'Clinics · service-date basis; do not add to payment-date figures', 'insurance_revenue', 'insurance_payments', 'service_date', metrics), metricRow('patient-service', 'Patient payments · service attribution', 'Clinics · service-date basis; do not add to payment-date figures', 'insurance_revenue', 'patient_payments', 'service_date', metrics));
  }
  return [
    { id: 'revenue', title: '01  Revenue', note: 'Clinics → schools → private programs. Different accounting bases stay separate.', rows: [...revenue, blockedRow('revenue-total', 'Reconciled revenue', 'Awaiting common accounting definition and coverage', 'coverage_manifest')] },
    { id: 'labor', title: '02  Labor', note: 'Wages, taxes, benefits and nonproductive time. Company payroll is never spread across locations without evidence.', rows: [...mapRows(categories, 'labor', 'payroll'), metricRow('payroll', 'Reported loaded payroll', 'Source subtotal · role/location allocation not yet supported', 'payroll', 'loaded_payroll', 'payroll_reported_month', metrics), { ...blockedRow('labor-location', 'Labor allocated to location', 'Approved staff allocation and payroll reconciliation needed', 'staff_allocation'), cells: cells(() => unknown('Upload the matching-month staff allocation and payroll. Reported company payroll is not a verified location allocation.', 'staff_allocation')) }] },
    { id: 'overhead', title: '03  Location overhead', note: baseline ? 'Fixed monthly baseline from the original workbook. Blanks remain unknown; $0.00 means an explicit source zero.' : 'Original source amounts by location. Source month and completeness must be confirmed.', rows: [...overheadRows, overheadSubtotal, metricRow('monthly-overhead', 'Uploaded monthly overhead', 'Separate monthly source · not added to the baseline', 'overhead', 'monthly_overhead', 'overhead_reported_month', metrics)] },
    { id: 'operations', title: '04  Operating & shared costs', note: 'Map categories can overlap the overhead workbook or payroll. Detail rows are not additive until reconciled.', rows: [...mapRows(categories, 'expenses', 'operating_expenses'), ...mapRows(categories, 'locationOverhead', 'operating_expenses'), ...mapRows(categories, 'overhead', 'operating_expenses'), metricRow('operating-extra', 'Costs separate from baseline', 'Validated expense source subtotal', 'operating_expenses', 'additional_operating_cost', 'expense_reported_month', metrics), metricRow('operating-overlap', 'Costs already in baseline', 'Reconciliation reference only · never add twice', 'operating_expenses', 'baseline_overlap_cost', 'expense_reported_month', metrics), blockedRow('cost-total', 'Reconciled total costs', 'Labor + operating + overhead on one complete, matched basis', 'operating_expenses')] },
    { id: 'profit', title: '05  Profit', note: 'Reconciled revenue − reconciled costs = operating profit. Complete matching evidence is required.', rows: [blockedRow('profit', 'Operating profit', 'Not yet available'), blockedRow('margin', 'Operating margin', 'Not yet available')] },
  ];
}
