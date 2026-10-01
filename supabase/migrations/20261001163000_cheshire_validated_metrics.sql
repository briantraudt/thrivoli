-- Candidate only: no customer rows seeded. Apply only after independent review.
-- Private typed aggregates, kept separately for every completed review. Original files remain immutable.
create table public.cheshire_intake_metric_batch (
 document_id uuid not null references public.cheshire_intake_document(id) on delete restrict,
 review_token uuid not null,
 content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
 reporting_month date not null check (reporting_month = date_trunc('month',reporting_month)::date),
 validator_version text not null check (validator_version='cheshire-intake-v1'),
 normalizer_version text not null check (normalizer_version='cheshire-metrics-v1'),
 validation_dependencies jsonb not null check (jsonb_typeof(validation_dependencies)='object'),
 dependency_revisions jsonb not null check (jsonb_typeof(dependency_revisions)='object'),
 normalization_issue text check (normalization_issue in ('currency_confirmation','ambiguous_reporting_key')),
 rows jsonb not null check (jsonb_typeof(rows)='array' and jsonb_array_length(rows)<=10000),
 created_at timestamptz not null default now(),
 primary key(document_id,review_token),
 check (normalization_issue is null or jsonb_array_length(rows)=0)
);
alter table public.cheshire_intake_metric_batch enable row level security;
revoke all on public.cheshire_intake_metric_batch from public,anon,authenticated;
grant select,insert on public.cheshire_intake_metric_batch to service_role;
create index cheshire_metric_month_idx on public.cheshire_intake_metric_batch(reporting_month);

-- Invoker + service-only EXECUTE: no new browser access, credential or SECURITY DEFINER bypass.
-- A single transaction commits the review and its staged metrics. A failed/stale review commits neither.
create function public.finalize_cheshire_intake_review(
 p_document_id uuid,p_content_sha256 text,p_review_token uuid,p_validation jsonb,p_scope jsonb,
 p_dependencies jsonb,p_dependency_revisions jsonb,p_normalizer_version text,p_rows jsonb,p_normalization_issue text
) returns setof public.cheshire_intake_document
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare d public.cheshire_intake_document; dep public.cheshire_intake_document; kind text; expected text; checks_ok boolean; normalized_count integer;
begin
 select * into d from public.cheshire_intake_document where id=p_document_id for update;
 if not found or d.source_origin<>'portal_upload' or d.status<>'reviewing' or d.review_token is distinct from p_review_token or d.content_sha256 is distinct from p_content_sha256 then return; end if;
 if p_validation is null or p_validation->>'validator_version' is distinct from 'cheshire-intake-v1' or coalesce(p_validation->>'status','') not in ('complete','incomplete','quarantined') then raise exception 'Invalid review result'; end if;
 if jsonb_typeof(p_dependencies) is distinct from 'object' or jsonb_typeof(p_dependency_revisions) is distinct from 'object' or jsonb_typeof(p_rows) is distinct from 'array' or p_normalizer_version is distinct from 'cheshire-metrics-v1' then raise exception 'Invalid metric version'; end if;
 normalized_count:=jsonb_array_length(p_rows);
 if normalized_count>10000 or octet_length(p_rows::text)>10000000 or (p_normalization_issue is not null and p_normalization_issue not in ('currency_confirmation','ambiguous_reporting_key')) or (p_normalization_issue is not null and normalized_count<>0) then raise exception 'Invalid metric staging'; end if;
 if p_validation->>'status'='complete' then
  if p_validation ? 'reference_basis' then raise exception 'Recurring references cannot become monthly actuals'; end if;
  if p_validation->>'reported_month' is distinct from to_char(d.requested_month,'YYYY-MM') or p_validation->'missing_items' is distinct from '[]'::jsonb or jsonb_typeof(p_validation->'checks') is distinct from 'array' then raise exception 'Invalid complete review'; end if;
  select count(*)=7 and count(distinct c->>'key')=7 and bool_and(c->>'key'=any(array['document_type','reporting_period','required_fields','row_values','location_coverage','reconciliation','privacy']) and c->'passed'='true'::jsonb) into checks_ok from jsonb_array_elements(p_validation->'checks') c;
  if checks_ok is distinct from true then raise exception 'Incomplete validation gates'; end if;
  if normalized_count>0 and normalized_count is distinct from (p_validation->>'row_count')::integer then raise exception 'Metric row count mismatch'; end if;
  if d.source_type in ('insurance_revenue','clinic_activity','school_billing','cash_programs','payroll','operating_expenses','staff_allocation') and not (p_dependency_revisions ? 'coverage_manifest') then raise exception 'Missing manifest revision'; end if;
  if d.source_type='staff_allocation' and not (p_dependency_revisions ? 'payroll') then raise exception 'Missing payroll revision'; end if;
  for kind,expected in select key,value from jsonb_each_text(p_dependency_revisions) loop
   if kind not in ('coverage_manifest','payroll') then raise exception 'Unknown dependency'; end if;
   select * into dep from public.cheshire_intake_document where source_type=kind and requested_month=d.requested_month and id::text||':'||content_sha256=p_dependencies->>kind for share;
   if not found or dep.status<>'complete' or dep.review_token::text is distinct from expected or dep.reported_month is distinct from d.requested_month then raise exception 'Supporting review changed'; end if;
   if exists(select 1 from public.cheshire_intake_document newer where newer.supersedes_id=dep.id) then raise exception 'Supporting source superseded'; end if;
  end loop;
  if d.source_type='operating_expenses' and not exists(select 1 from public.cheshire_finance_snapshot s where s.id='current-overhead' and s.revision_id::text=p_dependencies->>'overhead_reference') then raise exception 'Overhead reference changed'; end if;
 else
  if normalized_count<>0 or p_normalization_issue is not null then raise exception 'Unvalidated metrics rejected'; end if;
 end if;
 update public.cheshire_intake_document set status=p_validation->>'status',reported_month=case when p_validation->>'reported_month' is null then null else ((p_validation->>'reported_month')||'-01')::date end,validation=p_validation,validation_scope=p_scope,validation_dependencies=p_dependencies,reviewed_at=now(),failure_message=null where id=d.id returning * into d;
 if d.status='complete' and (normalized_count>0 or p_normalization_issue is not null) then
  insert into public.cheshire_intake_metric_batch(document_id,review_token,content_sha256,reporting_month,validator_version,normalizer_version,validation_dependencies,dependency_revisions,normalization_issue,rows)
  values(d.id,p_review_token,d.content_sha256,d.requested_month,p_validation->>'validator_version',p_normalizer_version,p_dependencies,p_dependency_revisions,p_normalization_issue,p_rows);
 end if;
 return next d;
end;
$$;
revoke all on function public.finalize_cheshire_intake_review(uuid,text,uuid,jsonb,jsonb,jsonb,jsonb,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.finalize_cheshire_intake_review(uuid,text,uuid,jsonb,jsonb,jsonb,jsonb,text,jsonb,text) to service_role;

-- Return one consistent database snapshot to the verified server. Never expose this RPC to a browser.
-- Filtering, source currency/units, transitive dependencies and ambiguity are checked before any response.
create function public.read_cheshire_metric_state(p_month date) returns jsonb
language sql stable security invoker set search_path=pg_catalog,public as $$
 with docs as (select * from public.cheshire_intake_document where requested_month=p_month order by created_at desc,id limit 250),
 batches as (select b.* from public.cheshire_intake_metric_batch b join docs d on d.id=b.document_id and d.review_token=b.review_token where b.reporting_month=p_month order by b.document_id limit 250)
 select jsonb_build_object(
  'documents',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'source_type',d.source_type,'requested_month',d.requested_month,'reported_month',d.reported_month,'content_sha256',d.content_sha256,'status',d.status,'source_origin',d.source_origin,'review_token',d.review_token,'validation',d.validation,'validation_dependencies',d.validation_dependencies,'supersedes_id',d.supersedes_id)) from docs d),'[]'::jsonb),
  'batches',coalesce((select jsonb_agg(to_jsonb(b)) from batches b),'[]'::jsonb),
  'overhead_revision',(select revision_id from public.cheshire_finance_snapshot where id='current-overhead')
 );
$$;
revoke all on function public.read_cheshire_metric_state(date) from public,anon,authenticated;
grant execute on function public.read_cheshire_metric_state(date) to service_role;
