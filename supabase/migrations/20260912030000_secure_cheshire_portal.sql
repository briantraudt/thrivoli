create table if not exists public.cheshire_portal_member (
  email text primary key check (email = lower(email)),
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.cheshire_portal_member enable row level security;
revoke all on table public.cheshire_portal_member from anon;
grant select on table public.cheshire_portal_member to authenticated;

drop policy if exists "members can verify their own access" on public.cheshire_portal_member;
create policy "members can verify their own access"
on public.cheshire_portal_member for select to authenticated
using (email = lower((select auth.jwt() ->> 'email')));

insert into public.cheshire_portal_member (email, display_name) values
  ('brian@goodbusinesshq.com', 'Brian Traudt'),
  ('briantraudt@gmail.com', 'Brian Traudt'),
  ('acahill@cfzpediatrictherapy.com', 'Amy Cahill'),
  ('cgoldstein@cfzpediatrictherapy.com', 'Craig Goldstein'),
  ('cgoldstein@cheshirefitnesszone.com', 'Craig Goldstein')
on conflict (email) do update set display_name = excluded.display_name;

drop policy if exists "anyone can read cheshire chips" on public.cheshire_chip;
drop policy if exists "anyone can add cheshire chips" on public.cheshire_chip;
drop policy if exists "anyone can edit cheshire chips" on public.cheshire_chip;
drop policy if exists "anyone can delete cheshire chips" on public.cheshire_chip;

create policy "portal members can read cheshire chips" on public.cheshire_chip
for select to authenticated using (exists (
  select 1 from public.cheshire_portal_member m where m.email = lower((select auth.jwt() ->> 'email'))
));
create policy "portal members can add cheshire chips" on public.cheshire_chip
for insert to authenticated with check (exists (
  select 1 from public.cheshire_portal_member m where m.email = lower((select auth.jwt() ->> 'email'))
));
create policy "portal members can edit cheshire chips" on public.cheshire_chip
for update to authenticated
using (exists (select 1 from public.cheshire_portal_member m where m.email = lower((select auth.jwt() ->> 'email'))))
with check (exists (select 1 from public.cheshire_portal_member m where m.email = lower((select auth.jwt() ->> 'email'))));
create policy "portal members can delete cheshire chips" on public.cheshire_chip
for delete to authenticated using (exists (
  select 1 from public.cheshire_portal_member m where m.email = lower((select auth.jwt() ->> 'email'))
));

revoke all on table public.cheshire_chip from anon;
grant select, insert, update, delete on table public.cheshire_chip to authenticated;
