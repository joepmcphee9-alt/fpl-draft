import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

export default async function WeeklyUpdatesPage({
  searchParams,
}: {
  searchParams: Promise<{ gw?: string }>;
}) {
  const params = await searchParams;

  const { data: reports, error } = await supabase
    .from("weekly_reports")
    .select("gameweek, title, body, published_at")
    .order("gameweek", { ascending: false });

  if (error) {
    return (
      <main>
        <h1>Weekly Updates</h1>
        <p style={{ color: "#f85149", marginTop: "1rem" }}>Error: {error.message}</p>
      </main>
    );
  }

  if (!reports || reports.length === 0) {
    return (
      <main>
        <h1>Weekly Updates</h1>
        <p style={{ opacity: 0.6, marginTop: "1rem" }}>No reports published yet.</p>
      </main>
    );
  }

  const selectedGw = params.gw ? parseInt(params.gw, 10) : reports[0].gameweek;
  const selectedReport = reports.find((r) => r.gameweek === selectedGw) ?? reports[0];

  return (
    <main>
      <h1>Weekly Updates</h1>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", margin: "1rem 0" }}>
        {reports.map((r) => {
          const isActive = r.gameweek === selectedReport.gameweek;
          return (
            
              key={r.gameweek}
              href={`/weekly-updates?gw=${r.gameweek}`}
              style={{
                padding: "0.4rem 0.9rem",
                borderRadius: 6,
                textDecoration: "none",
                fontSize: "0.9rem",
                background: isActive ? "#238636" : "rgba(255,255,255,0.05)",
                color: isActive ? "white" : "#e6edf3",
                border: isActive ? "none" : "1px solid #333",
              }}
            >
              GW{r.gameweek}
            </a>
          );
        })}
      </div>

      <article style={{ marginTop: "1.5rem" }}>
        <h2>{selectedReport.title || `Gameweek ${selectedReport.gameweek}`}</h2>
        <p style={{ opacity: 0.5, fontSize: "0.8rem" }}>
          {new Date(selectedReport.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
        </p>
        <div style={{ marginTop: "0.75rem", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{selectedReport.body}</div>
      </article>
    </main>
  );
}