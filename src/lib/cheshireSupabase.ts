import { createClient } from "@supabase/supabase-js";

// The /cheshire "Profitability Map" is a public, unauthenticated shared board:
// every visitor reads and writes through the anon key, which Supabase RLS
// scopes down to only the cheshire_chip table (see supabase/migrations/
// 20260831190000_cheshire_shared_chips.sql). That key is designed to be
// exposed in the browser bundle, so it is safe to fall back to a hardcoded
// value when the Vite env vars are not configured for a given deployment.
const FALLBACK_URL = "https://sfvmtrpocblsxtgtnqve.supabase.co";
const FALLBACK_PUBLISHABLE_KEY = "sb_publishable_RbK81wb8nnTjBK371NjR_g_G_-jRZDG";

const url = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || FALLBACK_PUBLISHABLE_KEY;

export const cheshireSupabase = createClient(url, key);
