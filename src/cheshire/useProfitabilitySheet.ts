import { useEffect, useState } from 'react';
import { cheshireSupabase } from '../lib/cheshireSupabase';
import { useIntake } from './intakeContext';
import { LOCATIONS } from './finance';
import { parseMetricResponse } from './metrics';
import type { MapCategory, ScopeMetrics, SheetScope } from './profitabilitySheet';

type Loaded = { key: string; metrics: ScopeMetrics; categories: MapCategory[]; failedScopes: SheetScope[]; mapError: boolean };
export function useProfitabilitySheet() {
  const intake = useIntake();
  const signature = JSON.stringify(intake.documents.map(doc => [doc.id, doc.content_sha256, doc.status, doc.reviewed_at, doc.review_revision, doc.validation_dependency_revisions, doc.supersedes_id]));
  const key = JSON.stringify([intake.month, signature, intake.referenceSnapshot?.revisionId, intake.state, intake.busy]);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    let active = true;
    setLoaded(null);
    if (intake.state !== 'ready' || intake.busy) return;
    const scopes: SheetScope[] = [...LOCATIONS, 'all'];
    void Promise.all([
      Promise.all(scopes.map(async scope => {
        try { const { data, error } = await cheshireSupabase.functions.invoke('cheshire-intake-review', { body: { operation: 'metrics', month: intake.month, location: scope } }); if (error || data?.error) return { scope, data: null }; return { scope, data: parseMetricResponse(data?.metrics, intake.month, scope) }; } catch { return { scope, data: null }; }
      })),
      cheshireSupabase.from('cheshire_chip').select('category,value,segment_index,position').order('position'),
    ]).then(([responses, map]) => {
      if (!active) return;
      const validMap = !map.error && Array.isArray(map.data) && map.data.length <= 500 && map.data.every(row => typeof row.value === 'string' && row.value.length <= 500 && ['services', 'revenue', 'labor', 'expenses', 'locationOverhead', 'overhead'].includes(row.category) && (row.segment_index === null || [0, 1, 2].includes(row.segment_index)) && Number.isFinite(row.position));
      setLoaded({ key, metrics: Object.fromEntries(responses.filter(result => result.data).map(result => [result.scope, result.data])), failedScopes: responses.filter(result => !result.data).map(result => result.scope), categories: validMap ? map.data as MapCategory[] : [], mapError: !validMap });
    }).catch(() => { if (active) setLoaded({ key, metrics: {}, categories: [], failedScopes: scopes, mapError: true }); });
    return () => { active = false; };
  }, [key, intake.month, intake.state, intake.busy]);
  // Synchronous freshness gate hides every prior month/identity/source version before effects run.
  const current = intake.state === 'ready' && !intake.busy && loaded?.key === key ? loaded : null;
  return { metrics: current?.metrics ?? {}, categories: current?.categories ?? [], failedScopes: current?.failedScopes ?? [], mapError: current?.mapError ?? false, state: intake.state !== 'ready' || intake.busy ? 'waiting' : current ? 'ready' : 'loading' } as const;
}
