import type { MetricResponse } from './metrics.ts';
import type { SheetScope } from './profitabilitySheet.ts';

// A UI profit center, never a clinic location or a new database attribution.
export type ProfitCenterScope = SheetScope | 'schools' | 'cash';
export function profitCenterLabel(scope: ProfitCenterScope): string {
  return scope === 'all' ? 'All business' : scope === 'schools' ? 'Schools' : scope === 'cash' ? 'Cash programs' : scope;
}
export function metricLocationScope(scope: ProfitCenterScope): SheetScope {
  return scope === 'schools' || scope === 'cash' ? 'all' : scope;
}
/** Filter already authorized source subtotals; never allocate or add them together. */
export function filterProfitCenterMetrics(response: MetricResponse, scope: ProfitCenterScope): MetricResponse {
  if (response.location !== metricLocationScope(scope)) throw new Error('Mismatched profit-center source scope');
  if (scope === 'all') return response;
  const include = (source: string) => scope === 'schools' ? source === 'school_billing' : scope === 'cash' ? source === 'cash_programs' : source !== 'school_billing';
  return {
    ...response,
    sources: response.sources.filter(source => include(source.source_type)),
    blocked: response.blocked.filter(source => include(source.source_type)),
    ...(scope === 'schools' ? { profit: { available: false as const, reason: 'School profit requires verified therapist labor and compatible school revenue for the same period. Clinics absorb all non-therapist overhead.' } } : {}),
    ...(scope === 'cash' ? { profit: { available: false as const, reason: 'Cash-program profit requires program income and direct program costs. Clinic overhead is not applied.' } } : {}),
  };
}
