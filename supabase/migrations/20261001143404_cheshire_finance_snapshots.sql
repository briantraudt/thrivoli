-- Read-only financial reporting. This migration grants no person access.
-- Provision reviewed reader user IDs and import the private source separately.
-- Never put customer financial amounts or source documents in a migration.
create table public.cheshire_finance_reader (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.cheshire_finance_reader enable row level security;
revoke all on public.cheshire_finance_reader from public, anon, authenticated;
grant select on public.cheshire_finance_reader to authenticated;
grant select, insert, update, delete on public.cheshire_finance_reader to service_role;
create policy "finance readers verify own access"
  on public.cheshire_finance_reader for select to authenticated
  using (user_id = (select auth.uid()));

create table public.cheshire_finance_snapshot (
  id text primary key check (id = 'current-overhead'),
  source_name text not null check (length(source_name) between 1 and 120),
  cadence text not null check (cadence = 'monthly'),
  effective_month date check (effective_month = date_trunc('month', effective_month)::date),
  imported_at timestamptz not null default now(),
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  overhead_rows jsonb not null check (jsonb_typeof(overhead_rows) = 'array' and jsonb_array_length(overhead_rows) = 140)
);
alter table public.cheshire_finance_snapshot enable row level security;
revoke all on public.cheshire_finance_snapshot from public, anon, authenticated;
grant select on public.cheshire_finance_snapshot to authenticated;
grant select, insert, update, delete on public.cheshire_finance_snapshot to service_role;
create policy "approved portal finance readers can read snapshots"
  on public.cheshire_finance_snapshot for select to authenticated
  using (
    exists (select 1 from public.cheshire_finance_reader r where r.user_id = (select auth.uid()))
    and exists (select 1 from public.cheshire_portal_member m where m.email = lower((select auth.jwt() ->> 'email')))
  );

comment on table public.cheshire_finance_snapshot is
  'Private overhead snapshot. Monthly cadence does not establish an effective accounting month. No PHI. Browser reads only; reviewed privileged imports only.';
