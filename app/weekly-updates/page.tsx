import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

export default async function WeeklyUpdatesPage() {
  const { data: reports, error } = await supabase
    .from("weekly_reports")
    .select("gameweek, title, body, published_at")
    .order("gameweek", { ascending: false });

  return (
    <main>
      <h1>Weekly Updates</h1>

      {error && (
        <p style={{ color: "#f85149", marginTop: "1rem" }}>Error: {error.message}</p>
      )}
      {!error && (!reports || reports.length === 0) && (
        <p style={{ opacity: 0.6, marginTop: "1rem" }}>No reports published yet.</p>
      )}

      {(reports ?? []).map((r) => (
        <article key={r.gameweek} style={{ marginTop: "2rem", paddingBottom: "1.5rem", borderBottom: "1px solid #1c2530" }}>
          <h2>{r.title || `Gameweek ${r.gameweek}`}</h2>
          <p style={{ opacity: 0.5, fontSize: "0.8rem" }}>
            {new Date(r.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </p>
          <div style={{ marginTop: "0.75rem", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{r.body}</div>
        </article>
      ))}
    </main>
  );
}