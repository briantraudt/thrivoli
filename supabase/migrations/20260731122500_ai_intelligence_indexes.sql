create index if not exists ai_interaction_user_idx on public.ai_interaction (user_id) where user_id is not null;
create index if not exists ai_feedback_org_idx on public.ai_feedback (org_id);
create index if not exists ai_feedback_user_idx on public.ai_feedback (user_id) where user_id is not null;
create index if not exists ai_action_interaction_idx on public.ai_action (interaction_id) where interaction_id is not null;
create index if not exists ai_action_requested_by_idx on public.ai_action (requested_by) where requested_by is not null;
create index if not exists ai_action_confirmed_by_idx on public.ai_action (confirmed_by) where confirmed_by is not null;
