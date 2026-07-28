# Thrivoli product audit

Audit date: July 28, 2026

## Executive assessment

Thrivoli's supplied prototype is unusually complete for a pediatric therapy group. It covers the full visit-to-cash loop, multi-location operations, school contracts, accounting, compliance, and growth. Its strongest product idea is that operational exceptions are translated into dollars and placed next to an action.

The current prototype is a strong owner/operator demo, but it is not yet a production EHR. A 10/10 production product requires role-specific workspaces, real data and mutations, authentication, tested accessibility, clinical interoperability, a family portal, and end-to-end validation with PT/OT/SLP clinicians, front-desk staff, billers, and compliance counsel.

## Critical findings and disposition

| Priority | Finding | Disposition |
| --- | --- | --- |
| P0 | `main` rendered one generic template for every route | Corrected build restores all 71 distinct reference screens |
| P0 | The distinct-screen correction was left on an unmerged branch | Corrected source prepared for publication from a verified branch |
| P0 | Screen navigation had no durable URL, deep link, or browser history | Added hash routes and browser back/forward synchronization |
| P0 | 31 child/join tables have RLS enabled but no policies, so authenticated workflows that depend on them will silently return no rows | Release blocker: design parent-scoped policies per relationship before connecting the UI |
| P0 | Prototype could be mistaken for real PHI | Added a persistent Demo badge and fictional-data tooltip |
| P1 | Keyboard focus was difficult to see | Added consistent `:focus-visible` treatment |
| P1 | No skip navigation | Added a skip-to-content link and focusable main region |
| P1 | Motion preferences were ignored | Added reduced-motion support |
| P1 | The database is structurally broad but nearly unseeded | Preserve fictional UI data for the demo; seed relational workflows before data-connected release |
| P1 | The product is optimized for an owner/CFO persona | Add role-specific homes for therapist, front desk, biller, clinical director, school coordinator, and accountant |
| P1 | Family-facing care is represented only indirectly | Build a guardian portal for forms, balances, scheduling, messaging, HEP, outcomes, and consents |

## Page-by-page feature audit

Ratings describe the supplied demo after restoring the intended layouts.

### Run the day and clinical care

| Screen | Rating | What is strong | Next production requirement |
| --- | ---: | --- | --- |
| Overview | 9/10 | Prioritizes decisions, clinic performance, and recoverable revenue | Role-aware cards, live refresh, drill-through filters, metric definitions |
| Schedule | 9/10 | Makes empty capacity and visit blockers visible | Drag/drop, recurrence editing, room/equipment conflicts, travel time, telehealth |
| Patients | 8/10 | Useful roster with authorization and next-visit context | Saved views, bulk outreach, duplicate detection, privacy flags |
| Patient chart | 9/10 | Compact clinical, financial, guardian, POC, and authorization context | Full chart timeline, chart-access audit, break-glass flow, cross-discipline episodes |
| Appointment detail | 9/10 | Eligibility, authorization, copay, and note handoff are adjacent | Arrival workflow, interpreter, transport, cancellation policy, check-in forms |
| New appointment | 8/10 | Slot selection includes authorization and waitlist awareness | Recurrence, multi-visit booking, provider/location availability, conflict resolution |
| New patient | 8/10 | Captures core demographic, guardian, payer, and referral data | Duplicate search, custody rules, pronouns, interpreter, portal invitation |
| Episode of care | 9/10 | POC revisions, outcomes, HEP, and care team are coherent | Discipline-specific templates, physician certification tracking, discharge workflow |
| History & safety | 9/10 | Safety and authorized pickup are treated as operational data | Structured allergies, alerts, version history, acknowledgement rules |
| Eligibility & authorizations | 10/10 | Authorization burn and reauth timing are excellent | Automated 270/271 and 278 integrations with exception queue |
| Patient balance | 9/10 | Family responsibility, aging, card, and plan are actionable | Estimates, good-faith estimates, refunds, guarantor merge, financial assistance |
| Consents & access | 9/10 | Consent, release, and custody restrictions are first-class | State-specific policies, expiration automation, guardian e-sign audit evidence |
| SOAP note | 9/10 | Goals, charges, auth decrement, and irreversible signature are connected | Autosave, co-sign, addenda, device input, template governance, note-quality checks |
| Work queue | 9/10 | Ranks work by dollars blocked instead of chronology | Role/skill routing, SLA, escalation, bulk action, workload balancing |
| Team | 8/10 | Capacity, caseload, credentials, and open roles work well as tiles | Discipline filters, supervision relationships, competency and onboarding |
| Staff detail | 8/10 | Useful 1:1 and productivity context | Credential documents, supervision log, schedule preferences, compensation history |
| Workforce & payroll | 8/10 | Connects hours, productivity, and payroll | Time clock, corrections, leave accrual, state rules, payroll-provider reconciliation |
| My profile | 7/10 | Basic account and access presentation | MFA, sessions, devices, notification preferences, accessibility preferences |

### Revenue cycle and payer operations

| Screen | Rating | What is strong | Next production requirement |
| --- | ---: | --- | --- |
| Billing & claims | 9/10 | Aging and claim state are immediately visible | Saved worklists, batch edits, clearinghouse reconciliation, owner assignment |
| Claim detail | 10/10 | Timeline, lines, denial evidence, and next action are excellent | Immutable submission versions, attachment validation, payer portal evidence |
| Insurance reimbursements | 10/10 | Clear note → claim → send → reconcile mental model | True queues, idempotent jobs, failure recovery, reconciliation controls |
| ERA posting | 9/10 | Variances are separated from auto-postable payments | PLB handling, secondary crossover, recoupments, reversal and repost |
| Appeal packet | 9/10 | Deadline, evidence, draft letter, and expected value are together | Versioned templates, fax/portal proof, escalation levels, appeal outcome analytics |
| Payers | 9/10 | Contract and denial performance are comparable | Plan-level records, network status, contacts, credentialing dependencies |
| Payer detail | 10/10 | Rate, renewal, denial, and renegotiation evidence support action | Contract ingestion, fee-schedule version comparison, negotiated-rate validation |
| Submission pipeline | 9/10 | EDI stages and held claims are understandable | File-level lineage, retry rules, duplicate prevention, acknowledgement parser |
| EDI enrollments | 8/10 | Makes setup work and blockers visible | Enrollment document vault, signer workflow, payer-specific lead times |

### Financials and accounting

| Screen group | Rating | Audit conclusion | Next production requirement |
| --- | ---: | --- | --- |
| Financials | 9/10 | The operating view balances revenue, utilization, payer mix, and cash | Metric lineage, drill-through, close-state banner |
| P&L by location | 9/10 | Contribution margin by clinic is the correct management view | Allocations, legal-entity consolidation, scenario controls |
| Weekly owner brief | 10/10 | Excellent executive narrative focused on decisions | Scheduled delivery, annotations, acknowledgement and follow-up tasks |
| Accounting hub | 9/10 | Priority list plus module index is better than a generic card wall | Close status, permissions, accountant handoff |
| Chart of accounts | 8/10 | Hierarchy and mapping health are visible | Effective-dated changes, merge preview, dimension governance |
| Journal entry | 9/10 | Balance check and one-way posting consequences are explicit | Attachments, recurring entries, approvals, intercompany eliminations |
| General ledger & close | 9/10 | Trial balance, checklist, and locks are connected | Subledger reconciliation, reopen controls, consolidated close |
| Accountant access & audit | 9/10 | Appropriate emphasis on immutable history and period locks | PHI-safe accountant views, access expiration, export evidence |
| Bills & AP | 9/10 | Approval and cash requirements are clear | OCR, duplicate invoice control, recurring bills, vendor credits |
| Bill detail | 9/10 | Three-way match and coding are together | Partial receipt, disputes, tax, allocation across locations |
| Pay run | 9/10 | Cutoffs, payment methods, and positive pay are explicit | Dual approval, NACHA controls, void/reissue, fraud review |
| Vendors & 1099 | 9/10 | W-9 gates and 1099 readiness are first-class | TIN matching, sanctions checks, vendor portal |
| Expenses & receipts | 8/10 | Suggested coding and policy flags are useful | Mobile capture, mileage, approvals, reimbursement payroll link |
| Bank & card feeds | 9/10 | Confidence-based matching is operationally sound | Feed health, rules, split transactions, duplicate import controls |
| Reconciliation | 9/10 | Worksheet and stale items support a real close | Statement import, preparer/reviewer, evidence package |
| Financial statements | 9/10 | Accrual/cash and drill-through are right | Comparative periods, dimensions, eliminations, report builder |
| Budget vs actual | 9/10 | Variance drivers are more useful than raw differences | Driver-based forecast, staffing scenarios, version approvals |
| Fixed assets | 8/10 | Book/tax distinction and policy are present | Disposal, impairment, component assets, tax export |
| Tax & filings | 8/10 | Calendar and reserves are visible | Jurisdiction engine, evidence, extensions, notices |
| Payroll tax | 8/10 | Cross-state risk and deposits are surfaced | Agency notices, amendments, provider reconciliation |

### Growth, schools, and operations

| Screen | Rating | What is strong | Next production requirement |
| --- | ---: | --- | --- |
| Referrals & intake | 9/10 | Conversion delay and leakage are visible | Referral inbox ingestion, dedupe, eligibility automation, SLA routing |
| Referral detail | 9/10 | Checklist and communication history support conversion | Document extraction, referral completeness score, secure upload |
| Waitlist | 10/10 | Matches demand to real open slots and quantifies value | Preference decay, fairness rules, offer expiry, sibling scheduling |
| Growth engine | 8/10 | Campaigns are tied to booked value | Consent enforcement, attribution model, holdouts, channel cost |
| Automation detail | 8/10 | Trigger, audience, channel, and outcomes are understandable | Versioning, test mode, quiet hours, approval and rollback |
| Message template | 8/10 | Languages and usage are visible | Translation review, consent-aware preview, accessibility checks |
| Message thread | 9/10 | Guardian relationship and preferred language are prominent | Secure attachments, escalation, message-to-chart rules |
| Referring providers | 9/10 | Volume, conversion, and lapsed sources support outreach | NPI sync, territory ownership, referral-quality scoring |
| Locations | 9/10 | Side-by-side capacity, staffing, revenue, and margin are useful | Normalized benchmarks, forecast, lease and room capacity |
| Location detail | 9/10 | Converts staffing decisions into revenue impact | Schedule template, service mix, local compliance and demand forecast |
| Schools & districts | 10/10 | Separates signed, unsigned, delivered, and invoiceable hours | IEP service compliance, student-level privacy partitioning, district portal |
| District contract | 10/10 | Signature-gated revenue is one of the strongest workflows | Amendment versioning, service reconciliation, renewal workflow |
| New contract wizard | 10/10 | Rate, loaded cost, staffing, credentials, billing, and exceptions are excellent | Draft persistence, approvals, e-sign, redline import |
| Inventory | 8/10 | Par levels, transfers, and maintenance are integrated | Barcode/mobile counts, lot/expiry, reorder policy |
| Equipment & assets | 8/10 | Maintenance and asset accounting connect | Inspection forms, calibration, chain of custody |
| Purchase order | 8/10 | Location, coding, totals, and vendor are coherent | Approvals, receipt, partial delivery, budget availability |
| Compliance | 9/10 | Code updates, credentials, and controls are actionable | Evidence requests, risk register, policy attestations |
| Code sets | 10/10 | Effective dates protect date-of-service correctness | Licensed content controls, mapping approvals, impact simulation |
| Scrub rule builder | 9/10 | Authority, effective date, severity, and avoided dollars are visible | Test corpus, simulation, rollback, payer overrides |
| Incidents & safety | 8/10 | Guardian notification and reporting are recognized | Structured investigation, corrective action, OSHA/state workflows |
| Settings | 8/10 | Configuration categories are appropriately broad | Search, change previews, delegated admin, environment separation |
| Integrations & vendors | 9/10 | BAA requirement is correctly treated as a gate | Secret rotation, scopes, health, logs, data-flow inventory |
| Notifications | 8/10 | Alerts lead to work | Preferences, digesting, escalation, acknowledgement |
| Search | 8/10 | Cross-entity search is useful | Typo tolerance, recent items, permissions-safe indexing, keyboard navigation |

## Missing product surfaces for a 10/10 clinic platform

1. **Role-specific home screens.** Therapists need today's visits and notes; front desk needs arrivals and schedule gaps; billers need claim exceptions; clinical directors need outcomes and supervision; school coordinators need unsigned logs; owners need the existing command center.
2. **Guardian portal.** Intake, e-signatures, balances, payment plans, appointment requests, secure messaging, HEP, progress, and record requests should share one mobile-first surface.
3. **Clinical quality dashboard.** Outcomes by diagnosis/clinician/location, goal attainment, visit adherence, discharge reason, duration of care, POC timeliness, and documentation lag.
4. **Interoperability.** FHIR/USCDI strategy, electronic fax/document ingestion, e-prescribing referral sources where relevant, clearinghouse, payroll, banking, and identity integrations.
5. **Implementation and migration center.** Data import, mapping, validation, cutover status, training, and reconciliation are required to win a clinic away from an incumbent.
6. **Reliability and safety center.** Integration health, failed jobs, audit evidence, backups, downtime workflows, security events, and release status.

## Release gates

- Resolve all Supabase security-advisor findings. In particular, add explicit parent-scoped policies for child tables without `org_id`; never “fix” them with a blanket `TO authenticated` policy.
- Move `citext` and `btree_gist` out of the exposed `public` schema in a reviewed migration.
- Every screen must have loading, empty, error, forbidden, and partial-data states.
- Every mutation must define confirmation, idempotency, authorization, audit evidence, rollback or compensating action, and user-visible failure recovery.
- Every metric must publish its formula, source tables, refresh time, filters, and drill-through.
- Clinical notes, code sets, fee schedules, contracts, and accounting periods must remain effective-dated and immutable according to the schema invariants.
- PHI must never appear in logs, URLs, analytics, error reporting, or accountant views.
- Validate with at least one PT, OT, SLP, front-desk lead, biller, clinic director, school-contract coordinator, accountant, and multi-site owner before calling the product production-ready.
