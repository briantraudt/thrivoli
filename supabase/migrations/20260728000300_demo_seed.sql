-- Fictional demo data only. No real patients or staff.
insert into public.org (
  id, legal_name, dba_name, tax_id, group_npi, fiscal_year_start, timezone
) values (
  '9f58c577-5d52-4f0a-9a25-ef87834d8301',
  'Thrivoli Pediatric Therapy Group, P.C.',
  'Thrivoli',
  'DEMO-00-0000000',
  '0000000000',
  '2026-01-01',
  'America/New_York'
) on conflict (id) do nothing;

insert into public.location (
  org_id, name, code, service_address, timezone, opened_on, monthly_rev_target, is_aquatic
) values
  ('9f58c577-5d52-4f0a-9a25-ef87834d8301', 'Cheshire', 'CHS', '{"city":"Cheshire","state":"CT"}', 'America/New_York', '2016-04-01', 128000, false),
  ('9f58c577-5d52-4f0a-9a25-ef87834d8301', 'Meriden', 'MER', '{"city":"Meriden","state":"CT"}', 'America/New_York', '2018-09-01', 91000, false),
  ('9f58c577-5d52-4f0a-9a25-ef87834d8301', 'Orange', 'ORG', '{"city":"Orange","state":"CT"}', 'America/New_York', '2020-02-01', 84000, false),
  ('9f58c577-5d52-4f0a-9a25-ef87834d8301', 'Guilford', 'GUI', '{"city":"Guilford","state":"CT"}', 'America/New_York', '2021-06-01', 76000, false),
  ('9f58c577-5d52-4f0a-9a25-ef87834d8301', 'Torrington', 'TOR', '{"city":"Torrington","state":"CT"}', 'America/New_York', '2023-01-01', 69000, false),
  ('9f58c577-5d52-4f0a-9a25-ef87834d8301', 'Pool Location', 'POOL', '{"city":"Cheshire","state":"CT"}', 'America/New_York', '2024-05-01', 52000, true)
on conflict (org_id, code) do nothing;

