import { supabase } from "@/lib/supabaseClient";
import { fplJson } from "@/lib/fpl";
import { DIVISION_NAMES as divisionNames, bandFor, computeStandings, loadLeagueData } from "@/lib/leagueTable";

const BAND_BACKGROUNDS = {
  gold: "rgba(212,175,55,0.25)",
  green: "rgba(63,185,80,0.15)",
  red: "rgba(248,81,73,0.15)",
};

// Colour bands, confirmed per division for this season (set in lib/leagueTable.ts)
function bandStyle(division: number, position: number): React.CSSProperties {
  const band = bandFor(division, position);
  return band ? { background: BAND_BACKGROUNDS[band] } : {};
}

// A gameweek only counts toward the table once its deadline has actually
// passed — this stops a freshly-flipped gameweek showing as a wave of false
// 0-0 draws before a single match has kicked off (Luke's scoring script
// writes a valid 0 total for every lineup on every run, even pre-kickoff).
async function getPassedDeadlineGameweeks(): Promise<Set<number>> {
  const data = await fplJson("bootstrap-static/");
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

  const bootstrapData = await fplJson("bootstrap-static/");
  const event = bootstrapData.events.find((ev: any) => ev.id === gameweek);
  const deadlinePassed = event ? new Date(event.deadline_time) < new Date() : false;

  if (!deadlinePassed) {
    return { gameweek, status: "upcoming" };
  }

  const fixturesData = await fplJson(`fixtures/?event=${gameweek}`);
  const allFinished = fixturesData.every((f: any) => f.finished_provisional === true);

  return { gameweek, status: allFinished ? "complete" : "live" };
}

export const dynamic = "force-dynamic";

export default async function TablePage() {
  const [leagueData, passedGameweeks, bannerInfo] = await Promise.all([
    loadLeagueData(),
    getPassedDeadlineGameweeks(),
    getGameweekBannerInfo(),
  ]);

  const standings = computeStandings(leagueData, (gw) => passedGameweeks.has(gw));

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
        const withStandings = standings[div] ?? [];

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