-- Shared, unauthenticated collaborative storage for the /cheshire "Profitability Map".
-- Unlike every other table in this schema, this table is intentionally public:
-- any visitor to the site (no login) can read, add, edit, and delete chips here.
-- Do not copy this permissive pattern onto any table that holds real org/PHI data.

create table if not exists public.cheshire_chip (
  id uuid primary key default gen_random_uuid(),
  segment_index smallint,
  category text not null,
  value text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cheshire_chip_category_check check (
    category in ('services', 'revenue', 'labor', 'expenses', 'locationOverhead', 'overhead')
  ),
  constraint cheshire_chip_segment_check check (
    (category = 'overhead' and segment_index is null)
    or (category <> 'overhead' and segment_index between 0 and 2)
  ),
  constraint cheshire_chip_value_len check (char_length(value) between 1 and 200)
);

create index if not exists cheshire_chip_group_idx
  on public.cheshire_chip (category, segment_index, position);

create or replace function public.cheshire_chip_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists cheshire_chip_touch_updated_at on public.cheshire_chip;
create trigger cheshire_chip_touch_updated_at
before update on public.cheshire_chip
for each row execute function public.cheshire_chip_set_updated_at();

alter table public.cheshire_chip enable row level security;

drop policy if exists "anyone can read cheshire chips" on public.cheshire_chip;
create policy "anyone can read cheshire chips"
on public.cheshire_chip for select
to anon, authenticated
using (true);

drop policy if exists "anyone can add cheshire chips" on public.cheshire_chip;
create policy "anyone can add cheshire chips"
on public.cheshire_chip for insert
to anon, authenticated
with check (true);

drop policy if exists "anyone can edit cheshire chips" on public.cheshire_chip;
create policy "anyone can edit cheshire chips"
on public.cheshire_chip for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "anyone can delete cheshire chips" on public.cheshire_chip;
create policy "anyone can delete cheshire chips"
on public.cheshire_chip for delete
to anon, authenticated
using (true);

grant select, insert, update, delete on table public.cheshire_chip to anon, authenticated;

-- Seed the current default profitability map so the shared board starts
-- exactly where the old per-browser localStorage default did.
insert into public.cheshire_chip (segment_index, category, value, position)
values
  -- Clinics (segment 0)
  (0, 'services', 'Physical Therapy', 0),
  (0, 'services', 'Occupational Therapy', 1),
  (0, 'services', 'Speech Therapy', 2),
  (0, 'services', 'Feeding Therapy Services', 3),
  (0, 'services', 'Cage Therapy (Universal Exercise Unit)', 4),
  (0, 'services', 'Pelvic Floor Therapy', 5),
  (0, 'services', 'Aquatic Therapy Services', 6),
  (0, 'services', 'Dynamic Movement Intervention', 7),
  (0, 'revenue', 'Commercial insurers', 0),
  (0, 'revenue', 'Medicaid', 1),
  (0, 'revenue', 'Patient / family', 2),
  (0, 'revenue', 'Self-pay', 3),
  (0, 'labor', 'Clinician wages / salary', 0),
  (0, 'labor', 'Payroll taxes', 1),
  (0, 'labor', 'Benefits', 2),
  (0, 'labor', 'Contract / traveler labor', 3),
  (0, 'labor', 'Treatment time', 4),
  (0, 'labor', 'Documentation / prep', 5),
  (0, 'labor', 'PTO / nonproductive', 6),
  (0, 'labor', 'Overtime / differentials', 7),
  (0, 'expenses', 'Clinical supplies', 0),
  (0, 'expenses', 'Equipment rental / maintenance', 1),
  (0, 'expenses', 'Laundry / PPE', 2),
  (0, 'expenses', 'Merchant processing fees', 3),
  (0, 'expenses', 'Outsourced clinical services', 4),
  (0, 'locationOverhead', 'Rent / lease', 0),
  (0, 'locationOverhead', 'CAM / property taxes', 1),
  (0, 'locationOverhead', 'Utilities', 2),
  (0, 'locationOverhead', 'Cleaning / waste', 3),
  (0, 'locationOverhead', 'Front-desk / site administration', 4),
  (0, 'locationOverhead', 'Local management', 5),
  (0, 'locationOverhead', 'Local marketing', 6),
  (0, 'locationOverhead', 'Telecom / internet', 7),
  (0, 'locationOverhead', 'Security', 8),
  (0, 'locationOverhead', 'Facility repairs', 9),
  (0, 'locationOverhead', 'Leasehold amortization', 10),
  -- Schools (segment 1)
  (1, 'services', 'Physical Therapy', 0),
  (1, 'services', 'Occupational Therapy', 1),
  (1, 'services', 'Speech Therapy', 2),
  (1, 'services', 'Feeding Therapy Services', 3),
  (1, 'services', 'Cage Therapy (Universal Exercise Unit)', 4),
  (1, 'services', 'Pelvic Floor Therapy', 5),
  (1, 'services', 'Aquatic Therapy Services', 6),
  (1, 'services', 'Dynamic Movement Intervention', 7),
  (1, 'revenue', 'School district / LEA', 0),
  (1, 'revenue', 'Individual school', 1),
  (1, 'revenue', 'Other education organization', 2),
  (1, 'labor', 'Clinician wages / salary', 0),
  (1, 'labor', 'Payroll taxes', 1),
  (1, 'labor', 'Benefits', 2),
  (1, 'labor', 'Contract labor', 3),
  (1, 'labor', 'Service hours', 4),
  (1, 'labor', 'Travel time', 5),
  (1, 'labor', 'Documentation / prep', 6),
  (1, 'labor', 'PTO / nonproductive', 7),
  (1, 'labor', 'Overtime / differentials', 8),
  (1, 'expenses', 'Mileage / travel reimbursement', 0),
  (1, 'expenses', 'School supplies', 1),
  (1, 'expenses', 'Contract-specific costs', 2),
  (1, 'expenses', 'District fees', 3),
  (1, 'expenses', 'Background checks / credentialing', 4),
  (1, 'locationOverhead', 'Contract administration', 0),
  (1, 'locationOverhead', 'Scheduling / coordination', 1),
  (1, 'locationOverhead', 'Local management', 2),
  (1, 'locationOverhead', 'Telecom / IT', 3),
  (1, 'locationOverhead', 'Local recruiting', 4),
  -- Private Programs (segment 2)
  (2, 'services', 'Physical Therapy', 0),
  (2, 'services', 'Occupational Therapy', 1),
  (2, 'services', 'Speech Therapy', 2),
  (2, 'services', 'Feeding Therapy Services', 3),
  (2, 'services', 'Cage Therapy (Universal Exercise Unit)', 4),
  (2, 'services', 'Pelvic Floor Therapy', 5),
  (2, 'services', 'Aquatic Therapy Services', 6),
  (2, 'services', 'Dynamic Movement Intervention', 7),
  (2, 'services', 'Swim lessons', 8),
  (2, 'services', 'Other programs', 9),
  (2, 'revenue', 'Patient / family', 0),
  (2, 'revenue', 'School / community sponsor', 1),
  (2, 'revenue', 'Grant / scholarship fund', 2),
  (2, 'labor', 'Instructor / clinician wages', 0),
  (2, 'labor', 'Payroll taxes', 1),
  (2, 'labor', 'Benefits', 2),
  (2, 'labor', 'Contract instructors', 3),
  (2, 'labor', 'Program delivery', 4),
  (2, 'labor', 'Setup / prep', 5),
  (2, 'labor', 'PTO / nonproductive', 6),
  (2, 'labor', 'Overtime / differentials', 7),
  (2, 'expenses', 'Program supplies', 0),
  (2, 'expenses', 'Pool / facility rental', 1),
  (2, 'expenses', 'Equipment rental / maintenance', 2),
  (2, 'expenses', 'Merchant processing fees', 3),
  (2, 'expenses', 'Program-specific vendors', 4),
  (2, 'locationOverhead', 'Program administration', 0),
  (2, 'locationOverhead', 'Local management', 1),
  (2, 'locationOverhead', 'Local marketing', 2),
  (2, 'locationOverhead', 'Telecom / IT', 3),
  (2, 'locationOverhead', 'Facility occupancy', 4),
  (2, 'locationOverhead', 'Utilities / cleaning', 5),
  (2, 'locationOverhead', 'Leasehold amortization', 6),
  -- Centralized Shared Overhead (no segment)
  (null, 'overhead', 'Executive leadership', 0),
  (null, 'overhead', 'Finance / accounting', 1),
  (null, 'overhead', 'HR / recruiting', 2),
  (null, 'overhead', 'Central billing / RCM', 3),
  (null, 'overhead', 'Practice Pro / ClaimMD', 4),
  (null, 'overhead', 'QuickBooks / ADP', 5),
  (null, 'overhead', 'IT / cybersecurity', 6),
  (null, 'overhead', 'Insurance & professional fees', 7),
  (null, 'overhead', 'Legal / audit / tax', 8),
  (null, 'overhead', 'Corporate marketing', 9),
  (null, 'overhead', 'Corporate G&A', 10)
on conflict do nothing;

-- Enable realtime so every visitor's board updates live as others edit.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cheshire_chip'
  ) then
    alter publication supabase_realtime add table public.cheshire_chip;
  end if;
end $$;
