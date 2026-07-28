-- Supabase-specific tenancy and compliance hardening.
-- Authorization lives in app_metadata.org_id, which users cannot edit.

alter table public.app_user
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

create or replace function public.current_org_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'org_id', '')::uuid
$$;

revoke all on function public.current_org_id() from public;
grant execute on function public.current_org_id() to authenticated;

do $$
declare
  table_record record;
begin
  for table_record in
    select table_schema, table_name
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
  loop
    execute format('alter table %I.%I enable row level security', table_record.table_schema, table_record.table_name);
    execute format('revoke all on %I.%I from anon', table_record.table_schema, table_record.table_name);
  end loop;
end $$;

do $$
declare
  table_record record;
begin
  for table_record in
    select c.table_schema, c.table_name
    from information_schema.columns c
    where c.table_schema = 'public' and c.column_name = 'org_id'
  loop
    execute format('grant select, insert, update, delete on %I.%I to authenticated', table_record.table_schema, table_record.table_name);
    execute format(
      'create policy "org members can read" on %I.%I for select to authenticated using (org_id = (select public.current_org_id()))',
      table_record.table_schema, table_record.table_name
    );
    execute format(
      'create policy "org members can insert" on %I.%I for insert to authenticated with check (org_id = (select public.current_org_id()))',
      table_record.table_schema, table_record.table_name
    );
    execute format(
      'create policy "org members can update" on %I.%I for update to authenticated using (org_id = (select public.current_org_id())) with check (org_id = (select public.current_org_id()))',
      table_record.table_schema, table_record.table_name
    );
    execute format(
      'create policy "org members can delete" on %I.%I for delete to authenticated using (org_id = (select public.current_org_id()))',
      table_record.table_schema, table_record.table_name
    );
  end loop;
end $$;

create policy "members can read their organization"
on public.org for select to authenticated
using (id = (select public.current_org_id()));

create or replace function public.prevent_audit_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Audit events are append-only';
end
$$;

create trigger audit_event_append_only
before update or delete on public.audit_event
for each row execute function public.prevent_audit_mutation();

create or replace function public.protect_signed_clinical_note()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.signed_at is not null or old.status in ('signed', 'amended') then
    raise exception 'Signed clinical notes are immutable; create an addendum';
  end if;
  return new;
end
$$;

create trigger clinical_note_signed_immutable
before update or delete on public.clinical_note
for each row execute function public.protect_signed_clinical_note();

create or replace function public.require_signed_school_service()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.invoice_id is not null and old.invoice_id is distinct from new.invoice_id
     and new.district_signed_at is null then
    raise exception 'District signature is required before invoicing school services';
  end if;
  return new;
end
$$;

create trigger school_service_signature_gate
before update of invoice_id on public.school_service_log
for each row execute function public.require_signed_school_service();

revoke all on table public.audit_event from authenticated;
grant select, insert on table public.audit_event to authenticated;
revoke all on all sequences in schema public from anon;
grant usage on sequence public.audit_event_id_seq to authenticated;

