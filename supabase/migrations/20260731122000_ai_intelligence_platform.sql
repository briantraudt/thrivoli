create table if not exists public.ai_metric_definition (
  key text primary key,
  label text not null,
  description text not null,
  format text not null check (format in ('currency','integer','percent','decimal')),
  source text not null,
  authoritative boolean not null default true,
  supported_periods text[] not null default array['month-to-date']::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_interaction (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.org(id) on delete cascade,
  user_id uuid references public.app_user(id) on delete set null,
  session_id uuid,
  question text not null,
  answer text,
  answer_type text not null,
  status text not null default 'streaming' check (status in ('streaming','completed','failed')),
  metric_keys text[] not null default '{}',
  evidence jsonb not null default '[]'::jsonb,
  reporting_period text,
  data_as_of timestamptz,
  model text,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  contains_phi boolean not null default false,
  retention_expires_at timestamptz not null default (now() + interval '90 days'),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  interaction_id uuid not null references public.ai_interaction(id) on delete cascade,
  org_id uuid references public.org(id) on delete cascade,
  user_id uuid references public.app_user(id) on delete set null,
  rating smallint not null check (rating in (-1, 1)),
  issue_type text,
  comment text,
  created_at timestamptz not null default now(),
  unique (interaction_id, user_id)
);

create table if not exists public.ai_action (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.org(id) on delete cascade,
  requested_by uuid references public.app_user(id) on delete set null,
  interaction_id uuid references public.ai_interaction(id) on delete set null,
  action_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'preview' check (status in ('preview','confirmed','executed','cancelled','failed')),
  confirmed_by uuid references public.app_user(id) on delete set null,
  confirmed_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ai_interaction_org_created_idx on public.ai_interaction (org_id, created_at desc);
create index if not exists ai_interaction_retention_idx on public.ai_interaction (retention_expires_at);
create index if not exists ai_feedback_interaction_idx on public.ai_feedback (interaction_id);
create index if not exists ai_action_org_status_idx on public.ai_action (org_id, status, created_at desc);

alter table public.ai_metric_definition enable row level security;
alter table public.ai_interaction enable row level security;
alter table public.ai_feedback enable row level security;
alter table public.ai_action enable row level security;

create policy "Authenticated users can read metric definitions"
on public.ai_metric_definition for select to authenticated using (true);

create policy "Users can read AI interactions in their organization"
on public.ai_interaction for select to authenticated
using (exists (select 1 from public.app_user u where u.auth_user_id = (select auth.uid()) and u.org_id = ai_interaction.org_id and u.deleted_at is null));

create policy "Users can read AI feedback in their organization"
on public.ai_feedback for select to authenticated
using (exists (select 1 from public.app_user u where u.auth_user_id = (select auth.uid()) and u.org_id = ai_feedback.org_id and u.deleted_at is null));

create policy "Users can read AI actions in their organization"
on public.ai_action for select to authenticated
using (exists (select 1 from public.app_user u where u.auth_user_id = (select auth.uid()) and u.org_id = ai_action.org_id and u.deleted_at is null));

insert into public.ai_metric_definition (key,label,description,format,source,authoritative)
values
 ('revenue','Net revenue','Reported net revenue for the selected entity and reporting period.','currency','Dashboard revenue bridge',true),
 ('visits','Visits delivered','Completed visits during the reporting period.','integer','Completed visits',true),
 ('breakEven','Break-even visits','Visit volume required to cover allocated operating costs.','integer','Location economics model',true),
 ('margin','Operating margin','Operating income divided by net revenue.','percent','Clinic scorecard',true),
 ('capacity','Schedule fill','Booked clinical capacity divided by available clinical capacity.','percent','Clinic scorecard',true),
 ('noShowRate','No-show rate','No-show appointments divided by scheduled appointments.','percent','Clinic scorecard',true),
 ('openSlots','Open slots','Unfilled appointment capacity in the next fourteen days.','integer','14-day scheduling forecast',true),
 ('projectedVisits','Projected month-end visits','Month-end projection based on current visit pace.','integer','Current visit pace',false)
on conflict (key) do update set label=excluded.label, description=excluded.description, format=excluded.format, source=excluded.source, authoritative=excluded.authoritative, updated_at=now();

revoke all on public.ai_metric_definition, public.ai_interaction, public.ai_feedback, public.ai_action from anon;
grant select on public.ai_metric_definition, public.ai_interaction, public.ai_feedback, public.ai_action to authenticated;
