import { supabase } from "@/lib/supabaseClient";

// Change this if the existing Michu Cup page lives at a different route.
export const CUP_BASE_PATH = "/michu-cup";

// Shown under the group heading; these seeds are in the draw but don't play.
export const HONORARY_SEEDS: Record<number, string> = { 3: "Andy" };

// How many third-placed sides from the five-player groups go through.
export const BEST_THIRDS_THROUGH = 4;

export type CupSide = { entryId: string; name: string; score: number | null };

export type CupFixture = {
  id: string;
  group: number;
  gameweek: number;
  isBye: boolean;
  home: CupSide;
  away: CupSide | null;
  // "final" = earlier gameweek with scores, "live" = current gameweek with
  // scores so far, "upcoming" = no scores yet
  status: "final" | "live" | "upcoming";
};

export type Penalty = { entryId: string; gameweek: number; points: number };

export type StandingRow = {
  entryId: string;
  name: string;
  group: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
  penalty: number; // negative or 0
  pts: number; // 3/1/0 plus penalty
};

// through = top two; bestThird = third place good enough to go through;
// secondary = into the secondary competition; out = eliminated
export type Outcome = "through" | "bestThird" | "secondary" | "out";

export async function getCupFixtures(): Promise<{
  fixtures: CupFixture[];
  penalties: Penalty[];
  currentGameweek: number;
}> {
  const [fixturesRes, entriesRes, settingsRes] = await Promise.all([
    supabase
      .from("cup_fixtures")
      .select("id, group_number, gameweek, home_entry_id, away_entry_id, is_bye")
      .order("gameweek", { ascending: true })
      .order("group_number", { ascending: true }),
    supabase.from("entries").select("id, players(name)"),
    supabase.from("league_settings").select("current_gameweek").single(),
  ]);

  if (fixturesRes.error) console.error(fixturesRes.error);
  if (entriesRes.error) console.error(entriesRes.error);

  const rows = fixturesRes.data ?? [];
  const currentGameweek: number = settingsRes.data?.current_gameweek ?? 1;

  const names: Record<string, string> = {};
  (entriesRes.data ?? []).forEach((e: any) => {
    const player = Array.isArray(e.players) ? e.players[0] : e.players;
    names[e.id] = player?.name ?? "—";
  });

  // Scores and penalties come from the same tables the league uses.
  const scores: Record<string, number> = {};
  let penalties: Penalty[] = [];
  if (rows.length > 0) {
    const gws = rows.map((r) => r.gameweek);
    const minGw = Math.min(...gws);
    const maxGw = Math.max(...gws);
    const [scoresRes, penaltiesRes] = await Promise.all([
      supabase.from("entry_scores").select("entry_id, gameweek, points").gte("gameweek", minGw).lte("gameweek", maxGw),
      supabase.from("penalties").select("entry_id, gameweek, points").gte("gameweek", minGw).lte("gameweek", maxGw),
    ]);
    if (scoresRes.error) console.error(scoresRes.error);
    if (penaltiesRes.error) console.error(penaltiesRes.error);
    (scoresRes.data ?? []).forEach((s) => {
      scores[`${s.entry_id}:${s.gameweek}`] = s.points;
    });
    penalties = (penaltiesRes.data ?? []).map((p) => ({
      entryId: p.entry_id,
      gameweek: p.gameweek,
      points: p.points,
    }));
  }

  const side = (entryId: string, gw: number): CupSide => ({
    entryId,
    name: names[entryId] ?? "—",
    score: scores[`${entryId}:${gw}`] ?? null,
  });

  const fixtures: CupFixture[] = rows.map((r) => {
    const home = side(r.home_entry_id, r.gameweek);
    const away = r.is_bye || !r.away_entry_id ? null : side(r.away_entry_id, r.gameweek);
    const hasScores = home.score !== null && away?.score != null;
    return {
      id: r.id,
      group: r.group_number,
      gameweek: r.gameweek,
      isBye: r.is_bye,
      home,
      away,
      status: !hasScores ? "upcoming" : r.gameweek < currentGameweek ? "final" : "live",
    };
  });

  return { fixtures, penalties, currentGameweek };
}

// Pts For, then Pts Diff, then name — the league's tie-break after league points.
const compareRows = (x: StandingRow, y: StandingRow) =>
  y.pts - x.pts || y.pointsFor - x.pointsFor || y.diff - x.diff || x.name.localeCompare(y.name);

// Win 3, draw 1, loss 0, plus any missed-deadline penalties (-3 each) from
// gameweeks where that manager had a cup match. A penalty in their cup bye
// week doesn't count, since there was no cup game to forfeit.
// A match counts once both managers have a score, so the table moves live.
export function buildStandings(fixtures: CupFixture[], penalties: Penalty[] = []): Record<number, StandingRow[]> {
  const byGroup: Record<number, Record<string, StandingRow>> = {};
  const cupMatchWeeks = new Set<string>(); // "entryId:gameweek"

  const row = (group: number, s: CupSide) => {
    byGroup[group] ??= {};
    byGroup[group][s.entryId] ??= {
      entryId: s.entryId,
      name: s.name,
      group,
      played: 0, won: 0, drawn: 0, lost: 0,
      pointsFor: 0, pointsAgainst: 0, diff: 0, penalty: 0, pts: 0,
    };
    return byGroup[group][s.entryId];
  };

  for (const f of fixtures) {
    const home = row(f.group, f.home);
    if (!f.away) continue;
    const away = row(f.group, f.away);
    cupMatchWeeks.add(`${f.home.entryId}:${f.gameweek}`);
    cupMatchWeeks.add(`${f.away.entryId}:${f.gameweek}`);
    if (f.home.score === null || f.away.score === null) continue;

    const h = f.home.score;
    const a = f.away.score;
    home.played++; away.played++;
    home.pointsFor += h; home.pointsAgainst += a;
    away.pointsFor += a; away.pointsAgainst += h;
    if (h > a) { home.won++; away.lost++; }
    else if (h < a) { away.won++; home.lost++; }
    else { home.drawn++; away.drawn++; }
  }

  for (const p of penalties) {
    if (!cupMatchWeeks.has(`${p.entryId}:${p.gameweek}`)) continue;
    for (const rows of Object.values(byGroup)) {
      if (rows[p.entryId]) rows[p.entryId].penalty += p.points;
    }
  }

  const result: Record<number, StandingRow[]> = {};
  for (const [group, rows] of Object.entries(byGroup)) {
    result[Number(group)] = Object.values(rows)
      .map((r) => ({
        ...r,
        diff: r.pointsFor - r.pointsAgainst,
        pts: r.won * 3 + r.drawn + r.penalty,
      }))
      .sort(compareRows);
  }
  return result;
}

// Five-player groups: 1st-2nd through, 3rd into the best-thirds ranking,
// 4th secondary, 5th out. The best BEST_THIRDS_THROUGH thirds go through,
// the rest drop into the secondary competition.
// Four-player groups (Group 3): 1st-2nd through, 3rd-4th secondary, nobody out.
// Before the groups finish this is "as it stands".
export function assignOutcomes(standings: Record<number, StandingRow[]>): {
  outcomes: Record<string, Outcome>;
  thirds: StandingRow[]; // ranked best to worst
} {
  const outcomes: Record<string, Outcome> = {};
  const thirds: StandingRow[] = [];

  for (const rows of Object.values(standings)) {
    const fiveGroup = rows.length >= 5;
    rows.forEach((r, i) => {
      if (i < 2) outcomes[r.entryId] = "through";
      else if (i === 2 && fiveGroup) thirds.push(r);
      else if (fiveGroup && i === rows.length - 1) outcomes[r.entryId] = "out";
      else outcomes[r.entryId] = "secondary";
    });
  }

  // Every five-player group plays the same number of games, so thirds are
  // compared on the same tie-break as the group tables.
  thirds.sort(compareRows);
  thirds.forEach((r, i) => {
    outcomes[r.entryId] = i < BEST_THIRDS_THROUGH ? "bestThird" : "secondary";
  });

  return { outcomes, thirds };
}