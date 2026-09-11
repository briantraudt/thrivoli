import { createClient } from "@supabase/supabase-js";

// Cheshire uses the browser-safe publishable key. Database policies enforce
// portal membership for every read and write; no privileged key is shipped.
const FALLBACK_URL = "https://sfvmtrpocblsxtgtnqve.supabase.co";
const FALLBACK_PUBLISHABLE_KEY = "sb_publishable_RbK81wb8nnTjBK371NjR_g_G_-jRZDG";

const url = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || FALLBACK_PUBLISHABLE_KEY;

export const cheshireSupabase = createClient(url, key);
