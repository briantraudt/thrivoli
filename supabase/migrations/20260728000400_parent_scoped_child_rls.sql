-- Restore Data API access to child and join tables without weakening tenancy.
-- Parent RLS remains authoritative: EXISTS subqueries can only see a parent row
-- already visible to the current organization.

do $$
declare
  rule record;
  operation text;
  predicate text;
begin
  for rule in
    select *
    from (values
      ('appeal_attachment',       'appeal_id',             'appeal',              'rw'),
      ('automation_step',         'automation_id',         'automation',          'rw'),
      ('claim_batch_member',      'claim_batch_id',        'claim_batch',         'rw'),
      ('claim_event',             'claim_id',              'claim',               'append'),
      ('claim_line',              'claim_id',              'claim',               'rw'),
      ('clinician_availability',  'clinician_id',          'clinician',           'rw'),
      ('code_change',             'code_set_version_id',   'code_set_version',    'ro'),
      ('code_entry',              'code_set_version_id',   'code_set_version',    'ro'),
      ('code_set_version',        'code_set_id',           'code_set',            'ro'),
      ('communication_preference','guardian_id',           'guardian',            'rw'),
      ('edi_acknowledgement',     'edi_file_id',           'edi_file',            'append'),
      ('goal',                    'plan_of_care_id',        'plan_of_care',        'rw'),
      ('home_program',            'patient_id',             'patient',             'rw'),
      ('invoice_line',            'invoice_id',             'invoice',             'rw'),
      ('journal_line',            'journal_entry_id',       'journal_entry',       'rw'),
      ('maintenance_event',       'equipment_asset_id',     'equipment_asset',     'rw'),
      ('ncci_edit_pair',          'code_set_version_id',    'code_set_version',    'ro'),
      ('note_goal_progress',      'clinical_note_id',       'clinical_note',       'rw'),
      ('operating_hours',         'location_id',            'location',            'rw'),
      ('outcome_measure',         'patient_id',             'patient',             'rw'),
      ('patient_guardian',        'patient_id',             'patient',             'rw'),
      ('payer_auth_policy',       'payer_id',               'payer',               'rw'),
      ('payment_application',     'payment_id',             'payment',             'append'),
      ('payroll_line',            'payroll_period_id',      'payroll_period',      'rw'),
      ('purchase_order_line',     'purchase_order_id',      'purchase_order',      'rw'),
      ('referral_activity',       'referral_id',            'referral',            'append'),
      ('remittance_line',         'remittance_id',          'remittance',          'append'),
      ('scrub_rule_revision',     'scrub_rule_id',          'scrub_rule',          'append'),
      ('time_off_request',        'clinician_id',           'clinician',           'rw'),
      ('user_role',               'location_id',            'location',            'ro'),
      ('waitlist_offer',          'waitlist_entry_id',      'waitlist_entry',      'rw'),
      ('webhook_event',           'integration_id',         'integration',         'append')
    ) as mappings(child_table, child_fk, parent_table, access_mode)
  loop
    execute format('revoke all on table public.%I from anon', rule.child_table);
    execute format('grant select on table public.%I to authenticated', rule.child_table);

    predicate := format(
      'exists (select 1 from public.%I parent where parent.id = %I)',
      rule.parent_table,
      rule.child_fk
    );

    execute format(
      'create policy "parent scoped read" on public.%I for select to authenticated using (%s)',
      rule.child_table,
      predicate
    );

    if rule.access_mode in ('rw', 'append') then
      execute format('grant insert on table public.%I to authenticated', rule.child_table);
      execute format(
        'create policy "parent scoped insert" on public.%I for insert to authenticated with check (%s)',
        rule.child_table,
        predicate
      );
    end if;

    if rule.access_mode = 'rw' then
      execute format('grant update, delete on table public.%I to authenticated', rule.child_table);
      execute format(
        'create policy "parent scoped update" on public.%I for update to authenticated using (%s) with check (%s)',
        rule.child_table,
        predicate,
        predicate
      );
      execute format(
        'create policy "parent scoped delete" on public.%I for delete to authenticated using (%s)',
        rule.child_table,
        predicate
      );
    end if;
  end loop;
end
$$;

-- Sessions are never organization-browsable. A user may only inspect or revoke
-- sessions belonging to their own linked application identity.
revoke all on table public.user_session from anon, authenticated;
grant select, delete on table public.user_session to authenticated;

create policy "users can read their sessions"
on public.user_session for select to authenticated
using (
  exists (
    select 1
    from public.app_user session_owner
    where session_owner.id = user_session.user_id
      and session_owner.auth_user_id = (select auth.uid())
  )
);

create policy "users can revoke their sessions"
on public.user_session for delete to authenticated
using (
  exists (
    select 1
    from public.app_user session_owner
    where session_owner.id = user_session.user_id
      and session_owner.auth_user_id = (select auth.uid())
  )
);
