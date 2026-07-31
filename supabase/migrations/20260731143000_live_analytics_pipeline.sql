-- Live, PHI-minimized analytics ingestion and reproducible KPI snapshots.

create table if not exists public.analytics_import_batch (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.org(id) on delete cascade,
  source text not null,
  idempotency_key text not null,
  import_mode text not null check (import_mode in ('historical','incremental')),
  period_start date not null,
  period_end date not null,
  status text not null default 'processing' check (status in ('processing','completed','completed_with_errors','failed')),
  rows_received integer not null default 0,
  rows_accepted integer not null default 0,
  rows_rejected integer not null default 0,
  source_updated_at timestamptz,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_summary jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (org_id, source, idempotency_key),
  check (period_end >= period_start)
);

create table if not exists public.analytics_daily_fact (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.org(id) on delete cascade,
  location_id uuid not null references public.location(id) on delete cascade,
  service_date date not null,
  source text not null,
  external_key text not null,
  revenue_stream text not null default 'insurance' check (revenue_stream in ('insurance','school_contract','cash_program','other')),
  visits_completed integer not null default 0 check (visits_completed >= 0),
  visits_scheduled integer not null default 0 check (visits_scheduled >= 0),
  no_shows integer not null default 0 check (no_shows >= 0),
  cancellations integer not null default 0 check (cancellations >= 0),
  net_revenue numeric(14,2) not null default 0,
  labor_cost numeric(14,2) not null default 0 check (labor_cost >= 0),
  operating_cost numeric(14,2) not null default 0 check (operating_cost >= 0),
  available_slots integer not null default 0 check (available_slots >= 0),
  booked_slots integer not null default 0 check (booked_slots >= 0),
  revenue_target numeric(14,2) not null default 0 check (revenue_target >= 0),
  break_even_visits_target integer check (break_even_visits_target is null or break_even_visits_target >= 0),
  source_updated_at timestamptz,
  import_batch_id uuid not null references public.analytics_import_batch(id) on delete restrict,
  checksum text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, source, external_key)
);

create table if not exists public.kpi_snapshot_lineage (
  id uuid primary key default gen_random_uuid(),
  kpi_snapshot_id uuid not null references public.kpi_snapshot(id) on delete cascade,
  import_batch_id uuid not null references public.analytics_import_batch(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  fact_count integer not null check (fact_count >= 0),
  calculation_version text not null,
  created_at timestamptz not null default now(),
  unique (kpi_snapshot_id, import_batch_id)
);

alter table public.ai_metric_definition
  add column if not exists calculation_sql text,
  add column if not exists calculation_version text not null default 'v1',
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.app_user(id) on delete set null,
  add column if not exists status text not null default 'draft' check (status in ('draft','approved','retired'));

create index if not exists analytics_fact_org_date_location_idx
  on public.analytics_daily_fact (org_id, service_date, location_id);
create index if not exists analytics_fact_batch_idx
  on public.analytics_daily_fact (import_batch_id);
create index if not exists analytics_batch_org_started_idx
  on public.analytics_import_batch (org_id, started_at desc);
create index if not exists kpi_lineage_batch_idx
  on public.kpi_snapshot_lineage (import_batch_id);
create index if not exists ai_metric_approved_idx
  on public.ai_metric_definition (status, key) where status = 'approved';

alter table public.analytics_import_batch enable row level security;
alter table public.analytics_daily_fact enable row level security;
alter table public.kpi_snapshot_lineage enable row level security;

revoke all on public.analytics_import_batch, public.analytics_daily_fact, public.kpi_snapshot_lineage from anon;
revoke all on public.analytics_import_batch, public.analytics_daily_fact, public.kpi_snapshot_lineage from authenticated;
grant select on public.analytics_import_batch, public.analytics_daily_fact to authenticated;

create policy "Members can read their analytics imports"
on public.analytics_import_batch for select to authenticated
using (org_id = (select public.current_org_id()));

create policy "Members can read their aggregate analytics facts"
on public.analytics_daily_fact for select to authenticated
using (org_id = (select public.current_org_id()));

create or replace function public.refresh_kpi_snapshots(
  p_org_id uuid,
  p_period_start date,
  p_as_of_date date,
  p_import_batch_id uuid
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer := 0;
begin
  if p_as_of_date < p_period_start then
    raise exception 'as_of_date must be on or after period_start';
  end if;

  with location_rollup as (
    select
      f.org_id,
      f.location_id,
      sum(f.net_revenue)::numeric(14,2) as net_revenue,
      sum(f.net_revenue) filter (where f.revenue_stream = 'insurance') as insurance_revenue,
      sum(f.net_revenue) filter (where f.revenue_stream = 'school_contract') as school_contract_revenue,
      sum(f.net_revenue) filter (where f.revenue_stream = 'cash_program') as cash_program_revenue,
      sum(f.visits_completed)::integer as visits,
      sum(f.visits_scheduled)::integer as scheduled,
      sum(f.no_shows)::integer as no_shows,
      sum(f.cancellations)::integer as cancellations,
      sum(f.labor_cost)::numeric(14,2) as labor_cost,
      sum(f.operating_cost)::numeric(14,2) as operating_cost,
      sum(f.available_slots)::integer as available_slots,
      sum(f.booked_slots)::integer as booked_slots,
      max(f.revenue_target)::numeric(14,2) as revenue_target,
      max(f.break_even_visits_target)::integer as break_even_visits_target,
      max(f.source_updated_at) as source_updated_at,
      count(*)::integer as fact_count
    from public.analytics_daily_fact f
    where f.org_id = p_org_id and f.service_date between p_period_start and p_as_of_date
    group by f.org_id, f.location_id
  ), upserted as (
    insert into public.kpi_snapshot (org_id, location_id, as_of_date, grain, metrics, computed_at)
    select
      r.org_id,
      r.location_id,
      p_as_of_date,
      'month',
      jsonb_build_object(
        'period_start', p_period_start,
        'period_end', p_as_of_date,
        'net_revenue', r.net_revenue,
        'insurance_revenue', coalesce(r.insurance_revenue, 0),
        'school_contract_revenue', coalesce(r.school_contract_revenue, 0),
        'cash_program_revenue', coalesce(r.cash_program_revenue, 0),
        'visits', r.visits,
        'scheduled_visits', r.scheduled,
        'no_shows', r.no_shows,
        'cancellations', r.cancellations,
        'no_show_rate', case when r.scheduled > 0 then round(r.no_shows::numeric / r.scheduled, 4) else null end,
        'labor_cost', r.labor_cost,
        'operating_cost', r.operating_cost,
        'operating_income', r.net_revenue - r.labor_cost - r.operating_cost,
        'margin', case when r.net_revenue <> 0 then round((r.net_revenue - r.labor_cost - r.operating_cost) / r.net_revenue, 4) else null end,
        'revenue_per_visit', case when r.visits > 0 then round(r.net_revenue / r.visits, 2) else null end,
        'break_even_visits', coalesce(r.break_even_visits_target, case when r.visits > 0 and r.net_revenue > 0 then ceil((r.labor_cost + r.operating_cost) / (r.net_revenue / r.visits)) else null end),
        'break_even_source', case when r.break_even_visits_target is not null then 'approved_target' else 'calculated_fallback' end,
        'available_slots', r.available_slots,
        'booked_slots', r.booked_slots,
        'open_slots', greatest(r.available_slots - r.booked_slots, 0),
        'fill_rate', case when r.available_slots > 0 then round(r.booked_slots::numeric / r.available_slots, 4) else null end,
        'revenue_target', r.revenue_target,
        'source_updated_at', r.source_updated_at,
        'calculation_version', 'live-kpi-v1',
        'data_status', 'live'
      ),
      now()
    from location_rollup r
    on conflict (org_id, location_id, as_of_date, grain)
    do update set metrics = excluded.metrics, computed_at = excluded.computed_at
    returning id, location_id
  )
  insert into public.kpi_snapshot_lineage (kpi_snapshot_id, import_batch_id, period_start, period_end, fact_count, calculation_version)
  select u.id, p_import_batch_id, p_period_start, p_as_of_date, r.fact_count, 'live-kpi-v1'
  from upserted u join location_rollup r on r.location_id = u.location_id
  on conflict (kpi_snapshot_id, import_batch_id)
  do update set fact_count = excluded.fact_count, period_start = excluded.period_start, period_end = excluded.period_end;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.ingest_analytics_batch(
  p_org_id uuid,
  p_source text,
  p_idempotency_key text,
  p_import_mode text,
  p_period_start date,
  p_period_end date,
  p_rows jsonb,
  p_source_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_batch_id uuid;
  v_existing public.analytics_import_batch%rowtype;
  v_received integer;
  v_accepted integer;
  v_rejected integer;
  v_snapshots integer;
begin
  if p_source is null or btrim(p_source) = '' then raise exception 'source is required'; end if;
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then raise exception 'idempotency_key is required'; end if;
  if p_import_mode not in ('historical','incremental') then raise exception 'invalid import_mode'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'rows must be a JSON array'; end if;
  if p_period_end < p_period_start then raise exception 'invalid reporting period'; end if;

  select * into v_existing from public.analytics_import_batch
  where org_id = p_org_id and source = p_source and idempotency_key = p_idempotency_key;
  if found and v_existing.status in ('completed','completed_with_errors') then
    return jsonb_build_object('batch_id', v_existing.id, 'duplicate', true, 'accepted', v_existing.rows_accepted, 'rejected', v_existing.rows_rejected);
  end if;

  insert into public.analytics_import_batch (org_id, source, idempotency_key, import_mode, period_start, period_end, source_updated_at)
  values (p_org_id, p_source, p_idempotency_key, p_import_mode, p_period_start, p_period_end, p_source_updated_at)
  on conflict (org_id, source, idempotency_key) do update set status = 'processing', started_at = now(), completed_at = null
  returning id into v_batch_id;

  v_received := jsonb_array_length(p_rows);

  with input as (
    select value as row_data from jsonb_array_elements(p_rows)
  ), valid as (
    select
      l.id as location_id,
      i.row_data,
      nullif(i.row_data->>'service_date','')::date as service_date,
      coalesce(nullif(i.row_data->>'external_key',''), concat(i.row_data->>'location_code', ':', i.row_data->>'service_date', ':', coalesce(i.row_data->>'revenue_stream','insurance'))) as external_key
    from input i
    join public.location l on l.org_id = p_org_id and l.code = i.row_data->>'location_code' and l.deleted_at is null
    where i.row_data ? 'service_date' and i.row_data ? 'location_code'
      and (i.row_data->>'service_date')::date between p_period_start and p_period_end
  ), upserted as (
    insert into public.analytics_daily_fact (
      org_id, location_id, service_date, source, external_key, revenue_stream,
      visits_completed, visits_scheduled, no_shows, cancellations, net_revenue,
      labor_cost, operating_cost, available_slots, booked_slots, revenue_target,
      break_even_visits_target, source_updated_at, import_batch_id, checksum
    )
    select
      p_org_id, v.location_id, v.service_date, p_source, v.external_key,
      coalesce(nullif(v.row_data->>'revenue_stream',''), 'insurance'),
      coalesce((v.row_data->>'visits_completed')::integer, 0),
      coalesce((v.row_data->>'visits_scheduled')::integer, 0),
      coalesce((v.row_data->>'no_shows')::integer, 0),
      coalesce((v.row_data->>'cancellations')::integer, 0),
      coalesce((v.row_data->>'net_revenue')::numeric, 0),
      coalesce((v.row_data->>'labor_cost')::numeric, 0),
      coalesce((v.row_data->>'operating_cost')::numeric, 0),
      coalesce((v.row_data->>'available_slots')::integer, 0),
      coalesce((v.row_data->>'booked_slots')::integer, 0),
      coalesce((v.row_data->>'revenue_target')::numeric, 0),
      nullif(v.row_data->>'break_even_visits_target','')::integer,
      coalesce(nullif(v.row_data->>'source_updated_at','')::timestamptz, p_source_updated_at),
      v_batch_id,
      md5(v.row_data::text)
    from valid v
    on conflict (org_id, source, external_key) do update set
      location_id = excluded.location_id, service_date = excluded.service_date,
      revenue_stream = excluded.revenue_stream, visits_completed = excluded.visits_completed,
      visits_scheduled = excluded.visits_scheduled, no_shows = excluded.no_shows,
      cancellations = excluded.cancellations, net_revenue = excluded.net_revenue,
      labor_cost = excluded.labor_cost, operating_cost = excluded.operating_cost,
      available_slots = excluded.available_slots, booked_slots = excluded.booked_slots,
      revenue_target = excluded.revenue_target, break_even_visits_target = excluded.break_even_visits_target,
      source_updated_at = excluded.source_updated_at,
      import_batch_id = excluded.import_batch_id, checksum = excluded.checksum, updated_at = now()
    returning 1
  ) select count(*) into v_accepted from upserted;

  v_rejected := v_received - v_accepted;
  v_snapshots := public.refresh_kpi_snapshots(p_org_id, p_period_start, p_period_end, v_batch_id);

  update public.analytics_import_batch set
    status = case when v_rejected > 0 then 'completed_with_errors' else 'completed' end,
    rows_received = v_received, rows_accepted = v_accepted, rows_rejected = v_rejected,
    error_summary = case when v_rejected > 0 then jsonb_build_array(jsonb_build_object('reason','Rows with unknown locations, invalid dates, or dates outside the batch period were rejected.','count',v_rejected)) else '[]'::jsonb end,
    completed_at = now()
  where id = v_batch_id;

  return jsonb_build_object('batch_id', v_batch_id, 'duplicate', false, 'received', v_received, 'accepted', v_accepted, 'rejected', v_rejected, 'snapshots_refreshed', v_snapshots);
exception when others then
  if v_batch_id is not null then
    update public.analytics_import_batch set status = 'failed', error_summary = jsonb_build_array(jsonb_build_object('reason',sqlerrm)), completed_at = now() where id = v_batch_id;
  end if;
  raise;
end;
$$;

revoke all on function public.refresh_kpi_snapshots(uuid,date,date,uuid) from public, anon, authenticated;
revoke all on function public.ingest_analytics_batch(uuid,text,text,text,date,date,jsonb,timestamptz) from public, anon, authenticated;
grant execute on function public.refresh_kpi_snapshots(uuid,date,date,uuid) to service_role;
grant execute on function public.ingest_analytics_batch(uuid,text,text,text,date,date,jsonb,timestamptz) to service_role;

update public.ai_metric_definition set
  calculation_version = 'live-kpi-v1',
  status = 'approved',
  approved_at = coalesce(approved_at, now()),
  calculation_sql = case key
    when 'revenue' then 'sum(net_revenue)'
    when 'visits' then 'sum(visits_completed)'
    when 'breakEven' then 'approved break_even_visits_target; fallback ceil((labor_cost + operating_cost) / revenue_per_visit)'
    when 'margin' then '(net_revenue - labor_cost - operating_cost) / net_revenue'
    when 'capacity' then 'booked_slots / available_slots'
    when 'noShowRate' then 'no_shows / visits_scheduled'
    when 'openSlots' then 'greatest(available_slots - booked_slots, 0)'
    else calculation_sql
  end,
  updated_at = now()
where key in ('revenue','visits','breakEven','margin','capacity','noShowRate','openSlots');
