import { supabase } from "@/lib/supabaseClient";

export const DIVISION_NAMES: Record<number, string> = {
  1: "The Andy McPhee League",
  2: "Division 2",
  3: "Division 3",
};

export const DIVISIONS = [1, 2, 3];

// Colour bands, confirmed per division for this season
export const BANDS: Record<number, { gold: number; green: [number, number]; red: [number, number] | null }> = {
  1: { gold: 1, green: [2, 3], red: [7, 10] },
  2: { gold: 1, green: [2, 4], red: [6, 9] },
  3: { gold: 1, green: [2, 5], red: null },
};

export function bandFor(division: number, position: number): "gold" | "green" | "red" | null {
  const b = BANDS[division];
  if (!b) return null;
  if (position === b.gold) return "gold";
  if (position >= b.green[0] && position <= b.green[1]) return "green";
  if (b.red && position >= b.red[0] && position <= b.red[1]) return "red";
  return null;
}

export type LeagueEntry = { id: string; division: number; name: string };

export type LeagueData = {
  entries: LeagueEntry[]; // playing entries only (Andy's memorial entry has no email)
  fixtures: { division: number; gameweek: number; home_entry_id: string; away_entry_id: string | null; is_bye: boolean }[];
  scores: Record<string, number>; // "entryId:gameweek" -> points
  penalties: { entry_id: string; gameweek: number; points: number; reason?: string | null }[];
};

export type LeagueRow = {
  entryId: string;
  managerName: string;
  division: number;
  played: number;
  w: number;
  d: number;
  l: number;
  ptsFor: number;
  ptsAgainst: number;
  penalties: number;
  leaguePts: number;
  ptsDiff: number;
};

// Supabase returns at most 1,000 rows per request, and entry_scores passes
// that later in the season, so read it in pages.
async function fetchAllScores() {
  const rows: { entry_id: string; gameweek: number; points: number }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("entry_scores")
      .select("entry_id, gameweek, points")
      .order("gameweek", { ascending: true })
      .order("entry_id", { ascending: true })
      .range(from, from + 999);
    if (error) {
      console.error(error);
      break;
    }
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

export async function loadLeagueData(): Promise<LeagueData> {
  const [{ data: entries }, { data: fixtures }, scores, { data: penalties }] = await Promise.all([
    supabase.from("entries").select("id, division, players(name, email)"),
    supabase.from("fixtures").select("division, gameweek, home_entry_id, away_entry_id, is_bye").limit(5000),
    fetchAllScores(),
    supabase.from("penalties").select("entry_id, gameweek, points, reason"),
  ]);

  const scoreMap: Record<string, number> = {};
  scores.forEach((s) => {
    scoreMap[`${s.entry_id}:${s.gameweek}`] = s.points;
  });

  const playing = (entries ?? [])
    .map((e: any) => {
      const p = Array.isArray(e.players) ? e.players[0] : e.players;
      return { id: e.id, division: e.division, name: p?.name ?? "Unknown", email: p?.email };
    })
    .filter((e) => e.email)
    .map(({ id, division, name }) => ({ id, division, name }));

  return {
    entries: playing,
    fixtures: fixtures ?? [],
    scores: scoreMap,
    penalties: penalties ?? [],
  };
}

// The league table, counting only the gameweeks `counts` says yes to.
// Win 3, draw 1, loss 0, plus penalties. Tie-break: Pts, then Pts For, then Pts Diff.
export function computeStandings(data: LeagueData, counts: (gameweek: number) => boolean): Record<number, LeagueRow[]> {
  const rows: Record<string, LeagueRow> = {};
  data.entries.forEach((e) => {
    rows[e.id] = {
      entryId: e.id,
      managerName: e.name,
      division: e.division,
      played: 0, w: 0, d: 0, l: 0,
      ptsFor: 0, ptsAgainst: 0, penalties: 0, leaguePts: 0, ptsDiff: 0,
    };
  });

  data.penalties.forEach((p) => {
    if (rows[p.entry_id] && counts(p.gameweek)) rows[p.entry_id].penalties += p.points;
  });

  data.fixtures.forEach((f) => {
    if (f.is_bye || !f.away_entry_id) return;
    if (!counts(f.gameweek)) return;
    const homeScore = data.scores[`${f.home_entry_id}:${f.gameweek}`];
    const awayScore = data.scores[`${f.away_entry_id}:${f.gameweek}`];
    if (homeScore == null || awayScore == null) return;
    const home = rows[f.home_entry_id];
    const away = rows[f.away_entry_id];
    if (!home || !away) return;

    home.played++; away.played++;
    home.ptsFor += homeScore; home.ptsAgainst += awayScore;
    away.ptsFor += awayScore; away.ptsAgainst += homeScore;
    if (homeScore > awayScore) { home.w++; away.l++; }
    else if (homeScore < awayScore) { away.w++; home.l++; }
    else { home.d++; away.d++; }
  });

  const byDivision: Record<number, LeagueRow[]> = {};
  DIVISIONS.forEach((div) => {
    byDivision[div] = Object.values(rows)
      .filter((r) => r.division === div)
      .map((r) => ({ ...r, leaguePts: r.w * 3 + r.d + r.penalties, ptsDiff: r.ptsFor - r.ptsAgainst }))
      .sort((a, b) => b.leaguePts - a.leaguePts || b.ptsFor - a.ptsFor || b.ptsDiff - a.ptsDiff);
  });
  return byDivision;
}
