-- Store an explicit reporting basis independently of an accounting month.
-- The owner-confirmed source choice is applied separately as private data, never guessed by this migration.
alter table public.cheshire_finance_snapshot
 add column cost_basis text not null default 'monthly_source' check (cost_basis in ('monthly_source','fixed_monthly_baseline')),
 add column basis_confirmed_at timestamptz,
 add column basis_note text;
alter table public.cheshire_finance_snapshot add constraint cheshire_fixed_basis_confirmed
 check (cost_basis <> 'fixed_monthly_baseline' or (basis_confirmed_at is not null and basis_note is not null and length(btrim(basis_note))>0));
-- Every source/basis edit invalidates dependent reviews, even when the workbook hash is unchanged.
alter table public.cheshire_finance_snapshot add column revision_id uuid not null default gen_random_uuid();
create function public.cheshire_finance_revision() returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
begin new.revision_id := gen_random_uuid(); return new; end;
$$;
revoke all on function public.cheshire_finance_revision() from public,anon,authenticated;
grant execute on function public.cheshire_finance_revision() to service_role;
create trigger cheshire_finance_revision_before_update before update on public.cheshire_finance_snapshot for each row execute function public.cheshire_finance_revision();
