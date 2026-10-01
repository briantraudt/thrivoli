-- Private monthly source intake. No customer documents, amounts or account IDs are seeded.
create table public.cheshire_intake_document (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('coverage_manifest','insurance_revenue','clinic_activity','school_billing','cash_programs','payroll','staff_allocation','operating_expenses','overhead')),
  requested_month date check (requested_month = date_trunc('month', requested_month)::date),
  reported_month date check (reported_month = date_trunc('month', reported_month)::date),
  supersedes_id uuid references public.cheshire_intake_document(id) on delete restrict,
  no_phi_attested_at timestamptz,
  uploaded_by uuid, -- Immutable verified actor ID; retained after an authentication account is deleted.
  source_period_label text,
  source_scope_label text,
  figure_unlocked text,
  file_name text not null check (length(file_name) between 1 and 160),
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  byte_size integer check (byte_size between 1 and 5242880),
  mime_type text,
  storage_path text unique,
  source_origin text not null default 'portal_upload' check (source_origin in ('portal_upload','existing_source')),
  status text not null default 'uploading' check (status in ('uploading','received','reviewing','incomplete','complete','error','quarantined')),
  validation jsonb,
  validation_scope jsonb,
  validation_dependencies jsonb not null default '{}'::jsonb,
  failure_message text,
  review_token uuid,
  review_started_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (source_origin = 'existing_source' or (requested_month is not null and uploaded_by is not null and storage_path is not null and byte_size is not null and no_phi_attested_at is not null and mime_type is not null and mime_type in ('text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/pdf','image/png'))),
  check (status <> 'complete' or (requested_month is not null and reported_month is not null and reported_month = requested_month and coalesce(validation->>'status','') = 'complete' and coalesce(validation->>'validator_version','') = 'cheshire-intake-v1'))
);
create unique index cheshire_intake_dedup_idx on public.cheshire_intake_document (source_type, coalesce(requested_month, date '0001-01-01'), content_sha256);
create index cheshire_intake_month_created_idx on public.cheshire_intake_document (requested_month, created_at desc);
alter table public.cheshire_intake_document enable row level security;
revoke all on public.cheshire_intake_document from public, anon, authenticated;
grant select on public.cheshire_intake_document to authenticated;
grant select, insert, update, delete on public.cheshire_intake_document to service_role;
create policy "finance members read private intake metadata" on public.cheshire_intake_document for select to authenticated using (
 exists (select 1 from public.cheshire_finance_reader r where r.user_id = (select auth.uid()))
 and exists (select 1 from public.cheshire_portal_member m where m.email = lower((select auth.jwt()->>'email')))
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cheshire-intake','cheshire-intake',false,5242880,array['text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/pdf','image/png']);
-- Restrictive bucket boundaries prevent unrelated broad permissive policies from exposing this bucket.
-- Other buckets retain their existing behavior. There is no client overwrite or delete path.
create policy "cheshire intake select boundary" on storage.objects as restrictive for select to authenticated using (
 bucket_id <> 'cheshire-intake' or (
  exists (select 1 from public.cheshire_finance_reader r where r.user_id=(select auth.uid()))
  and exists (select 1 from public.cheshire_portal_member m where m.email=lower((select auth.jwt()->>'email')))
  and exists (select 1 from public.cheshire_intake_document d where d.storage_path=name and d.status in ('incomplete','complete') and d.no_phi_attested_at is not null and d.mime_type in ('text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') and d.validation @> '{"checks":[{"key":"privacy","passed":true},{"key":"document_type","passed":true}]}'::jsonb)
 )
);
create policy "cheshire intake anonymous read boundary" on storage.objects as restrictive for select to anon using (bucket_id <> 'cheshire-intake');
create policy "cheshire intake anonymous write boundary" on storage.objects as restrictive for insert to anon with check (bucket_id <> 'cheshire-intake');
create policy "finance members read received intake objects" on storage.objects for select to authenticated using (
 bucket_id='cheshire-intake'
 and exists (select 1 from public.cheshire_finance_reader r where r.user_id=(select auth.uid()))
 and exists (select 1 from public.cheshire_portal_member m where m.email=lower((select auth.jwt()->>'email')))
 and exists (select 1 from public.cheshire_intake_document d where d.storage_path=name and d.status in ('incomplete','complete') and d.no_phi_attested_at is not null and d.mime_type in ('text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') and d.validation @> '{"checks":[{"key":"privacy","passed":true},{"key":"document_type","passed":true}]}'::jsonb)
);
create policy "cheshire intake insert boundary" on storage.objects as restrictive for insert to authenticated with check (
 bucket_id <> 'cheshire-intake' or (
  (storage.foldername(name))[1]=(select auth.uid())::text
  and exists (select 1 from public.cheshire_finance_reader r where r.user_id=(select auth.uid()))
  and exists (select 1 from public.cheshire_portal_member m where m.email=lower((select auth.jwt()->>'email')))
  and exists (select 1 from public.cheshire_intake_document d where d.storage_path=name and d.uploaded_by=(select auth.uid()) and d.status='uploading')
 )
);
create policy "finance members upload reserved own objects" on storage.objects for insert to authenticated with check (
 bucket_id='cheshire-intake' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists (select 1 from public.cheshire_finance_reader r where r.user_id=(select auth.uid()))
 and exists (select 1 from public.cheshire_portal_member m where m.email=lower((select auth.jwt()->>'email')))
 and exists (select 1 from public.cheshire_intake_document d where d.storage_path=name and d.uploaded_by=(select auth.uid()) and d.status='uploading')
);
create policy "cheshire intake immutable objects" on storage.objects as restrictive for update to anon, authenticated using (bucket_id <> 'cheshire-intake') with check (bucket_id <> 'cheshire-intake');
create policy "cheshire intake retain source objects" on storage.objects as restrictive for delete to anon, authenticated using (bucket_id <> 'cheshire-intake');

-- AI is disabled unless an explicit application call cap is configured. This server-only reservation
-- enforces a global UTC-month call bound and one request per unchanged validation cache key.
create table public.cheshire_intake_ai_usage (
 cache_key text primary key check (cache_key ~ '^[a-f0-9]{64}$'),
 reserved_at timestamptz not null default now()
);
alter table public.cheshire_intake_ai_usage enable row level security;
revoke all on public.cheshire_intake_ai_usage from public, anon, authenticated;
grant select, insert, update, delete on public.cheshire_intake_ai_usage to service_role;
create function public.reserve_cheshire_intake_ai_call(p_cache_key text,p_limit integer)
returns boolean language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if p_limit is null or p_limit<1 or p_limit>10 or p_cache_key is null or p_cache_key !~ '^[a-f0-9]{64}$' then return false; end if;
 perform pg_advisory_xact_lock(hashtextextended('cheshire-intake-ai-'||to_char(now() at time zone 'UTC','YYYY-MM'),0));
 if exists(select 1 from public.cheshire_intake_ai_usage where cache_key=p_cache_key) then return false; end if;
 if (select count(*) from public.cheshire_intake_ai_usage where reserved_at >= (date_trunc('month',now() at time zone 'UTC') at time zone 'UTC')) >= p_limit then return false; end if;
 insert into public.cheshire_intake_ai_usage(cache_key) values(p_cache_key);
 return true;
end;
$$;
revoke all on function public.reserve_cheshire_intake_ai_call(text,integer) from public,anon,authenticated;
grant execute on function public.reserve_cheshire_intake_ai_call(text,integer) to service_role;

-- Service-only activation; the owner can enable bounded sanitized assistance without new secrets.
create table public.cheshire_intake_settings (
 id boolean primary key default true check (id),
 ai_enabled boolean not null default false,
 ai_monthly_limit integer not null default 10 check (ai_monthly_limit between 1 and 10)
);
alter table public.cheshire_intake_settings enable row level security;
revoke all on public.cheshire_intake_settings from public,anon,authenticated;
grant select,insert,update,delete on public.cheshire_intake_settings to service_role;
insert into public.cheshire_intake_settings(id,ai_enabled,ai_monthly_limit) values(true,false,10);
