# PracticePro analytics import contract

Thrivoli imports aggregate operational and financial totals. The AI analytics pipeline does not need patient names, dates of birth, diagnoses, notes, addresses, or other patient-level PHI.

## Import modes

- `historical`: the initial backfill, normally one batch per month.
- `incremental`: daily changed records after the historical load.

Every request needs a unique `idempotency_key`. Replaying a completed key is safe and does not duplicate data. A changed upstream record should retain the same `external_key`; Thrivoli updates that fact and rebuilds the affected month-to-date KPI snapshot.

## Request

Send a `POST` request to the `practicepro-ingest` Supabase Edge Function with `x-thrivoli-ingest-secret`. The secret is stored only in the source integration and Supabase Edge Function secrets.

```json
{
  "org_id": "organization-uuid",
  "source": "practicepro",
  "idempotency_key": "practicepro-2026-07-31T235900Z",
  "import_mode": "incremental",
  "period_start": "2026-07-01",
  "period_end": "2026-07-31",
  "source_updated_at": "2026-07-31T23:59:00Z",
  "rows": [
    {
      "external_key": "CHS:2026-07-31:insurance",
      "location_code": "CHS",
      "service_date": "2026-07-31",
      "revenue_stream": "insurance",
      "visits_completed": 42,
      "visits_scheduled": 47,
      "no_shows": 2,
      "cancellations": 3,
      "net_revenue": 4662.00,
      "labor_cost": 2810.00,
      "operating_cost": 620.00,
      "available_slots": 52,
      "booked_slots": 47,
      "revenue_target": 128000.00,
      "break_even_visits_target": 550
    }
  ]
}
```

`revenue_stream` is one of `insurance`, `school_contract`, `cash_program`, or `other`. Costs and revenue use dollars. `break_even_visits_target` is the client-approved monthly threshold. If it is absent, Thrivoli labels the generated break-even as a calculated fallback.

Each accepted batch validates location codes and dates, upserts aggregate facts, records accepted/rejected counts, rebuilds month-to-date KPI snapshots, and records calculation lineage. The endpoint remains inactive until `THRIVOLI_INGEST_SECRET` is configured.
