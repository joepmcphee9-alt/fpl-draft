import { supabase } from "@/lib/supabaseClient";
import { firstKickoffs, fplJson } from "@/lib/fpl";
import { DIVISION_NAMES as divisionNames, bandFor, computeStandings, loadLeagueData } from "@/lib/leagueTable";
import { penaltyMarkers } from "@/lib/penaltyNotes";

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

// A gameweek only counts toward the table once its first match has kicked
// off (that's the league's deadline) — this stops a freshly-flipped gameweek
// showing as a wave of false 0-0 draws before a ball has been kicked (the
// scoring script writes a valid 0 total for every lineup on every run).
async function getStartedGameweeks(kickoffs: Record<number, string>): Promise<Set<number>> {
  const now = new Date();
  const started = new Set<number>();
  Object.entries(kickoffs).forEach(([gw, kickoff]) => {
    if (new Date(kickoff) < now) started.add(Number(gw));
  });
  return started;
}

// Works out whether the current gameweek hasn't started, is live, or is
// fully complete — for the status banner at the top of the table.
async function getGameweekBannerInfo(
  kickoffs: Record<number, string>
): Promise<{ gameweek: number; status: "upcoming" | "live" | "complete" }> {
  const settingsRes = await supabase.from("league_settings").select("current_gameweek").maybeSingle();
  const gameweek = settingsRes.data?.current_gameweek ?? 1;

  const started = kickoffs[gameweek] ? new Date(kickoffs[gameweek]) < new Date() : false;
  if (!started) {
    return { gameweek, status: "upcoming" };
  }

  const fixturesData = await fplJson(`fixtures/?event=${gameweek}`);
  const allFinished = fixturesData.every((f: any) => f.finished_provisional === true);

  return { gameweek, status: allFinished ? "complete" : "live" };
}

function Movement({ moved }: { moved: number }) {
  if (moved > 0) return <span style={{ color: "#3fb950", fontSize: "0.8rem" }}>▲{moved}</span>;
  if (moved < 0) return <span style={{ color: "#f85149", fontSize: "0.8rem" }}>▼{-moved}</span>;
  return <span style={{ color: "#8b949e", fontSize: "0.8rem" }}>–</span>;
}

export const dynamic = "force-dynamic";

export default async function TablePage() {
  const kickoffs = await firstKickoffs();
  const [leagueData, startedGameweeks, bannerInfo] = await Promise.all([
    loadLeagueData(),
    getStartedGameweeks(kickoffs),
    getGameweekBannerInfo(kickoffs),
  ]);

  const standings = computeStandings(leagueData, (gw) => startedGameweeks.has(gw));

  // Places moved since the previous gameweek — only shown when no gameweek is
  // live, so the arrows always describe a finished gameweek.
  const latestGw = startedGameweeks.size ? Math.max(...Array.from(startedGameweeks)) : 0;
  const showMovement = bannerInfo.status !== "live" && latestGw > 1;
  const previous = showMovement
    ? computeStandings(leagueData, (gw) => startedGameweeks.has(gw) && gw < latestGw)
    : null;

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
      {showMovement && (
        <p style={{ opacity: 0.6, fontSize: "0.85rem", margin: "0 0 1rem" }}>
          ▲▼ show places moved in Gameweek {latestGw}.
        </p>
      )}

      {divisions.map((div) => {
        const withStandings = standings[div] ?? [];
        const divNames: Record<string, string> = {};
        leagueData.entries.filter((e) => e.division === div).forEach((e) => (divNames[e.id] = e.name));
        const { markers, notes } = penaltyMarkers(
          leagueData.penalties
            .filter((p) => divNames[p.entry_id] && startedGameweeks.has(p.gameweek))
            .map((p) => ({ entryId: p.entry_id, name: divNames[p.entry_id], gameweek: p.gameweek, points: p.points, reason: p.reason }))
        );
        const prevPos: Record<string, number> = {};
        (previous?.[div] ?? []).forEach((r, i) => (prevPos[r.entryId] = i + 1));

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
                    <td style={{ padding: "0.4rem 0.5rem", whiteSpace: "nowrap" }}>
                      {i + 1}
                      {showMovement && prevPos[r.entryId] != null && (
                        <span style={{ marginLeft: "0.4rem" }}>
                          <Movement moved={prevPos[r.entryId] - (i + 1)} />
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "0.4rem 0.5rem" }}>{r.managerName}{markers[r.entryId] ?? ""}</td>
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
            {notes.length > 0 && (
              <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", opacity: 0.75 }}>
                {notes.map((n) => (
                  <p key={n} style={{ margin: "0.15rem 0" }}>{n}</p>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </main>
  );
}
