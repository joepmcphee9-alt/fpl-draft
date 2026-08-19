import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// The anon key is safe to expose client-side — Supabase enforces access
// via Row Level Security policies on the tables themselves, not this key.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
