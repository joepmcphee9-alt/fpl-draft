# The Andy McPhee League — Frontend

## Local setup

1. `npm install`
2. Copy `.env.local.example` to `.env.local` and fill in your Supabase project URL and anon key (Supabase dashboard → Settings → API).
3. `npm run dev` — runs at http://localhost:3000

## What's here

- `app/page.tsx` — standings page, currently listing each division's entries (pulled live from Supabase). Will show actual points once scores are synced in.
- `app/login/page.tsx` — Google sign-in button via Supabase Auth. Won't work yet until Google sign-in is enabled in the Supabase dashboard (Authentication → Providers → Google).
- `lib/supabaseClient.ts` — the shared Supabase client used across the app.

## Deploying

Same as the golf platform — push this to a GitHub repo, then import it in Vercel. Add the two env vars from `.env.local` in Vercel's project settings (Settings → Environment Variables) before the first deploy.

## Next steps

- Enable Google auth in Supabase, then the login page will work end to end.
- Add the weekly lineup submission form once `squad_players` is populated after the draft.
- Add a scores/points column to the standings table once the Apps Script → Supabase bridge is in place.
