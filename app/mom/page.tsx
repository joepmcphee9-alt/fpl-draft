import { supabase } from "@/lib/supabaseClient";

const divisionNames: Record<number, string> = {
  1: "The Andy McPhee League",
  2: "Division 2",
  3: "Division 3",
};

type GameweekInfo = { gameweek: number; monthKey: string; monthLabel: string };

async function getGameweekMonths(): Promise<GameweekInfo[]> {
   const res = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/", { cache: "no-store" });
   const data = await res.json();

  return data.events.map((ev: any) => {
    const d = new Date(ev.deadline_time);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = d.toLocaleString("en-GB", { month: "long", year: "numeric" });
    return { gameweek: ev.id, monthKey, monthLabel };
  });
}

type EntryTotal = {
  entryId: string;
  managerName: string;
  division: number;
  total: number;
};

async function getMonthTotals(gameweeksInMonth: number[]): Promise<EntryTotal[]> {
  if (gameweeksInMonth.length === 0) return [];

  const { data: scores } = await supabase
    .from("entry_scores")
    .select("entry_id, points, gameweek")
    .in("gameweek", gameweeksInMonth);

  const { data: entries } = await supabase
    .from("entries")
    .select("id, division, players(name, email)"); // email used to exclude memorial entries

  const totalsByEntry: Record<string, number> = {};
  (scores ?? []).forEach((row) => {
    totalsByEntry[row.entry_id] = (totalsByEntry[row.entry_id] || 0) + row.points;
  });

  return (entries ?? [])
    .filter((e: any) => e.players?.email) // exclude memorial/non-playing entries
    .map((e: any) => ({
      entryId: e.id,
      managerName: e.players?.name ?? "Unknown",
      division: e.division,
      total: totalsByEntry[e.id] || 0,
    }))
    .filter((e) => e.total > 0 || true); // keep everyone, even 0s, for a full table
}

export default async function ManagerOfTheMonthPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const gwMonths = await getGameweekMonths();

  // Only show months that have actually started (avoid a huge empty list for the whole season)
  const now = new Date();
  const relevantMonths = gwMonths.filter((gw) => {
    const gwYear = parseInt(gw.monthKey.split("-")[0], 10);
    const gwMonth = parseInt(gw.monthKey.split("-")[1], 10);
    return gwYear < now.getFullYear() || (gwYear === now.getFullYear() && gwMonth <= now.getMonth() + 1);
  });

  const uniqueMonths = Array.from(new Set(relevantMonths.map((m) => m.monthKey))).sort();
  const currentMonthKey =
    uniqueMonths[uniqueMonths.length - 1] ??
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const selectedMonthKey = params.month ?? currentMonthKey;

  const selectedMonthLabel =
    gwMonths.find((m) => m.monthKey === selectedMonthKey)?.monthLabel ?? selectedMonthKey;

  const gameweeksInSelectedMonth = gwMonths
    .filter((m) => m.monthKey === selectedMonthKey)
    .map((m) => m.gameweek);

  const totals = await getMonthTotals(gameweeksInSelectedMonth);
  const divisions = [1, 2, 3];

  const currentIndex = uniqueMonths.indexOf(selectedMonthKey);
  const prevMonth = currentIndex > 0 ? uniqueMonths[currentIndex - 1] : null;
  const nextMonth = currentIndex < uniqueMonths.length - 1 ? uniqueMonths[currentIndex + 1] : null;

  const navLinkStyle = { color: "#58a6ff", padding: "0.3rem 0.6rem" };

  return (
    <main>
      <h1>Manager of the Month</h1>
      <p style={{ opacity: 0.7 }}>
        Gameweeks: {gameweeksInSelectedMonth.length > 0 ? gameweeksInSelectedMonth.join(", ") : "none yet"}
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem", margin: "1rem 0" }}>
        {prevMonth ? (
          <a href={`/mom?month=${prevMonth}`} style={navLinkStyle}>← Prev</a>
        ) : (
          <span style={{ ...navLinkStyle, opacity: 0.3 }}>← Prev</span>
        )}
        <strong>{selectedMonthLabel}</strong>
        {nextMonth ? (
          <a href={`/mom?month=${nextMonth}`} style={navLinkStyle}>Next →</a>
        ) : (
          <span style={{ ...navLinkStyle, opacity: 0.3 }}>Next →</span>
        )}
      </div>

      {divisions.map((div) => {
        const divTotals = totals
          .filter((t) => t.division === div)
          .sort((a, b) => b.total - a.total);

        return (
          <section key={div} style={{ marginTop: "2rem" }}>
            <h2>{divisionNames[div]}</h2>
            {divTotals.length === 0 ? (
              <p style={{ opacity: 0.6 }}>No scores yet for this month.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "0.5rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid #333" }}>
                    <th style={{ padding: "0.5rem 0" }}>#</th>
                    <th>Manager</th>
                    <th>Total points</th>
                  </tr>
                </thead>
                <tbody>
                  {divTotals.map((t, i) => (
                    <tr
                      key={t.entryId}
                      style={{
                        borderBottom: "1px solid #1c2530",
                        fontWeight: i === 0 ? "bold" : "normal",
                        color: i === 0 ? "#f1c40f" : undefined,
                      }}
                    >
                      <td style={{ padding: "0.5rem 0" }}>{i + 1}</td>
                      <td>{t.managerName}</td>
                      <td>{t.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </main>
  );
}