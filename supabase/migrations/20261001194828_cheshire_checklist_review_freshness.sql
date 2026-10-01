-- Additive checklist freshness metadata only. No grants, source facts, or credentials change.
-- These random public-to-existing-readers versions are distinct from internal review nonces.
-- No legacy version is inferred: re-review the manifest, then payroll, then dependent sources.
alter table public.cheshire_intake_document
 add column review_revision uuid,
 add column validation_dependency_revisions jsonb not null default '{}'::jsonb
  check (jsonb_typeof(validation_dependency_revisions)='object');

-- Persist the dependency versions under the same locks and transaction as completion.
create or replace function public.finalize_cheshire_intake_review(
 p_document_id uuid,p_content_sha256 text,p_review_token uuid,p_validation jsonb,p_scope jsonb,
 p_dependencies jsonb,p_dependency_revisions jsonb,p_normalizer_version text,p_rows jsonb,p_normalization_issue text
) returns setof public.cheshire_intake_document
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare d public.cheshire_intake_document; dep public.cheshire_intake_document; kind text; expected text; checks_ok boolean; normalized_count integer; dependency_review_versions jsonb := '{}'::jsonb;
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
   if dep.review_revision is null then raise exception 'Supporting review version unavailable'; end if;
   dependency_review_versions:=dependency_review_versions||jsonb_build_object(kind,dep.review_revision);
   if kind='payroll' and (dep.validation_dependencies->>'coverage_manifest' is distinct from p_dependencies->>'coverage_manifest'
    or not (dep.validation_dependency_revisions ? 'coverage_manifest')
    or dep.validation_dependency_revisions->>'coverage_manifest' is distinct from (select m.review_revision::text from public.cheshire_intake_document m where m.source_type='coverage_manifest' and m.requested_month=d.requested_month and m.id::text||':'||m.content_sha256=p_dependencies->>'coverage_manifest' and m.review_token::text=p_dependency_revisions->>'coverage_manifest'))
   then raise exception 'Payroll supporting review changed'; end if;
  end loop;
  if d.source_type='operating_expenses' and not exists(select 1 from public.cheshire_finance_snapshot s where s.id='current-overhead' and s.revision_id::text=p_dependencies->>'overhead_reference') then raise exception 'Overhead reference changed'; end if;
 else
  if normalized_count<>0 or p_normalization_issue is not null then raise exception 'Unvalidated metrics rejected'; end if;
 end if;
 update public.cheshire_intake_document set status=p_validation->>'status',reported_month=case when p_validation->>'reported_month' is null then null else ((p_validation->>'reported_month')||'-01')::date end,validation=p_validation,validation_scope=p_scope,validation_dependencies=p_dependencies,review_revision=gen_random_uuid(),validation_dependency_revisions=dependency_review_versions,reviewed_at=now(),failure_message=null where id=d.id returning * into d;
 if d.status='complete' and (normalized_count>0 or p_normalization_issue is not null) then
  insert into public.cheshire_intake_metric_batch(document_id,review_token,content_sha256,reporting_month,validator_version,normalizer_version,validation_dependencies,dependency_revisions,normalization_issue,rows)
  values(d.id,p_review_token,d.content_sha256,d.requested_month,p_validation->>'validator_version',p_normalizer_version,p_dependencies,p_dependency_revisions,p_normalization_issue,p_rows);
 end if;
 return next d;
end;
$$;
revoke all on function public.finalize_cheshire_intake_review(uuid,text,uuid,jsonb,jsonb,jsonb,jsonb,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.finalize_cheshire_intake_review(uuid,text,uuid,jsonb,jsonb,jsonb,jsonb,text,jsonb,text) to service_role;
