# Thrivoli

A high-fidelity, navigable prototype of an integrated pediatric therapy practice operating system. It covers clinical operations, scheduling, revenue cycle, accounting, school contracts, compliance, growth, and multi-location management.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

The interface works with its fictional demo dataset without environment variables. To connect the live project, add the Supabase publishable key to `.env.local`.

## Database

The canonical schema and the Supabase hardening migration are in `supabase/migrations`. The live Thrivoli project is `sfvmtrpocblsxtgtnqve`.

All demo names and numbers are fictional. Do not place real PHI in a development environment.
