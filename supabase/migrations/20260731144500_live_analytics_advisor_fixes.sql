-- Advisor follow-up for the live analytics pipeline.

create index if not exists analytics_fact_location_idx
  on public.analytics_daily_fact (location_id);

create index if not exists ai_metric_definition_approved_by_idx
  on public.ai_metric_definition (approved_by)
  where approved_by is not null;

grant select on public.kpi_snapshot_lineage to authenticated;

create policy "Members can read KPI lineage in their organization"
on public.kpi_snapshot_lineage for select to authenticated
using (
  exists (
    select 1
    from public.kpi_snapshot snapshot
    where snapshot.id = kpi_snapshot_lineage.kpi_snapshot_id
      and snapshot.org_id = (select public.current_org_id())
  )
);
