import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// The anon key is safe to expose client-side — Supabase enforces access
// via Row Level Security policies on the tables themselves, not this key.
//
// Explicit auth config (rather than relying on defaults) — persistSession
// and storage are set directly, since iOS's Home Screen standalone web apps
// have been unreliable about session persistence and this rules out any
// ambiguity in what storage mechanism is actually being used.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    storageKey: "fpl-league-auth",
  },
});