-- ============================================================================
-- Cheshire Pediatric Therapy — Practice Platform
-- PostgreSQL 16 schema · v0.9 draft for audit · 2026-07-25
--
-- CONVENTIONS
--   * ids are uuid (pgcrypto gen_random_uuid()).
--   * created_at / updated_at timestamptz on every business table (UTC).
--   * Soft delete via deleted_at where records must survive for audit.
--   * Multi-tenant by org_id; row-level security by current_setting('app.org_id').
--   * Money is numeric(12,2) — never float.
--   * -- PHI marks columns holding protected health information.
--   * Code sets and rates are versioned by effective date. A claim is ALWAYS
--     evaluated against the version in force on its DATE OF SERVICE.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================================
-- 1. TENANCY, ORGANIZATION, LOCATIONS
-- ============================================================================

CREATE TABLE org (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name        text NOT NULL,
  dba_name          text,
  tax_id            text NOT NULL,               -- encrypted at rest
  group_npi         text NOT NULL,
  taxonomy_code     text NOT NULL DEFAULT '2251P0200X',
  fiscal_year_start date NOT NULL,
  timezone          text NOT NULL DEFAULT 'America/New_York',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE location (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES org(id),
  name               text NOT NULL,              -- 'Cheshire', 'Pool Location'
  code               text NOT NULL,
  npi                text,
  service_address    jsonb NOT NULL,
  pay_to_address     jsonb,
  place_of_service   text NOT NULL DEFAULT '11', -- POS code
  timezone           text NOT NULL,
  opened_on          date,
  closed_on          date,
  monthly_rev_target numeric(12,2),
  is_aquatic         boolean NOT NULL DEFAULT false,
  deleted_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, code)
);

CREATE TABLE room (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES org(id),
  location_id uuid NOT NULL REFERENCES location(id),
  name        text NOT NULL,                     -- 'Gym A', 'Pool'
  kind        text NOT NULL,                     -- gym | room | pool | sensory
  capacity    int NOT NULL DEFAULT 1,
  is_bookable boolean NOT NULL DEFAULT true
);

CREATE TABLE operating_hours (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES location(id),
  weekday     int NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  opens_at    time NOT NULL,
  closes_at   time NOT NULL
);

-- ============================================================================
-- 2. USERS, STAFF, CREDENTIALS, ACCESS
-- ============================================================================

CREATE TABLE app_user (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES org(id),
  email               citext NOT NULL,
  password_hash       text,                      -- argon2id; null for SSO-only
  password_changed_at timestamptz,
  mfa_enrolled_at     timestamptz,
  mfa_secret          bytea,                     -- encrypted
  first_name          text NOT NULL,
  last_name           text NOT NULL,
  credentials_suffix  text,                      -- 'PT, DPT'
  job_title           text,
  mobile_phone        text,
  avatar_url          text,
  home_location_id    uuid REFERENCES location(id),
  default_landing     text NOT NULL DEFAULT 'overview',
  ui_language         text NOT NULL DEFAULT 'en-US',
  timezone            text,
  date_format         text NOT NULL DEFAULT 'MM/DD/YYYY',
  signature_block     text,
  status              text NOT NULL DEFAULT 'active', -- active | suspended | terminated
  last_login_at       timestamptz,
  deleted_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, email)
);

CREATE TABLE role (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES org(id),
  key         text NOT NULL,                     -- owner | manager | therapist | assistant | front_desk | biller
  name        text NOT NULL,
  permissions jsonb NOT NULL,                    -- {"payroll.approve": true, ...}
  UNIQUE (org_id, key)
);

CREATE TABLE user_role (
  user_id     uuid NOT NULL REFERENCES app_user(id),
  role_id     uuid NOT NULL REFERENCES role(id),
  location_id uuid REFERENCES location(id),      -- null = all locations
  PRIMARY KEY (user_id, role_id, location_id)
);

CREATE TABLE user_session (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES app_user(id),
  issued_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz,
  ip_address   inet,
  user_agent   text,
  device_label text
);

CREATE TABLE clinician (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES org(id),
  user_id               uuid NOT NULL REFERENCES app_user(id),
  discipline            text NOT NULL,           -- PT | PTA | OT | COTA | SLP
  individual_npi        text,
  state_license_no      text,
  state_license_state   text,
  supervisor_id         uuid REFERENCES clinician(id),
  primary_location_id   uuid REFERENCES location(id),
  hired_on              date,
  terminated_on         date,
  fte                   numeric(4,2) NOT NULL DEFAULT 1.00,
  target_utilization    numeric(5,2) NOT NULL DEFAULT 80.00,
  base_salary           numeric(12,2),
  visit_bonus_terms     jsonb,
  loaded_cost_per_visit numeric(12,2),
  can_supervise         boolean NOT NULL DEFAULT false,
  UNIQUE (org_id, individual_npi)
);

CREATE TABLE credential (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES org(id),
  clinician_id uuid NOT NULL REFERENCES clinician(id),
  kind         text NOT NULL,                    -- state_license | cpr | ndt | hipaa | malpractice
  identifier   text,
  issued_on    date,
  expires_on   date,
  document_url text,
  verified_at  timestamptz,
  verified_by  uuid REFERENCES app_user(id)
);
CREATE INDEX credential_expiry_idx ON credential (org_id, expires_on);

CREATE TABLE staff_requisition (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES org(id),
  location_id         uuid NOT NULL REFERENCES location(id),
  title               text NOT NULL,
  discipline          text NOT NULL,
  posted_on           date,
  status              text NOT NULL DEFAULT 'pending_approval',
  approved_by         uuid REFERENCES app_user(id),
  approved_at         timestamptz,
  monthly_loaded_cost numeric(12,2)
);

CREATE TABLE time_off_request (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinician_id uuid NOT NULL REFERENCES clinician(id),
  starts_on    date NOT NULL,
  ends_on      date NOT NULL,
  kind         text NOT NULL,                    -- pto | sick | unpaid | cme
  status       text NOT NULL DEFAULT 'pending',
  decided_by   uuid REFERENCES app_user(id),
  decided_at   timestamptz
);

-- ============================================================================
-- 3. PATIENTS, GUARDIANS, CONSENT   (PHI throughout)
-- ============================================================================

CREATE TABLE patient (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES org(id),
  mrn                  text NOT NULL,
  first_name           text NOT NULL,            -- PHI
  last_name            text NOT NULL,            -- PHI
  preferred_name       text,                     -- PHI
  date_of_birth        date NOT NULL,            -- PHI
  sex_at_birth         text,                     -- PHI
  gender_identity      text,                     -- PHI
  address              jsonb,                    -- PHI
  home_location_id     uuid REFERENCES location(id),
  primary_clinician_id uuid REFERENCES clinician(id),
  status               text NOT NULL DEFAULT 'active', -- active | on_hold | discharged | school | prospect
  referral_source_id   uuid,                     -- FK added below
  first_visit_on       date,
  discharged_on        date,
  discharge_reason     text,
  preferred_language   text NOT NULL DEFAULT 'en',
  photo_release        boolean NOT NULL DEFAULT false,
  deleted_at           timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, mrn)
);
CREATE INDEX patient_name_idx ON patient (org_id, last_name, first_name);

CREATE TABLE guardian (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES org(id),
  first_name         text NOT NULL,              -- PHI
  last_name          text NOT NULL,              -- PHI
  email              citext,                     -- PHI
  mobile_phone       text,                       -- PHI
  preferred_language text NOT NULL DEFAULT 'en',
  sms_opt_in_at      timestamptz,                -- TCPA consent record
  sms_opt_out_at     timestamptz,
  email_opt_out_at   timestamptz,
  portal_user_id     uuid REFERENCES app_user(id)
);

CREATE TABLE patient_guardian (
  patient_id         uuid NOT NULL REFERENCES patient(id),
  guardian_id        uuid NOT NULL REFERENCES guardian(id),
  relationship       text NOT NULL,              -- mother | father | grandparent | foster | legal
  is_primary         boolean NOT NULL DEFAULT false,
  has_custody        boolean NOT NULL DEFAULT true,
  custody_doc_url    text,
  can_authorize_care boolean NOT NULL DEFAULT true,
  PRIMARY KEY (patient_id, guardian_id)
);

CREATE TABLE consent (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES org(id),
  patient_id   uuid NOT NULL REFERENCES patient(id),
  guardian_id  uuid REFERENCES guardian(id),
  kind         text NOT NULL,                    -- treatment | hipaa_npp | financial | photo | telehealth
  signed_at    timestamptz,
  expires_on   date,
  document_url text,
  signature_ip inet
);

-- ============================================================================
-- 4. REFERRALS AND INTAKE (CRM pipeline)
-- ============================================================================

CREATE TABLE referral_source (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES org(id),
  kind                  text NOT NULL,           -- physician | hospital | school | self | web | other
  organization          text,
  provider_name         text,
  provider_npi          text,
  phone                 text,
  fax                   text,
  email                 citext,
  relationship_owner_id uuid REFERENCES app_user(id),
  is_active             boolean NOT NULL DEFAULT true
);

ALTER TABLE patient ADD CONSTRAINT patient_referral_source_fk
  FOREIGN KEY (referral_source_id) REFERENCES referral_source(id);

CREATE TABLE referral (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES org(id),
  referral_source_id    uuid REFERENCES referral_source(id),
  patient_id            uuid REFERENCES patient(id),  -- null until converted
  child_first_name      text NOT NULL,           -- PHI
  child_last_name       text NOT NULL,           -- PHI
  child_dob             date,                    -- PHI
  guardian_name         text,                    -- PHI
  guardian_phone        text,                    -- PHI
  referral_dx_code      text,                    -- ICD-10
  referral_reason       text,
  document_url          text,
  received_at           timestamptz NOT NULL DEFAULT now(),
  stage                 text NOT NULL DEFAULT 'new',
    -- new | contacted | insurance_verified | eval_scheduled | converted | declined
  stage_changed_at      timestamptz NOT NULL DEFAULT now(),
  urgency               text NOT NULL DEFAULT 'routine',
  preferred_location_id uuid REFERENCES location(id),
  availability_notes    text,
  first_contact_at      timestamptz,
  converted_at          timestamptz,
  declined_reason       text,
  assigned_to           uuid REFERENCES app_user(id)
);
CREATE INDEX referral_stage_idx ON referral (org_id, stage, received_at);

CREATE TABLE referral_activity (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES referral(id),
  actor_id    uuid REFERENCES app_user(id),
  kind        text NOT NULL,                     -- call | text | email | note | stage_change
  body        text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE waitlist_entry (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES org(id),
  patient_id            uuid REFERENCES patient(id),
  referral_id           uuid REFERENCES referral(id),
  need                  text NOT NULL,           -- eval | treatment | aquatic | re_eval
  preferred_location_id uuid REFERENCES location(id),
  preferred_windows     jsonb,                   -- [{"weekday":2,"after":"15:00"}]
  priority              text NOT NULL DEFAULT 'medium',
  added_at              timestamptz NOT NULL DEFAULT now(),
  removed_at            timestamptz,
  removed_reason        text
);

CREATE TABLE waitlist_offer (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waitlist_entry_id uuid NOT NULL REFERENCES waitlist_entry(id),
  slot              tstzrange NOT NULL,
  clinician_id      uuid REFERENCES clinician(id),
  sent_at           timestamptz NOT NULL DEFAULT now(),
  channel           text NOT NULL,               -- sms | email | call
  responded_at      timestamptz,
  response          text,                        -- accepted | declined | no_response
  appointment_id    uuid                         -- FK added below
);

-- ============================================================================
-- 5. SCHEDULING
-- ============================================================================

CREATE TABLE service_type (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES org(id),
  name               text NOT NULL,              -- 'Treatment', 'Initial eval', 'Aquatic Tx'
  default_minutes    int NOT NULL,
  default_cpt_codes  text[] NOT NULL DEFAULT '{}',
  requires_room_kind text,
  is_evaluation      boolean NOT NULL DEFAULT false,
  is_active          boolean NOT NULL DEFAULT true
);

CREATE TABLE clinician_availability (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinician_id   uuid NOT NULL REFERENCES clinician(id),
  location_id    uuid NOT NULL REFERENCES location(id),
  weekday        int NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  starts_at      time NOT NULL,
  ends_at        time NOT NULL,
  effective_from date NOT NULL,
  effective_to   date
);

CREATE TABLE appointment_recurrence (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES org(id),
  patient_id uuid NOT NULL REFERENCES patient(id),
  rrule      text NOT NULL,                      -- iCal RRULE
  starts_on  date NOT NULL,
  ends_on    date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE appointment (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES org(id),
  patient_id       uuid NOT NULL REFERENCES patient(id),
  clinician_id     uuid NOT NULL REFERENCES clinician(id),
  location_id      uuid NOT NULL REFERENCES location(id),
  room_id          uuid REFERENCES room(id),
  service_type_id  uuid NOT NULL REFERENCES service_type(id),
  authorization_id uuid,                         -- FK added below
  recurrence_id    uuid REFERENCES appointment_recurrence(id),
  starts_at        timestamptz NOT NULL,
  ends_at          timestamptz NOT NULL,
  status           text NOT NULL DEFAULT 'scheduled',
    -- scheduled | confirmed | arrived | in_progress | completed | no_show | cancelled | rescheduled
  confirmed_at     timestamptz,
  arrived_at       timestamptz,
  completed_at     timestamptz,
  cancelled_at     timestamptz,
  cancel_reason    text,
  cancelled_by     text,                         -- family | clinic | weather | illness
  front_desk_note  text,
  created_by       uuid REFERENCES app_user(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX appt_day_idx ON appointment (org_id, location_id, starts_at);
CREATE INDEX appt_patient_idx ON appointment (patient_id, starts_at DESC);
CREATE INDEX appt_clinician_idx ON appointment (clinician_id, starts_at);

ALTER TABLE waitlist_offer ADD CONSTRAINT waitlist_offer_appt_fk
  FOREIGN KEY (appointment_id) REFERENCES appointment(id);

-- ============================================================================
-- 6. CLINICAL RECORD (EHR)
-- ============================================================================

CREATE TABLE plan_of_care (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    uuid NOT NULL REFERENCES org(id),
  patient_id                uuid NOT NULL REFERENCES patient(id),
  primary_dx_code           text NOT NULL,       -- ICD-10, resolved by DOS
  secondary_dx_codes        text[] NOT NULL DEFAULT '{}',
  frequency_per_week        numeric(4,2),
  visit_minutes             int,
  narrative                 text,                -- PHI
  cert_period_start         date NOT NULL,
  cert_period_end           date NOT NULL,
  certified_by_provider_npi text,
  certified_at              timestamptz,
  cert_document_url         text,
  recert_due_on             date,
  progress_report_due_visit int,
  status                    text NOT NULL DEFAULT 'active',
  created_by                uuid REFERENCES clinician(id),
  created_at                timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX poc_patient_idx ON plan_of_care (patient_id, cert_period_end DESC);

CREATE TABLE goal (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_of_care_id  uuid NOT NULL REFERENCES plan_of_care(id),
  kind             text NOT NULL,                -- ltg | stg
  sequence         int NOT NULL,
  statement        text NOT NULL,                -- PHI
  baseline         text,
  target_metric    text,
  target_date      date,
  percent_complete int NOT NULL DEFAULT 0 CHECK (percent_complete BETWEEN 0 AND 100),
  status           text NOT NULL DEFAULT 'active', -- active | met | discontinued
  last_measured_on date
);

CREATE TABLE clinical_note (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES org(id),
  patient_id        uuid NOT NULL REFERENCES patient(id),
  appointment_id    uuid REFERENCES appointment(id),
  plan_of_care_id   uuid REFERENCES plan_of_care(id),
  kind              text NOT NULL,               -- daily_soap | initial_eval | re_eval | progress_report | discharge
  date_of_service   date NOT NULL,
  subjective        text,                        -- PHI
  objective         text,                        -- PHI
  assessment        text,                        -- PHI
  plan              text,                        -- PHI
  treatment_minutes int,                         -- drives the 8-minute rule
  untimed_minutes   int,
  authored_by       uuid NOT NULL REFERENCES clinician(id),
  signed_by         uuid REFERENCES clinician(id),
  signed_at         timestamptz,
  cosign_required   boolean NOT NULL DEFAULT false,
  cosigned_by       uuid REFERENCES clinician(id),
  cosigned_at       timestamptz,
  locked_at         timestamptz,
  amended_from_id   uuid REFERENCES clinical_note(id),
  status            text NOT NULL DEFAULT 'draft', -- draft | signed | needs_cosign | amended
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX note_unsigned_idx ON clinical_note (org_id, status, date_of_service);
CREATE INDEX note_patient_idx ON clinical_note (patient_id, date_of_service DESC);

CREATE TABLE note_goal_progress (
  clinical_note_id uuid NOT NULL REFERENCES clinical_note(id),
  goal_id          uuid NOT NULL REFERENCES goal(id),
  addressed        boolean NOT NULL DEFAULT true,
  measurement      text,
  percent_complete int,
  PRIMARY KEY (clinical_note_id, goal_id)
);

CREATE TABLE outcome_measure (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       uuid NOT NULL REFERENCES patient(id),
  clinical_note_id uuid REFERENCES clinical_note(id),
  instrument       text NOT NULL,                -- PDMS-2 | GMFM-66 | PEDI-CAT
  administered_on  date NOT NULL,
  raw_score        numeric(8,2),
  standard_score   numeric(8,2),
  percentile       numeric(5,2),
  interpretation   text
);

CREATE TABLE home_program (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    uuid NOT NULL REFERENCES patient(id),
  issued_by     uuid REFERENCES clinician(id),
  issued_on     date NOT NULL,
  exercises     jsonb NOT NULL,
  document_url  text,
  family_ack_at timestamptz
);

-- ============================================================================
-- 7. PAYERS, CONTRACTS, FEE SCHEDULES, AUTHORIZATIONS
-- ============================================================================

CREATE TABLE payer (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 uuid NOT NULL REFERENCES org(id),
  name                   text NOT NULL,
  payer_kind             text NOT NULL,          -- commercial | medicaid | medicare | federal | school | self_pay
  plan_type              text,                   -- PPO | HMO | MCO
  edi_payer_id           text,                   -- clearinghouse payer id
  claims_address         jsonb,
  appeals_address        jsonb,
  provider_phone         text,
  portal_url             text,
  timely_filing_days     int,
  auth_rule              text,                   -- none | after_eval | required | referral | iep
  auth_visit_limit       int,
  requires_referring_npi boolean NOT NULL DEFAULT false,
  allows_same_day_eval_treat boolean NOT NULL DEFAULT true,
  telehealth_covered_through date,
  claims_channel         text NOT NULL DEFAULT 'edi', -- edi | paper | superbill | invoice
  is_active              boolean NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);

CREATE TABLE payer_contract (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES org(id),
  payer_id          uuid NOT NULL REFERENCES payer(id),
  location_id       uuid REFERENCES location(id), -- null = all locations
  effective_on      date NOT NULL,
  expires_on        date,
  auto_renews       boolean NOT NULL DEFAULT true,
  notice_days       int,                          -- renegotiation notice window
  escalator_pct     numeric(5,2),
  document_url      text,
  negotiated_by     uuid REFERENCES app_user(id),
  notes             text
);
CREATE INDEX contract_renewal_idx ON payer_contract (org_id, expires_on);

-- Rates are versioned. Resolve by date of service, never by "current".
CREATE TABLE fee_schedule_rate (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES org(id),
  payer_contract_id uuid NOT NULL REFERENCES payer_contract(id),
  cpt_code          text NOT NULL,
  modifier          text,
  allowed_amount    numeric(12,2) NOT NULL,
  effective_on      date NOT NULL,
  expires_on        date,
  UNIQUE (payer_contract_id, cpt_code, modifier, effective_on)
);
CREATE INDEX rate_lookup_idx ON fee_schedule_rate (payer_contract_id, cpt_code, effective_on DESC);

CREATE TABLE payer_auth_policy (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_id      uuid NOT NULL REFERENCES payer(id),
  scenario      text NOT NULL,                   -- initial_eval | treatment | aquatic | telehealth | concurrent
  rule          text NOT NULL,
  detail        text,
  visit_limit   int,
  reauth_at_remaining int,
  effective_on  date NOT NULL,
  expires_on    date
);

CREATE TABLE patient_coverage (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES org(id),
  patient_id         uuid NOT NULL REFERENCES patient(id),
  payer_id           uuid NOT NULL REFERENCES payer(id),
  rank               int NOT NULL DEFAULT 1,     -- 1 primary, 2 secondary
  member_id          text NOT NULL,              -- PHI
  group_number       text,                       -- PHI
  subscriber_name    text,                       -- PHI
  subscriber_dob     date,                       -- PHI
  subscriber_relationship text,
  effective_on       date,
  terminates_on      date,
  copay_amount       numeric(12,2),
  coinsurance_pct    numeric(5,2),
  deductible_total   numeric(12,2),
  deductible_met     numeric(12,2),
  oop_max            numeric(12,2),
  visit_limit_total  int,
  visit_limit_used   int,
  card_front_url     text,                       -- PHI
  card_back_url      text,                       -- PHI
  UNIQUE (patient_id, payer_id, rank, effective_on)
);

CREATE TABLE eligibility_check (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES org(id),
  patient_id     uuid NOT NULL REFERENCES patient(id),
  coverage_id    uuid REFERENCES patient_coverage(id),
  appointment_id uuid REFERENCES appointment(id),
  checked_at     timestamptz NOT NULL DEFAULT now(),
  trigger        text NOT NULL,                  -- booking | morning_batch | manual
  result         text NOT NULL,                  -- active | inactive | termed | not_found | error
  copay_amount   numeric(12,2),
  deductible_remaining numeric(12,2),
  visits_remaining int,
  raw_271        jsonb,                          -- full X12 271 response
  error_code     text                            -- AAA segment reason
);
CREATE INDEX elig_appt_idx ON eligibility_check (appointment_id, checked_at DESC);

CREATE TABLE patient_authorization (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES org(id),
  patient_id      uuid NOT NULL REFERENCES patient(id),
  payer_id        uuid NOT NULL REFERENCES payer(id),
  coverage_id     uuid REFERENCES patient_coverage(id),
  auth_number     text,
  requested_units int,
  approved_units  int,
  used_units      int NOT NULL DEFAULT 0,
  valid_from      date,
  valid_to        date,
  scenario        text,                          -- treatment | aquatic | re_eval
  status          text NOT NULL DEFAULT 'requested',
    -- requested | portal_pending | approved | denied | expired | exhausted
  submitted_at    timestamptz,
  submitted_via   text,                          -- portal | fax | phone | edi_278
  decided_at      timestamptz,
  denial_reason   text,
  document_url    text,
  requested_by    uuid REFERENCES app_user(id)
);
CREATE INDEX auth_active_idx ON patient_authorization (patient_id, status, valid_to);

ALTER TABLE appointment ADD CONSTRAINT appointment_auth_fk
  FOREIGN KEY (authorization_id) REFERENCES patient_authorization(id);

-- ============================================================================
-- 8. CHARGE CAPTURE, CLAIMS, EDI
-- ============================================================================

CREATE TABLE charge (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES org(id),
  patient_id        uuid NOT NULL REFERENCES patient(id),
  appointment_id    uuid REFERENCES appointment(id),
  clinical_note_id  uuid REFERENCES clinical_note(id),
  location_id       uuid NOT NULL REFERENCES location(id),
  rendering_clinician_id uuid NOT NULL REFERENCES clinician(id),
  date_of_service   date NOT NULL,
  cpt_code          text NOT NULL,
  modifiers         text[] NOT NULL DEFAULT '{}', -- GP, KX, CQ, 59, 95
  units             int NOT NULL,
  timed_minutes     int,
  dx_pointers       text[] NOT NULL DEFAULT '{}',
  charge_amount     numeric(12,2) NOT NULL,
  place_of_service  text NOT NULL,
  status            text NOT NULL DEFAULT 'unbilled', -- unbilled | held | billed | voided
  hold_reason       text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX charge_unbilled_idx ON charge (org_id, status, date_of_service);

CREATE TABLE claim (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES org(id),
  claim_number          text NOT NULL,           -- 'CLM-2219'
  patient_id            uuid NOT NULL REFERENCES patient(id),
  payer_id              uuid NOT NULL REFERENCES payer(id),
  coverage_id           uuid REFERENCES patient_coverage(id),
  authorization_id      uuid REFERENCES patient_authorization(id),
  location_id           uuid NOT NULL REFERENCES location(id),
  rendering_clinician_id uuid REFERENCES clinician(id),
  billing_provider_npi  text NOT NULL,
  referring_provider_npi text,
  date_of_service_from  date NOT NULL,
  date_of_service_to    date NOT NULL,
  primary_dx_code       text NOT NULL,
  total_charge          numeric(12,2) NOT NULL,
  total_allowed         numeric(12,2) NOT NULL DEFAULT 0,
  total_paid            numeric(12,2) NOT NULL DEFAULT 0,
  patient_responsibility numeric(12,2) NOT NULL DEFAULT 0,
  write_off             numeric(12,2) NOT NULL DEFAULT 0,
  status                text NOT NULL DEFAULT 'draft',
    -- draft | scrub_failed | ready | batched | transmitted | ack_999 | ack_277ca
    -- | rejected | pending_payer | paid | partially_paid | denied | appealed
    -- | patient_balance | written_off | voided
  filing_deadline       date,
  submitted_at          timestamptz,
  first_response_at     timestamptz,
  closed_at             timestamptz,
  frequency_code        text NOT NULL DEFAULT '1', -- 1 original, 7 replacement, 8 void
  original_claim_id     uuid REFERENCES claim(id),
  code_set_version_ids  uuid[] NOT NULL DEFAULT '{}', -- versions used at scrub time
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, claim_number)
);
CREATE INDEX claim_status_idx ON claim (org_id, status, date_of_service_from);
CREATE INDEX claim_aging_idx ON claim (org_id, payer_id, submitted_at);
CREATE INDEX claim_deadline_idx ON claim (org_id, filing_deadline) WHERE closed_at IS NULL;

CREATE TABLE claim_line (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id       uuid NOT NULL REFERENCES claim(id) ON DELETE CASCADE,
  charge_id      uuid REFERENCES charge(id),
  line_number    int NOT NULL,
  cpt_code       text NOT NULL,
  modifiers      text[] NOT NULL DEFAULT '{}',
  units          int NOT NULL,
  timed_minutes  int,
  charge_amount  numeric(12,2) NOT NULL,
  allowed_amount numeric(12,2),
  paid_amount    numeric(12,2),
  adjustment_amount numeric(12,2),
  patient_amount numeric(12,2),
  denial_carc    text,
  denial_rarc    text[],
  UNIQUE (claim_id, line_number)
);

CREATE TABLE claim_event (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id     uuid NOT NULL REFERENCES claim(id),
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  kind         text NOT NULL,   -- generated | scrubbed | batched | transmitted | ack | denial | payment | appeal | note
  from_status  text,
  to_status    text,
  actor_id     uuid REFERENCES app_user(id),
  is_automated boolean NOT NULL DEFAULT false,
  detail       text,
  payload      jsonb
);
CREATE INDEX claim_event_idx ON claim_event (claim_id, occurred_at);

CREATE TABLE claim_batch (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES org(id),
  batch_number    text NOT NULL,                 -- 'BATCH-0731'
  clearinghouse_id uuid,                         -- FK added below
  payer_id        uuid REFERENCES payer(id),
  claim_count     int NOT NULL DEFAULT 0,
  total_charge    numeric(12,2) NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'queued', -- queued | transmitted | accepted | rejected
  file_format     text NOT NULL DEFAULT '837P_5010',
  created_at      timestamptz NOT NULL DEFAULT now(),
  transmitted_at  timestamptz,
  UNIQUE (org_id, batch_number)
);

CREATE TABLE claim_batch_member (
  claim_batch_id uuid NOT NULL REFERENCES claim_batch(id),
  claim_id       uuid NOT NULL REFERENCES claim(id),
  PRIMARY KEY (claim_batch_id, claim_id)
);

CREATE TABLE clearinghouse (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES org(id),
  name               text NOT NULL,              -- 'Availity'
  submitter_id       text NOT NULL,              -- 'CHS4412'
  transport          text NOT NULL DEFAULT 'sftp', -- sftp | api
  endpoint_host      text,
  credential_ref     text,                       -- secrets manager key, never the secret
  x12_version        text NOT NULL DEFAULT '005010X222A1',
  is_sandbox         boolean NOT NULL DEFAULT true,
  tpa_signed_on      date,
  baa_signed_on      date,
  nightly_send_at    time,
  last_connected_at  timestamptz
);

ALTER TABLE claim_batch ADD CONSTRAINT batch_clearinghouse_fk
  FOREIGN KEY (clearinghouse_id) REFERENCES clearinghouse(id);

CREATE TABLE edi_transaction_config (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES org(id),
  clearinghouse_id uuid REFERENCES clearinghouse(id),
  txn_code        text NOT NULL,                 -- 837P | 835 | 270 | 271 | 276 | 277 | 277CA | 999 | 278
  direction       text NOT NULL,                 -- outbound | inbound | both
  is_enabled      boolean NOT NULL DEFAULT false,
  schedule_cron   text,
  notes           text,
  UNIQUE (org_id, txn_code)
);

CREATE TABLE payer_enrollment (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES org(id),
  payer_id       uuid REFERENCES payer(id),      -- null = all payers
  txn_code       text NOT NULL,                  -- 837P | 835 | EFT | 278
  status         text NOT NULL DEFAULT 'not_started',
    -- not_started | packet_generated | submitted | in_testing | pending_payer | live | rejected
  submitted_on   date,
  approved_on    date,
  test_claims_accepted int,
  test_claims_required int,
  blocking_reason text,
  owner_id       uuid REFERENCES app_user(id),
  document_url   text,
  UNIQUE (org_id, payer_id, txn_code)
);

CREATE TABLE edi_file (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES org(id),
  clearinghouse_id uuid REFERENCES clearinghouse(id),
  claim_batch_id   uuid REFERENCES claim_batch(id),
  direction        text NOT NULL,                -- sent | received
  txn_code         text NOT NULL,
  filename         text NOT NULL,
  byte_size        int,
  storage_url      text NOT NULL,                -- object store, encrypted
  interchange_control_number text,
  occurred_at      timestamptz NOT NULL DEFAULT now(),
  parse_status     text NOT NULL DEFAULT 'pending', -- pending | parsed | error
  parse_error      text,
  summary          text
);
CREATE INDEX edi_file_idx ON edi_file (org_id, txn_code, occurred_at DESC);

CREATE TABLE edi_acknowledgement (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edi_file_id  uuid NOT NULL REFERENCES edi_file(id),
  claim_id     uuid REFERENCES claim(id),
  level        text NOT NULL,                    -- 999 | 277CA
  result       text NOT NULL,                    -- accepted | rejected
  status_code  text,
  reason_text  text,
  received_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 9. REMITTANCE, PAYMENTS, PATIENT BALANCES
-- ============================================================================

CREATE TABLE remittance (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES org(id),
  payer_id          uuid NOT NULL REFERENCES payer(id),
  edi_file_id       uuid REFERENCES edi_file(id),
  remit_number      text,                        -- 'ERA-4412'
  source            text NOT NULL DEFAULT 'era_835', -- era_835 | manual_eob | paper
  payment_method    text,                        -- eft | check | vcard
  check_or_trace_no text,
  payment_amount    numeric(12,2) NOT NULL,
  payment_date      date NOT NULL,
  posted_at         timestamptz,
  posted_by         uuid REFERENCES app_user(id),
  status            text NOT NULL DEFAULT 'ready', -- ready | needs_review | posted | variance
  variance_amount   numeric(12,2) NOT NULL DEFAULT 0,
  raw_835           jsonb
);
CREATE INDEX remit_status_idx ON remittance (org_id, status, payment_date DESC);

CREATE TABLE remittance_line (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  remittance_id   uuid NOT NULL REFERENCES remittance(id) ON DELETE CASCADE,
  claim_id        uuid REFERENCES claim(id),
  claim_line_id   uuid REFERENCES claim_line(id),
  billed_amount   numeric(12,2),
  allowed_amount  numeric(12,2),
  paid_amount     numeric(12,2),
  adjustment_amount numeric(12,2),
  patient_responsibility numeric(12,2),
  carc_code       text,
  rarc_codes      text[],
  group_code      text                           -- CO | PR | OA | PI
);

CREATE TABLE payment (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES org(id),
  kind           text NOT NULL,                  -- payer | patient | school | refund
  payer_id       uuid REFERENCES payer(id),
  patient_id     uuid REFERENCES patient(id),
  remittance_id  uuid REFERENCES remittance(id),
  amount         numeric(12,2) NOT NULL,
  received_on    date NOT NULL,
  method         text NOT NULL,                  -- eft | check | card | cash | ach
  processor_ref  text,                           -- Stripe/gateway id, never raw PAN
  deposit_id     uuid,                           -- FK added below
  unapplied_amount numeric(12,2) NOT NULL DEFAULT 0,
  created_by     uuid REFERENCES app_user(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payment_application (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id    uuid NOT NULL REFERENCES payment(id),
  claim_id      uuid REFERENCES claim(id),
  claim_line_id uuid REFERENCES claim_line(id),
  invoice_id    uuid,                            -- FK added below
  amount        numeric(12,2) NOT NULL,
  applied_at    timestamptz NOT NULL DEFAULT now(),
  applied_by    uuid REFERENCES app_user(id)
);

CREATE TABLE bank_deposit (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES org(id),
  bank_account_id uuid,                          -- FK added below
  deposit_date date NOT NULL,
  amount       numeric(12,2) NOT NULL,
  trace_number text,
  reconciled_at timestamptz,
  reconciled_by uuid REFERENCES app_user(id)
);

ALTER TABLE payment ADD CONSTRAINT payment_deposit_fk
  FOREIGN KEY (deposit_id) REFERENCES bank_deposit(id);

CREATE TABLE patient_statement (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES org(id),
  patient_id      uuid NOT NULL REFERENCES patient(id),
  guardian_id     uuid REFERENCES guardian(id),
  statement_number text NOT NULL,
  period_start    date,
  period_end      date,
  balance_amount  numeric(12,2) NOT NULL,
  sequence        int NOT NULL DEFAULT 1,        -- 1st, 2nd, final notice
  sent_at         timestamptz,
  channel         text,                          -- email | mail | portal
  document_url    text,
  paid_at         timestamptz
);

CREATE TABLE payment_plan (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES org(id),
  patient_id     uuid NOT NULL REFERENCES patient(id),
  total_amount   numeric(12,2) NOT NULL,
  installment_amount numeric(12,2) NOT NULL,
  cadence        text NOT NULL DEFAULT 'monthly',
  next_charge_on date,
  card_on_file_ref text,                         -- tokenized, PCI out of scope
  status         text NOT NULL DEFAULT 'active', -- active | completed | defaulted | cancelled
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE superbill (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES org(id),
  patient_id   uuid NOT NULL REFERENCES patient(id),
  claim_id     uuid REFERENCES claim(id),
  issued_on    date NOT NULL,
  total_amount numeric(12,2) NOT NULL,
  document_url text,
  sent_at      timestamptz,
  channel      text
);

-- ============================================================================
-- 10. DENIALS AND APPEALS
-- ============================================================================

CREATE TABLE denial (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES org(id),
  claim_id          uuid NOT NULL REFERENCES claim(id),
  claim_line_id     uuid REFERENCES claim_line(id),
  carc_code         text NOT NULL,               -- CO-197
  rarc_codes        text[],
  group_code        text,
  denied_amount     numeric(12,2) NOT NULL,
  denied_on         date NOT NULL,
  root_cause        text,                        -- categorized for reporting
  is_preventable    boolean,
  appeal_deadline   date,
  status            text NOT NULL DEFAULT 'open', -- open | appealing | overturned | upheld | written_off
  assigned_to       uuid REFERENCES app_user(id),
  resolved_at       timestamptz
);
CREATE INDEX denial_open_idx ON denial (org_id, status, appeal_deadline);

CREATE TABLE appeal (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES org(id),
  denial_id      uuid NOT NULL REFERENCES denial(id),
  claim_id       uuid NOT NULL REFERENCES claim(id),
  level          int NOT NULL DEFAULT 1,         -- 1st, 2nd, external review
  submitted_on   date,
  submitted_via  text,                           -- portal | fax | mail | edi
  deadline_on    date,
  letter_body    text,
  outcome        text,                           -- overturned | partially_paid | upheld | pending
  outcome_on     date,
  recovered_amount numeric(12,2),
  prepared_by    uuid REFERENCES app_user(id)
);

CREATE TABLE appeal_attachment (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appeal_id    uuid NOT NULL REFERENCES appeal(id),
  kind         text NOT NULL,   -- auth_letter | clinical_note | poc | eob | outcome_measure | referral
  source_table text,
  source_id    uuid,
  document_url text,
  included     boolean NOT NULL DEFAULT true
);

-- ============================================================================
-- 11. COMPLIANCE: CODE SETS, SCRUB RULES, REGULATORY CALENDAR
-- ============================================================================

CREATE TABLE code_set (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES org(id),
  key            text NOT NULL,                  -- cpt | icd10cm | hcpcs | ncci_ptp | ncci_mue | modifier | carc_rarc | mpfs | pos | taxonomy | state_medicaid
  name           text NOT NULL,
  publisher      text NOT NULL,                  -- AMA | CMS | NCHS | X12 | NUCC | state
  scope_note     text,
  update_cadence text,                           -- annual | quarterly | as_published
  license_ref    text,                           -- AMA CPT license number
  import_method  text NOT NULL DEFAULT 'automatic_with_review',
  UNIQUE (org_id, key)
);

CREATE TABLE code_set_version (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_set_id   uuid NOT NULL REFERENCES code_set(id),
  version_label text NOT NULL,                   -- '2026', 'FY2026', '2026 Q3'
  effective_on  date NOT NULL,
  expires_on    date,
  code_count    int,
  source_file_url text,
  checksum      text,
  status        text NOT NULL DEFAULT 'staged',  -- staged | active | superseded | rejected
  imported_at   timestamptz,
  imported_by   uuid REFERENCES app_user(id),
  reviewed_at   timestamptz,
  reviewed_by   uuid REFERENCES app_user(id),
  UNIQUE (code_set_id, version_label)
);
CREATE INDEX code_version_active_idx ON code_set_version (code_set_id, effective_on DESC);

CREATE TABLE code_entry (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_set_version_id uuid NOT NULL REFERENCES code_set_version(id) ON DELETE CASCADE,
  code                text NOT NULL,
  short_description   text,
  long_description    text,
  is_billable         boolean NOT NULL DEFAULT true,
  is_timed            boolean,                   -- drives 8-minute rule
  mue_limit           int,
  attributes          jsonb,
  UNIQUE (code_set_version_id, code)
);
CREATE INDEX code_entry_lookup_idx ON code_entry (code, code_set_version_id);

CREATE TABLE code_change (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_set_version_id uuid NOT NULL REFERENCES code_set_version(id),
  code                text NOT NULL,
  change_kind         text NOT NULL,             -- added | deleted | revised | split | merged | excludes_note
  detail              text,
  replaces_code       text,
  replaced_by_codes   text[],
  affects_active_charts int,                     -- how many of our charts use it
  remap_status        text NOT NULL DEFAULT 'pending', -- pending | mapped | not_applicable
  remap_to_code       text,
  reviewed_by         uuid REFERENCES app_user(id)
);

CREATE TABLE ncci_edit_pair (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_set_version_id uuid NOT NULL REFERENCES code_set_version(id),
  primary_code        text NOT NULL,
  secondary_code      text NOT NULL,
  modifier_allowed    boolean NOT NULL,
  UNIQUE (code_set_version_id, primary_code, secondary_code)
);

CREATE TABLE scrub_rule (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES org(id),
  rule_code       text NOT NULL,                 -- 'R-022'
  name            text NOT NULL,
  condition_dsl   text NOT NULL,                 -- evaluated by the scrub engine
  severity        text NOT NULL,                 -- block | warn | auto_correct | escalate | log
  auto_action     text,                          -- e.g. append modifier CQ
  payer_scope     text[] NOT NULL DEFAULT '{}',  -- empty = all payers
  source_authority text,                         -- 'CMS Pub 100-04 ch. 5 §20.2'
  biller_message  text,
  effective_on    date NOT NULL,
  expires_on      date,
  status          text NOT NULL DEFAULT 'draft', -- draft | active | retired
  created_by      uuid REFERENCES app_user(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, rule_code)
);

CREATE TABLE scrub_rule_revision (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scrub_rule_id uuid NOT NULL REFERENCES scrub_rule(id),
  changed_at    timestamptz NOT NULL DEFAULT now(),
  changed_by    uuid REFERENCES app_user(id),
  summary       text NOT NULL,
  before        jsonb,
  after         jsonb
);

CREATE TABLE scrub_result (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  claim_id      uuid NOT NULL REFERENCES claim(id),
  scrub_rule_id uuid NOT NULL REFERENCES scrub_rule(id),
  run_at        timestamptz NOT NULL DEFAULT now(),
  outcome       text NOT NULL,                   -- passed | blocked | warned | auto_corrected
  message       text,
  resolved_at   timestamptz,
  resolved_by   uuid REFERENCES app_user(id),
  was_false_positive boolean
);
CREATE INDEX scrub_result_idx ON scrub_result (claim_id, run_at DESC);
CREATE INDEX scrub_rule_perf_idx ON scrub_result (scrub_rule_id, run_at);

CREATE TABLE regulatory_event (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  due_on        date NOT NULL,
  title         text NOT NULL,
  kind          text NOT NULL,   -- code_update | contract | rule_change | audit | revalidation
  owner_id      uuid REFERENCES app_user(id),
  is_automated  boolean NOT NULL DEFAULT false,
  source_url    text,
  status        text NOT NULL DEFAULT 'open',    -- open | in_progress | complete | missed
  completed_at  timestamptz,
  completed_by  uuid REFERENCES app_user(id)
);
CREATE INDEX reg_event_idx ON regulatory_event (org_id, due_on, status);

CREATE TABLE compliance_control (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES org(id),
  area           text NOT NULL,   -- hipaa_sra | baa | audit_retention | breach_playbook | cures_access | pta_supervision | credentials | minor_consent | retention_policy | x12_version
  status         text NOT NULL,
  detail         text,
  last_reviewed_on date,
  next_review_on date,
  owner_id       uuid REFERENCES app_user(id),
  evidence_url   text
);

CREATE TABLE business_associate_agreement (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  vendor_name   text NOT NULL,
  service       text NOT NULL,   -- clearinghouse | portal | storage | billing | sms | email
  signed_on     date,
  expires_on    date,
  document_url  text,
  handles_phi   boolean NOT NULL DEFAULT true
);

-- ============================================================================
-- 12. CRM: AUTOMATIONS, TEMPLATES, CAMPAIGNS, MESSAGING
-- ============================================================================

CREATE TABLE message_template (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES org(id),
  name           text NOT NULL,
  channel        text NOT NULL,                  -- sms | email | portal | letter
  subject        text,
  body           text NOT NULL,                  -- supports {{merge_field}}
  language       text NOT NULL DEFAULT 'en',
  category       text,                           -- reminder | recall | billing | intake | marketing
  contains_phi   boolean NOT NULL DEFAULT false,
  version        int NOT NULL DEFAULT 1,
  is_active      boolean NOT NULL DEFAULT true,
  updated_by     uuid REFERENCES app_user(id),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE merge_field (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES org(id),
  key         text NOT NULL,                     -- guardian | child | time | therapist | clinic | link
  resolver    text NOT NULL,                     -- dotted path the renderer resolves
  is_phi      boolean NOT NULL DEFAULT false,
  UNIQUE (org_id, key)
);

CREATE TABLE automation (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES org(id),
  name              text NOT NULL,
  trigger_kind      text NOT NULL,
    -- appointment_scheduled | hours_before_visit | no_show | visit_completed
    -- | auth_visits_remaining | balance_age | referral_received | lapsed_patient
    -- | note_unsigned | credential_expiring
  trigger_config    jsonb NOT NULL,              -- {"hours_before": 24}
  audience_filter   jsonb,                       -- location, payer, age, status
  quiet_hours       jsonb,                       -- {"start":"21:00","end":"08:00"}
  frequency_cap     jsonb,                       -- max messages per family per week
  requires_opt_in   boolean NOT NULL DEFAULT true,
  status            text NOT NULL DEFAULT 'draft', -- draft | active | paused
  created_by        uuid REFERENCES app_user(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE automation_step (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES automation(id) ON DELETE CASCADE,
  sequence      int NOT NULL,
  delay_minutes int NOT NULL DEFAULT 0,
  action_kind   text NOT NULL,   -- send_message | create_task | change_stage | notify_staff | wait_for_reply
  template_id   uuid REFERENCES message_template(id),
  assignee_role_id uuid REFERENCES role(id),
  config        jsonb,
  stop_on_reply boolean NOT NULL DEFAULT false,
  UNIQUE (automation_id, sequence)
);

CREATE TABLE automation_run (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES org(id),
  automation_id  uuid NOT NULL REFERENCES automation(id),
  patient_id     uuid REFERENCES patient(id),
  referral_id    uuid REFERENCES referral(id),
  appointment_id uuid REFERENCES appointment(id),
  started_at     timestamptz NOT NULL DEFAULT now(),
  current_step   int,
  status         text NOT NULL DEFAULT 'running', -- running | completed | stopped | failed
  stop_reason    text,
  completed_at   timestamptz
);
CREATE INDEX automation_run_idx ON automation_run (automation_id, started_at DESC);

CREATE TABLE campaign (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES org(id),
  name           text NOT NULL,
  goal           text,                           -- reactivation | referral_nurture | school_renewal | review_request
  audience_query jsonb NOT NULL,
  template_id    uuid REFERENCES message_template(id),
  scheduled_for  timestamptz,
  status         text NOT NULL DEFAULT 'draft',  -- draft | scheduled | sending | sent | cancelled
  sent_count     int NOT NULL DEFAULT 0,
  reply_count    int NOT NULL DEFAULT 0,
  booked_count   int NOT NULL DEFAULT 0,
  attributed_revenue numeric(12,2),
  created_by     uuid REFERENCES app_user(id)
);

CREATE TABLE message (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES org(id),
  direction      text NOT NULL,                  -- outbound | inbound
  channel        text NOT NULL,                  -- sms | email | portal | voice
  patient_id     uuid REFERENCES patient(id),
  guardian_id    uuid REFERENCES guardian(id),
  referral_id    uuid REFERENCES referral(id),
  appointment_id uuid REFERENCES appointment(id),
  automation_run_id uuid REFERENCES automation_run(id),
  campaign_id    uuid REFERENCES campaign(id),
  template_id    uuid REFERENCES message_template(id),
  to_address     text,                           -- PHI
  from_address   text,
  subject        text,
  body_rendered  text,                           -- PHI
  provider       text,                           -- twilio | sendgrid | postmark (not yet wired)
  provider_message_id text,
  status         text NOT NULL DEFAULT 'queued',
    -- queued | sent | delivered | read | replied | failed | bounced | opted_out
  queued_at      timestamptz NOT NULL DEFAULT now(),
  sent_at        timestamptz,
  delivered_at   timestamptz,
  failed_reason  text,
  cost_amount    numeric(12,4)
);
CREATE INDEX message_thread_idx ON message (guardian_id, queued_at DESC);
CREATE INDEX message_status_idx ON message (org_id, status, queued_at DESC);

CREATE TABLE communication_preference (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id   uuid NOT NULL REFERENCES guardian(id),
  channel       text NOT NULL,
  category      text NOT NULL,                   -- reminder | billing | marketing
  is_allowed    boolean NOT NULL DEFAULT true,
  changed_at    timestamptz NOT NULL DEFAULT now(),
  changed_by    text,                            -- family | staff | system
  UNIQUE (guardian_id, channel, category)
);

CREATE TABLE task (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  title         text NOT NULL,
  detail        text,
  kind          text,                            -- clinical | billing | admin | compliance | follow_up
  assigned_to   uuid REFERENCES app_user(id),
  assigned_role_id uuid REFERENCES role(id),
  patient_id    uuid REFERENCES patient(id),
  claim_id      uuid REFERENCES claim(id),
  referral_id   uuid REFERENCES referral(id),
  due_at        timestamptz,
  priority      text NOT NULL DEFAULT 'normal',
  source        text NOT NULL DEFAULT 'manual',  -- manual | automation | scrub | system
  status        text NOT NULL DEFAULT 'open',    -- open | in_progress | done | dismissed
  completed_at  timestamptz,
  completed_by  uuid REFERENCES app_user(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX task_open_idx ON task (org_id, status, due_at);

-- ============================================================================
-- 13. INVENTORY AND EQUIPMENT (ERP)
-- ============================================================================

CREATE TABLE vendor (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  name          text NOT NULL,
  account_number text,
  contact_email citext,
  phone         text,
  payment_terms text,                            -- net_30
  is_active     boolean NOT NULL DEFAULT true
);

CREATE TABLE item (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES org(id),
  sku             text NOT NULL,
  name            text NOT NULL,
  category        text,                          -- equipment | supply | orthotic | assessment_kit
  unit            text NOT NULL DEFAULT 'each',
  unit_cost       numeric(12,2),
  is_billable     boolean NOT NULL DEFAULT false,
  hcpcs_code      text,                          -- when billable to a payer
  preferred_vendor_id uuid REFERENCES vendor(id),
  reorder_point   int,
  reorder_quantity int,
  is_serialized   boolean NOT NULL DEFAULT false,
  is_capital_asset boolean NOT NULL DEFAULT false,
  UNIQUE (org_id, sku)
);

CREATE TABLE inventory_level (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  item_id       uuid NOT NULL REFERENCES item(id),
  location_id   uuid NOT NULL REFERENCES location(id),
  quantity_on_hand int NOT NULL DEFAULT 0,
  quantity_reserved int NOT NULL DEFAULT 0,
  last_counted_on date,
  UNIQUE (item_id, location_id)
);

CREATE TABLE inventory_transaction (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  item_id       uuid NOT NULL REFERENCES item(id),
  location_id   uuid NOT NULL REFERENCES location(id),
  kind          text NOT NULL,   -- receipt | consumption | transfer_out | transfer_in | adjustment | dispense | return
  quantity      int NOT NULL,
  patient_id    uuid REFERENCES patient(id),     -- when dispensed to a family
  charge_id     uuid REFERENCES charge(id),      -- when billable
  purchase_order_id uuid,                        -- FK added below
  reason        text,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  actor_id      uuid REFERENCES app_user(id)
);
CREATE INDEX inv_txn_idx ON inventory_transaction (item_id, location_id, occurred_at DESC);

CREATE TABLE purchase_order (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  po_number     text NOT NULL,
  vendor_id     uuid NOT NULL REFERENCES vendor(id),
  location_id   uuid REFERENCES location(id),
  status        text NOT NULL DEFAULT 'draft',   -- draft | pending_approval | approved | ordered | partial | received | cancelled
  subtotal      numeric(12,2) NOT NULL DEFAULT 0,
  tax           numeric(12,2) NOT NULL DEFAULT 0,
  shipping      numeric(12,2) NOT NULL DEFAULT 0,
  total         numeric(12,2) NOT NULL DEFAULT 0,
  requested_by  uuid REFERENCES app_user(id),
  approved_by   uuid REFERENCES app_user(id),
  approved_at   timestamptz,
  ordered_on    date,
  expected_on   date,
  received_on   date,
  gl_account_id uuid,                            -- FK added below
  UNIQUE (org_id, po_number)
);

ALTER TABLE inventory_transaction ADD CONSTRAINT inv_txn_po_fk
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_order(id);

CREATE TABLE purchase_order_line (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_order(id) ON DELETE CASCADE,
  item_id      uuid NOT NULL REFERENCES item(id),
  quantity     int NOT NULL,
  unit_cost    numeric(12,2) NOT NULL,
  quantity_received int NOT NULL DEFAULT 0
);

CREATE TABLE equipment_asset (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES org(id),
  item_id           uuid REFERENCES item(id),
  location_id       uuid REFERENCES location(id),
  serial_number     text,
  asset_tag         text,
  purchased_on      date,
  purchase_cost     numeric(12,2),
  warranty_expires_on date,
  useful_life_months int,
  depreciation_method text,
  status            text NOT NULL DEFAULT 'in_service', -- in_service | maintenance | retired | lost
  retired_on        date
);

CREATE TABLE maintenance_event (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_asset_id uuid NOT NULL REFERENCES equipment_asset(id),
  kind              text NOT NULL,               -- inspection | repair | calibration | cleaning
  due_on            date,
  performed_on      date,
  performed_by      text,
  cost              numeric(12,2),
  notes             text,
  is_required_by_regulation boolean NOT NULL DEFAULT false
);

-- ============================================================================
-- 14. FINANCIALS (general ledger, AP, payroll summary, budgets)
-- ============================================================================

CREATE TABLE gl_account (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  code          text NOT NULL,
  name          text NOT NULL,
  type          text NOT NULL,   -- asset | liability | equity | revenue | expense
  subtype       text,
  parent_id     uuid REFERENCES gl_account(id),
  is_active     boolean NOT NULL DEFAULT true,
  UNIQUE (org_id, code)
);

ALTER TABLE purchase_order ADD CONSTRAINT po_gl_fk
  FOREIGN KEY (gl_account_id) REFERENCES gl_account(id);

CREATE TABLE journal_entry (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  entry_number  text NOT NULL,
  entry_date    date NOT NULL,
  memo          text,
  source        text NOT NULL,   -- manual | claim | payment | payroll | ap | inventory | depreciation
  source_table  text,
  source_id     uuid,
  posted_at     timestamptz,
  posted_by     uuid REFERENCES app_user(id),
  reversal_of_id uuid REFERENCES journal_entry(id),
  UNIQUE (org_id, entry_number)
);

CREATE TABLE journal_line (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES journal_entry(id) ON DELETE CASCADE,
  gl_account_id    uuid NOT NULL REFERENCES gl_account(id),
  location_id      uuid REFERENCES location(id), -- cost center
  debit            numeric(12,2) NOT NULL DEFAULT 0,
  credit           numeric(12,2) NOT NULL DEFAULT 0,
  memo             text,
  CHECK (debit >= 0 AND credit >= 0),
  CHECK (NOT (debit > 0 AND credit > 0))
);
CREATE INDEX journal_line_idx ON journal_line (gl_account_id, journal_entry_id);

CREATE TABLE bank_account (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  nickname      text NOT NULL,
  institution   text,
  account_last4 text,
  routing_last4 text,
  gl_account_id uuid REFERENCES gl_account(id),
  feed_provider text,                            -- plaid | manual
  feed_ref      text,
  is_primary    boolean NOT NULL DEFAULT false
);

ALTER TABLE bank_deposit ADD CONSTRAINT deposit_bank_fk
  FOREIGN KEY (bank_account_id) REFERENCES bank_account(id);

CREATE TABLE bank_transaction (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES org(id),
  bank_account_id uuid NOT NULL REFERENCES bank_account(id),
  posted_on       date NOT NULL,
  amount          numeric(12,2) NOT NULL,
  description     text,
  external_ref    text,
  matched_kind    text,                          -- deposit | ap_payment | payroll | fee | transfer
  matched_id      uuid,
  reconciled_at   timestamptz
);

CREATE TABLE ap_bill (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  vendor_id     uuid NOT NULL REFERENCES vendor(id),
  purchase_order_id uuid REFERENCES purchase_order(id),
  bill_number   text,
  location_id   uuid REFERENCES location(id),
  gl_account_id uuid REFERENCES gl_account(id),
  invoice_date  date NOT NULL,
  due_on        date,
  amount        numeric(12,2) NOT NULL,
  amount_paid   numeric(12,2) NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'open',    -- open | approved | scheduled | paid | disputed | void
  approved_by   uuid REFERENCES app_user(id),
  document_url  text
);
CREATE INDEX ap_aging_idx ON ap_bill (org_id, status, due_on);

CREATE TABLE ap_payment (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  ap_bill_id    uuid NOT NULL REFERENCES ap_bill(id),
  bank_account_id uuid REFERENCES bank_account(id),
  amount        numeric(12,2) NOT NULL,
  paid_on       date NOT NULL,
  method        text NOT NULL,                   -- ach | check | card
  reference     text
);

CREATE TABLE school_contract (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES org(id),
  payer_id          uuid REFERENCES payer(id),
  district_name     text NOT NULL,
  contract_number   text,
  school_year       text NOT NULL,               -- '2026-2027'
  contracted_hours  numeric(8,2),
  hourly_rate       numeric(12,2),
  contract_value    numeric(12,2),
  effective_on      date,
  expires_on        date,
  renewal_notice_on date,
  liaison_name      text,
  liaison_email     citext,
  payment_terms     text,                        -- net_45
  document_url      text,
  status            text NOT NULL DEFAULT 'active'
);

CREATE TABLE school_service_log (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES org(id),
  school_contract_id uuid NOT NULL REFERENCES school_contract(id),
  patient_id         uuid REFERENCES patient(id),
  clinician_id       uuid REFERENCES clinician(id),
  service_date       date NOT NULL,
  minutes            int NOT NULL,
  iep_goal_ref       text,
  district_signed_at timestamptz,                -- required by CT bulletin 2026-14
  district_signer    text,
  document_url       text,
  invoice_id         uuid                        -- FK added below
);

CREATE TABLE invoice (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES org(id),
  invoice_number     text NOT NULL,
  kind               text NOT NULL,              -- school | private_pay | other
  school_contract_id uuid REFERENCES school_contract(id),
  patient_id         uuid REFERENCES patient(id),
  period_start       date,
  period_end         date,
  subtotal           numeric(12,2) NOT NULL DEFAULT 0,
  total              numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid        numeric(12,2) NOT NULL DEFAULT 0,
  issued_on          date,
  due_on             date,
  status             text NOT NULL DEFAULT 'draft', -- draft | sent | partial | paid | overdue | void
  sent_at            timestamptz,
  document_url       text,
  UNIQUE (org_id, invoice_number)
);

ALTER TABLE school_service_log ADD CONSTRAINT ssl_invoice_fk
  FOREIGN KEY (invoice_id) REFERENCES invoice(id);
ALTER TABLE payment_application ADD CONSTRAINT payapp_invoice_fk
  FOREIGN KEY (invoice_id) REFERENCES invoice(id);

CREATE TABLE invoice_line (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  uuid NOT NULL REFERENCES invoice(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity    numeric(10,2) NOT NULL,
  unit_rate   numeric(12,2) NOT NULL,
  amount      numeric(12,2) NOT NULL,
  service_log_id uuid REFERENCES school_service_log(id)
);

CREATE TABLE budget (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  location_id   uuid REFERENCES location(id),
  gl_account_id uuid REFERENCES gl_account(id),
  period_month  date NOT NULL,                   -- first of month
  amount        numeric(12,2) NOT NULL,
  UNIQUE (org_id, location_id, gl_account_id, period_month)
);

CREATE TABLE payroll_period (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  starts_on     date NOT NULL,
  ends_on       date NOT NULL,
  status        text NOT NULL DEFAULT 'open',    -- open | approved | exported | paid
  gross_total   numeric(12,2),
  approved_by   uuid REFERENCES app_user(id),
  exported_at   timestamptz,
  external_ref  text                             -- payroll provider batch id
);

CREATE TABLE payroll_line (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id uuid NOT NULL REFERENCES payroll_period(id),
  clinician_id      uuid REFERENCES clinician(id),
  user_id           uuid REFERENCES app_user(id),
  location_id       uuid REFERENCES location(id),
  visits_completed  int,
  units_billed      int,
  base_amount       numeric(12,2),
  bonus_amount      numeric(12,2),
  gross_amount      numeric(12,2) NOT NULL
);

-- ============================================================================
-- 15. ANALYTICS, GOALS, SAVED VIEWS
-- ============================================================================

CREATE TABLE kpi_snapshot (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  location_id   uuid REFERENCES location(id),    -- null = whole group
  as_of_date    date NOT NULL,
  grain         text NOT NULL DEFAULT 'day',     -- day | week | month
  metrics       jsonb NOT NULL,
    -- {"net_revenue":444100,"fill_rate":0.87,"no_show_rate":0.083,
    --  "revenue_per_visit":112.4,"unbilled":34200,"margin":0.23,
    --  "clean_claim_rate":0.962,"days_in_ar":31.4,"utilization":0.79}
  computed_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, location_id, as_of_date, grain)
);
CREATE INDEX kpi_lookup_idx ON kpi_snapshot (org_id, as_of_date DESC, grain);

CREATE TABLE org_goal (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  location_id   uuid REFERENCES location(id),
  metric_key    text NOT NULL,                   -- net_revenue | fill_rate | no_show_rate | margin
  period_month  date NOT NULL,
  target_value  numeric(14,4) NOT NULL,
  owner_id      uuid REFERENCES app_user(id),
  UNIQUE (org_id, location_id, metric_key, period_month)
);

CREATE TABLE revenue_opportunity (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  location_id   uuid REFERENCES location(id),
  kind          text NOT NULL,
    -- unfilled_slots | no_show_recovery | unbilled_charges | denial_recovery
    -- | lapsed_patients | rate_gap | auth_expiring | waitlist_backlog
  title         text NOT NULL,
  detail        text,
  dollar_value  numeric(12,2),
  confidence    text,                            -- high | medium | low
  detected_on   date NOT NULL,
  status        text NOT NULL DEFAULT 'open',    -- open | acted | dismissed | expired
  acted_by      uuid REFERENCES app_user(id),
  acted_at      timestamptz,
  outcome_value numeric(12,2)
);
CREATE INDEX opportunity_idx ON revenue_opportunity (org_id, status, dollar_value DESC);

CREATE TABLE saved_view (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  user_id       uuid REFERENCES app_user(id),    -- null = shared
  module        text NOT NULL,                   -- claims | patients | schedule | reports
  name          text NOT NULL,
  filters       jsonb NOT NULL,
  columns       text[],
  sort_order    text,
  is_default    boolean NOT NULL DEFAULT false
);

CREATE TABLE report_subscription (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  saved_view_id uuid REFERENCES saved_view(id),
  report_key    text,
  recipient_user_id uuid REFERENCES app_user(id),
  cadence       text NOT NULL,                   -- daily | weekly | monthly
  send_at       time,
  format        text NOT NULL DEFAULT 'pdf',
  last_sent_at  timestamptz,
  is_active     boolean NOT NULL DEFAULT true
);

-- ============================================================================
-- 16. AUDIT, DOCUMENTS, INTEGRATIONS, SETTINGS
-- ============================================================================

-- Append-only. No UPDATE or DELETE grants. Retained 7 years minimum.
CREATE TABLE audit_event (
  id            bigserial PRIMARY KEY,
  org_id        uuid NOT NULL REFERENCES org(id),
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid REFERENCES app_user(id),
  actor_ip      inet,
  actor_session_id uuid REFERENCES user_session(id),
  action        text NOT NULL,   -- view | create | update | delete | sign | export | login | print
  entity_table  text NOT NULL,
  entity_id     uuid,
  patient_id    uuid REFERENCES patient(id),     -- set whenever PHI was touched
  is_phi_access boolean NOT NULL DEFAULT false,
  before_state  jsonb,
  after_state   jsonb,
  reason        text,                            -- break-glass justification
  request_id    text
);
CREATE INDEX audit_patient_idx ON audit_event (patient_id, occurred_at DESC);
CREATE INDEX audit_actor_idx ON audit_event (actor_user_id, occurred_at DESC);
CREATE INDEX audit_entity_idx ON audit_event (entity_table, entity_id, occurred_at DESC);

CREATE TABLE document (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  patient_id    uuid REFERENCES patient(id),
  claim_id      uuid REFERENCES claim(id),
  kind          text NOT NULL,   -- referral | insurance_card | auth_letter | eob | consent | iep | custody | contract
  filename      text NOT NULL,
  mime_type     text,
  byte_size     int,
  storage_url   text NOT NULL,                   -- encrypted object store
  contains_phi  boolean NOT NULL DEFAULT true,
  uploaded_by   uuid REFERENCES app_user(id),
  uploaded_at   timestamptz NOT NULL DEFAULT now(),
  retention_until date,                          -- pediatric: age 21 + 7 years
  deleted_at    timestamptz
);

CREATE TABLE integration (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  provider      text NOT NULL,   -- availity | twilio | sendgrid | stripe | plaid | quickbooks | gusto
  purpose       text NOT NULL,
  status        text NOT NULL DEFAULT 'not_connected', -- not_connected | sandbox | live | error
  credential_ref text,                           -- secrets manager key only
  config        jsonb,
  baa_id        uuid REFERENCES business_associate_agreement(id),
  connected_at  timestamptz,
  last_error_at timestamptz,
  last_error    text
);

CREATE TABLE webhook_event (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid REFERENCES integration(id),
  provider       text NOT NULL,
  event_type     text NOT NULL,
  external_id    text,
  payload        jsonb NOT NULL,
  received_at    timestamptz NOT NULL DEFAULT now(),
  processed_at   timestamptz,
  process_status text NOT NULL DEFAULT 'pending',
  process_error  text
);

CREATE TABLE org_setting (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  key           text NOT NULL,
  value         jsonb NOT NULL,
  updated_by    uuid REFERENCES app_user(id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, key)
);

CREATE TABLE notification (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES org(id),
  user_id       uuid NOT NULL REFERENCES app_user(id),
  kind          text NOT NULL,
  title         text NOT NULL,
  body          text,
  link_screen   text,
  link_params   jsonb,
  severity      text NOT NULL DEFAULT 'info',
  created_at    timestamptz NOT NULL DEFAULT now(),
  read_at       timestamptz,
  dismissed_at  timestamptz
);

-- ============================================================================
-- AUDIT NOTES / KNOWN GAPS  (v0.9)
-- ============================================================================
-- 1. Charge → claim_line is 1:1 today. Split-claim scenarios (secondary payer
--    rebilling) need a claim_line.charge_id many-to-one review.
-- 2. patient_coverage.deductible_met is a cached value from the last 271. It
--    drifts. Treat eligibility_check as the source of truth.
-- 3. code_entry will hold ~75k ICD-10 rows per version. Partition by
--    code_set_version_id before loading more than three versions.
-- 4. No table stores raw card numbers or bank credentials by design — only
--    processor tokens and secrets-manager references.
-- 5. audit_event is append-only at the grant level; enforce with a BEFORE
--    UPDATE/DELETE trigger that raises, not just permissions.
-- 6. Retention: document.retention_until must be recomputed if a patient's
--    date_of_birth is corrected. No trigger exists yet.
-- 7. Row-level security policies are assumed on every org_id table but are not
--    included in this file. Verify before go-live.
-- 8. Timezone: all timestamptz. Scheduling reads location.timezone for display.
--    Do not store local times in appointment.
-- 9. 278 prior auth is modeled (patient_authorization.submitted_via) but the
--    EDI path is not enabled; portal submissions are tracked by hand.
-- 10. school_service_log.district_signed_at is the hard gate for invoicing
--     under CT bulletin 2026-14. Scrub rule R-084 depends on it.
