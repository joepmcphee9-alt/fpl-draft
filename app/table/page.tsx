import { supabase } from "@/lib/supabaseClient";

const divisionNames: Record<number, string> = {
  1: "The Andy McPhee League",
  2: "Division 2",
  3: "Division 3",
};

// Colour bands, confirmed per division for this season
function bandStyle(division: number, position: number): React.CSSProperties {
  const bands: Record<number, { gold: number; green: [number, number]; red: [number, number] | null }> = {
    1: { gold: 1, green: [2, 3], red: [7, 10] },
    2: { gold: 1, green: [2, 4], red: [6, 9] },
    3: { gold: 1, green: [2, 5], red: null },
  };
  const b = bands[division];
  if (!b) return {};
  if (position === b.gold) return { background: "rgba(212,175,55,0.25)" };
  if (position >= b.green[0] && position <= b.green[1]) return { background: "rgba(63,185,80,0.15)" };
  if (b.red && position >= b.red[0] && position <= b.red[1]) return { background: "rgba(248,81,73,0.15)" };
  return {};
}

// A gameweek only counts toward the table once its deadline has actually
// passed — this stops a freshly-flipped gameweek showing as a wave of false
// 0-0 draws before a single match has kicked off (Luke's scoring script
// writes a valid 0 total for every lineup on every run, even pre-kickoff).
async function getPassedDeadlineGameweeks(): Promise<Set<number>> {
  const res = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/");
  const data = await res.json();
  const now = new Date();
  const passed = new Set<number>();
  data.events.forEach((ev: any) => {
    if (new Date(ev.deadline_time) < now) passed.add(ev.id);
  });
  return passed;
}

// Works out whether the current gameweek hasn't started, is live, or is
// fully complete — for the status banner at the top of the table.
async function getGameweekBannerInfo(): Promise<{ gameweek: number; status: "upcoming" | "live" | "complete" }> {
  const settingsRes = await supabase.from("league_settings").select("current_gameweek").maybeSingle();
  const gameweek = settingsRes.data?.current_gameweek ?? 1;

  const bootstrapRes = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/");
  const bootstrapData = await bootstrapRes.json();
  const event = bootstrapData.events.find((ev: any) => ev.id === gameweek);
  const deadlinePassed = event ? new Date(event.deadline_time) < new Date() : false;

  if (!deadlinePassed) {
    return { gameweek, status: "upcoming" };
  }

  const fixturesRes = await fetch(`https://fantasy.premierleague.com/api/fixtures/?event=${gameweek}`);
  const fixturesData = await fixturesRes.json();
  const allFinished = fixturesData.every((f: any) => f.finished_provisional === true);

  return { gameweek, status: allFinished ? "complete" : "live" };
}

type Row = {
  entryId: string;
  managerName: string;
  played: number;
  w: number;
  d: number;
  l: number;
  ptsFor: number;
  ptsAgainst: number;
  penalties: number;
};

export default async function TablePage() {
  const [{ data: entries }, { data: fixtures }, { data: scores }, { data: penalties }, passedGameweeks, bannerInfo] =
    await Promise.all([
      supabase.from("entries").select("id, division, players(name, email)"),
      supabase.from("fixtures").select("division, gameweek, home_entry_id, away_entry_id, is_bye").eq("is_bye", false),
      supabase.from("entry_scores").select("entry_id, gameweek, points"),
      supabase.from("penalties").select("entry_id, points"),
      getPassedDeadlineGameweeks(),
      getGameweekBannerInfo(),
    ]);

  const scoreByEntryGw: Record<string, number> = {};
  (scores ?? []).forEach((s) => {
    scoreByEntryGw[`${s.entry_id}:${s.gameweek}`] = s.points;
  });

  const penaltyByEntry: Record<string, number> = {};
  (penalties ?? []).forEach((p) => {
    penaltyByEntry[p.entry_id] = (penaltyByEntry[p.entry_id] || 0) + p.points;
  });

  // Only real, playing entries (excludes Andy's memorial entry — no email)
  const playingEntries = (entries ?? []).filter((e: any) => e.players?.email);

  const rowsByEntry: Record<string, Row> = {};
  playingEntries.forEach((e: any) => {
    rowsByEntry[e.id] = {
      entryId: e.id,
      managerName: e.players?.name ?? "Unknown",
      played: 0,
      w: 0,
      d: 0,
      l: 0,
      ptsFor: 0,
      ptsAgainst: 0,
      penalties: penaltyByEntry[e.id] || 0,
    };
  });

  (fixtures ?? []).forEach((f) => {
    if (!f.away_entry_id) return;
    if (!passedGameweeks.has(f.gameweek)) return; // deadline hasn't passed — not live/played yet

    const homeKey = `${f.home_entry_id}:${f.gameweek}`;
    const awayKey = `${f.away_entry_id}:${f.gameweek}`;
    const homeScore = scoreByEntryGw[homeKey];
    const awayScore = scoreByEntryGw[awayKey];
    if (homeScore == null || awayScore == null) return;

    const homeRow = rowsByEntry[f.home_entry_id];
    const awayRow = rowsByEntry[f.away_entry_id];
    if (!homeRow || !awayRow) return;

    homeRow.played++;
    awayRow.played++;
    homeRow.ptsFor += homeScore;
    homeRow.ptsAgainst += awayScore;
    awayRow.ptsFor += awayScore;
    awayRow.ptsAgainst += homeScore;

    if (homeScore > awayScore) {
      homeRow.w++;
      awayRow.l++;
    } else if (homeScore < awayScore) {
      awayRow.w++;
      homeRow.l++;
    } else {
      homeRow.d++;
      awayRow.d++;
    }
  });

  const divisions = [1, 2, 3];

  const bannerText =
    bannerInfo.status === "upcoming"
      ? `Gameweek ${bannerInfo.gameweek} — starts soon`
      : bannerInfo.status === "live"
      ? `Gameweek ${bannerInfo.gameweek} — LIVE`
      : `Gameweek ${bannerInfo.gameweek} — Complete`;
  const bannerColor =
    bannerInfo.status === "upcoming" ? "#8b949e" : bannerInfo.status === "live" ? "#3fb950" : "#58a6ff";

  return (
    <main>
      <h1>League Table</h1>
      <p style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.3rem 0.8rem", borderRadius: 6, background: "rgba(255,255,255,0.05)", fontSize: "0.9rem", marginBottom: "1rem" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: bannerColor }} />
        {bannerText}
      </p>

      {divisions.map((div) => {
        const divEntryIds = new Set(playingEntries.filter((e: any) => e.division === div).map((e: any) => e.id));
        const rows = Object.values(rowsByEntry).filter((r) => divEntryIds.has(r.entryId));

        const withStandings = rows.map((r) => ({
          ...r,
          leaguePts: r.w * 3 + r.d * 1 + r.penalties,
          ptsDiff: r.ptsFor - r.ptsAgainst,
        }));

        withStandings.sort((a, b) => {
          if (b.leaguePts !== a.leaguePts) return b.leaguePts - a.leaguePts;
          if (b.ptsFor !== a.ptsFor) return b.ptsFor - a.ptsFor;
          return b.ptsDiff - a.ptsDiff;
        });

        return (
          <section key={div} style={{ marginTop: "2rem" }}>
            <h2>{divisionNames[div]}</h2>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "0.5rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #333" }}>
                  <th style={{ padding: "0.4rem 0.5rem" }}>Pos</th>
                  <th style={{ padding: "0.4rem 0.5rem" }}>Name</th>
                  <th style={{ padding: "0.4rem 0.5rem" }}>P</th>
                  <th style={{ padding: "0.4rem 0.5rem" }}>W</th>
                  <th style={{ padding: "0.4rem 0.5rem" }}>D</th>
                  <th style={{ padding: "0.4rem 0.5rem" }}>L</th>
                  <th style={{ padding: "0.4rem 0.5rem" }}>Pts Diff</th>
                  <th style={{ padding: "0.4rem 0.5rem" }}>Pts</th>
                  <th style={{ padding: "0.4rem 0.5rem" }}>Pts For</th>
                </tr>
              </thead>
              <tbody>
                {withStandings.map((r, i) => (
                  <tr key={r.entryId} style={{ borderBottom: "1px solid #1c2530", ...bandStyle(div, i + 1) }}>
                    <td style={{ padding: "0.4rem 0.5rem" }}>{i + 1}</td>
                    <td style={{ padding: "0.4rem 0.5rem" }}>{r.managerName}</td>
                    <td style={{ padding: "0.4rem 0.5rem" }}>{r.played}</td>
                    <td style={{ padding: "0.4rem 0.5rem" }}>{r.w}</td>
                    <td style={{ padding: "0.4rem 0.5rem" }}>{r.d}</td>
                    <td style={{ padding: "0.4rem 0.5rem" }}>{r.l}</td>
                    <td style={{ padding: "0.4rem 0.5rem" }}>{r.ptsDiff > 0 ? `+${r.ptsDiff}` : r.ptsDiff}</td>
                    <td style={{ padding: "0.4rem 0.5rem" }}>{r.leaguePts}</td>
                    <td style={{ padding: "0.4rem 0.5rem" }}>{r.ptsFor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </main>
  );
}