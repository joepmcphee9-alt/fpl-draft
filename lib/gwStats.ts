import { supabase } from "@/lib/supabaseClient";
import { firstKickoffs, fplJson } from "@/lib/fpl";
import { DIVISIONS, DIVISION_NAMES, computeStandings, loadLeagueData } from "@/lib/leagueTable";
import { gameweekMonthsFromEvents, getMonthTotals } from "@/lib/mom";
import { assignOutcomes, buildStandings, getCupFixtures } from "@/lib/michuCup";

// Plain-text fact sheet for one gameweek: everything a round-up writer needs,
// pulled together automatically. Read by people, by Claude when drafting the
// weekly update, and by NotebookLM for an audio version.

type Live = {
  points: number;
  minutes: number;
  goals: number;
  assists: number;
  cleanSheet: boolean;
  saves: number;
  bonus: number;
  yellow: number;
  red: number;
  ownGoals: number;
  penMissed: number;
  penSaved: number;
};

type PlayerLine = { id: number; name: string; club: string; pos: string; day: string; live: Live };

type TeamWeek = {
  entryId: string;
  manager: string;
  division: number;
  score: number | null;
  xi: PlayerLine[];
  bench: PlayerLine[]; // bench players who weren't used
  subs: { out: PlayerLine; in: PlayerLine }[];
  blanks: PlayerLine[]; // starters who didn't play and couldn't be replaced
  captain: PlayerLine | null; // the player who was actually doubled
  namedCaptain: PlayerLine | null;
  captainSwapped: boolean; // vice took the armband
  bestPlayer: PlayerLine | null;
  bestCaptainOption: PlayerLine | null;
  benchPoints: number;
};

const POS: Record<number, string> = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };

function contributions(p: PlayerLine): string {
  const l = p.live;
  const bits: string[] = [];
  if (l.goals) bits.push(l.goals === 1 ? "goal" : `${l.goals} goals`);
  if (l.assists) bits.push(l.assists === 1 ? "assist" : `${l.assists} assists`);
  if (l.cleanSheet && (p.pos === "GK" || p.pos === "DEF")) bits.push("clean sheet");
  if (l.penSaved) bits.push("penalty save");
  if (l.saves >= 5) bits.push(`${l.saves} saves`);
  if (l.bonus) bits.push(`${l.bonus} bonus`);
  if (l.red) bits.push("RED CARD");
  if (l.ownGoals) bits.push("own goal");
  if (l.penMissed) bits.push("missed penalty");
  if (l.minutes === 0) bits.push("didn't play");
  return bits.length ? ` (${bits.join(", ")})` : "";
}

const pl = (p: PlayerLine | null | undefined) => (p ? `${p.name} ${p.live.points}` : "—");

export async function buildGwStats(gameweek: number): Promise<string> {
  const [bootstrap, live, fplFixtures, league, cup, lineupsRes, scoresRes] = await Promise.all([
    fplJson("bootstrap-static/"),
    fplJson(`event/${gameweek}/live/`),
    fplJson(`fixtures/?event=${gameweek}`),
    loadLeagueData(),
    getCupFixtures(),
    supabase
      .from("lineups")
      .select("entry_id, starting_xi, captain_id, vice_captain_id, bench_order")
      .eq("gameweek", gameweek),
    supabase.from("entry_scores").select("entry_id, points, applied_subs").eq("gameweek", gameweek),
  ]);

  // ---- FPL lookups ----
  const clubName: Record<number, string> = {};
  bootstrap.teams.forEach((t: any) => (clubName[t.id] = t.short_name));

  // Day of the week each club played (latest match if they had two)
  const clubDay: Record<number, string> = {};
  const clubKickoff: Record<number, number> = {};
  fplFixtures.forEach((f: any) => {
    if (!f.kickoff_time) return;
    const t = new Date(f.kickoff_time).getTime();
    const day = new Date(f.kickoff_time).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short" });
    [f.team_h, f.team_a].forEach((club: number) => {
      if (!clubKickoff[club] || t > clubKickoff[club]) {
        clubKickoff[club] = t;
        clubDay[club] = day;
      }
    });
  });
  const lastKickoff = Math.max(0, ...Object.values(clubKickoff));
  const lastDay = lastKickoff
    ? new Date(lastKickoff).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "long" })
    : "";

  const liveById: Record<number, Live> = {};
  live.elements.forEach((el: any) => {
    const s = el.stats;
    liveById[el.id] = {
      points: s.total_points,
      minutes: s.minutes,
      goals: s.goals_scored ?? 0,
      assists: s.assists ?? 0,
      cleanSheet: (s.clean_sheets ?? 0) > 0,
      saves: s.saves ?? 0,
      bonus: s.bonus ?? 0,
      yellow: s.yellow_cards ?? 0,
      red: s.red_cards ?? 0,
      ownGoals: s.own_goals ?? 0,
      penMissed: s.penalties_missed ?? 0,
      penSaved: s.penalties_saved ?? 0,
    };
  });
  const blankLive: Live = {
    points: 0, minutes: 0, goals: 0, assists: 0, cleanSheet: false, saves: 0, bonus: 0,
    yellow: 0, red: 0, ownGoals: 0, penMissed: 0, penSaved: 0,
  };
  const elementById: Record<number, any> = {};
  bootstrap.elements.forEach((el: any) => (elementById[el.id] = el));
  const player = (id: number | null | undefined): PlayerLine | null => {
    if (id == null) return null;
    const el = elementById[id];
    return {
      id,
      name: el?.web_name ?? `player ${id}`,
      club: el ? clubName[el.team] ?? "" : "",
      pos: el ? POS[el.element_type] ?? "" : "",
      day: el ? clubDay[el.team] ?? "" : "",
      live: liveById[id] ?? blankLive,
    };
  };

  // ---- Each manager's week ----
  const nameOf: Record<string, string> = {};
  const divisionOf: Record<string, number> = {};
  league.entries.forEach((e) => {
    nameOf[e.id] = e.name;
    divisionOf[e.id] = e.division;
  });
  const scoreRow: Record<string, { points: number; applied_subs: { out: number; in: number }[] | null }> = {};
  (scoresRes.data ?? []).forEach((s: any) => (scoreRow[s.entry_id] = s));

  const teams: Record<string, TeamWeek> = {};
  (lineupsRes.data ?? []).forEach((lu: any) => {
    if (!nameOf[lu.entry_id]) return; // skip memorial entry
    const subs: { out: number; in: number }[] = scoreRow[lu.entry_id]?.applied_subs ?? [];
    const xiIds: number[] = (lu.starting_xi ?? []).map((id: number) => subs.find((s) => s.out === id)?.in ?? id);
    const usedBench = new Set(subs.map((s) => s.in));
    const xi = xiIds.map((id) => player(id)!).filter(Boolean);
    const bench: PlayerLine[] = (lu.bench_order ?? [])
      .filter((id: number | null) => id && !usedBench.has(id))
      .map((id: number) => player(id)!);

    const namedCaptain = player(lu.captain_id);
    const captainDidNotPlay = !!namedCaptain && namedCaptain.live.minutes === 0;
    const captainId = captainDidNotPlay ? lu.vice_captain_id : lu.captain_id;
    const captain = xi.find((p) => p.id === captainId) ?? null;

    // Only players picked to start could have worn the armband
    const played = (lu.starting_xi ?? []).map((id: number) => player(id)!).filter((p: PlayerLine) => p.live.minutes > 0);    const bestPlayer = [...xi].sort((a, b) => b.live.points - a.live.points)[0] ?? null;
    const bestCaptainOption = [...played].sort((a, b) => b.live.points - a.live.points)[0] ?? null;

    teams[lu.entry_id] = {
      entryId: lu.entry_id,
      manager: nameOf[lu.entry_id],
      division: divisionOf[lu.entry_id],
      score: scoreRow[lu.entry_id]?.points ?? null,
      xi,
      bench,
      subs: subs.map((s) => ({ out: player(s.out)!, in: player(s.in)! })),
      blanks: xi.filter((p) => p.live.minutes === 0),
      captain,
      namedCaptain,
      captainSwapped: captainDidNotPlay && !!captain,
      bestPlayer,
      bestCaptainOption,
      benchPoints: bench.reduce((sum, p) => sum + p.live.points, 0),
    };
  });

  const out: string[] = [];
  const say = (s = "") => out.push(s);

  const teamDetail = (t: TeamWeek | undefined, opponentScore: number | null) => {
    if (!t) return ["  (no lineup found)"];
    const lines: string[] = [];
    const top = [...t.xi].sort((a, b) => b.live.points - a.live.points).slice(0, 3);
    lines.push(`  ${t.manager} ${t.score ?? "?"}`);
    lines.push(`    Top players: ${top.map((p) => `${p.name} (${p.club}, ${p.day}) ${p.live.points}${contributions(p)}`).join("; ")}`);
    if (t.captain) {
      lines.push(
        t.captainSwapped
          ? `    Captain: ${t.namedCaptain?.name} didn't play, so vice-captain ${t.captain.name} was doubled: ${t.captain.live.points} → ${t.captain.live.points * 2}`
          : `    Captain: ${t.captain.name} ${t.captain.live.points} → ${t.captain.live.points * 2}${contributions(t.captain)}`
      );
    } else if (t.namedCaptain) {
      lines.push(`    Captain: ${t.namedCaptain.name} didn't play and nobody was doubled`);
    }
    if (t.captain && t.bestCaptainOption && t.bestCaptainOption.live.points > t.captain.live.points && t.score != null && opponentScore != null) {
      const gain = t.bestCaptainOption.live.points - t.captain.live.points;
      const alt = t.score + gain;
      const now = t.score > opponentScore ? "W" : t.score < opponentScore ? "L" : "D";
      const then = alt > opponentScore ? "W" : alt < opponentScore ? "L" : "D";
      if (now !== then) {
        const word = { W: "won", D: "drawn", L: "lost" }[then];
        lines.push(`    What if: captaining ${t.bestCaptainOption.name} instead would have made it ${alt} and they'd have ${word}`);
      }
    }
    if (t.subs.length) lines.push(`    Auto-subs: ${t.subs.map((s) => `${s.in.name} (${s.in.live.points}) on for ${s.out.name}`).join("; ")}`);
    if (t.blanks.length) lines.push(`    Starters who didn't play (no sub possible): ${t.blanks.map((p) => p.name).join(", ")}`);
    const notable = t.xi.filter((p) => p.live.red || p.live.ownGoals || p.live.penMissed || p.live.points < 0);
    if (notable.length) lines.push(`    Disasters: ${notable.map((p) => `${p.name} ${p.live.points}${contributions(p)}`).join("; ")}`);
    if (t.bench.length) {
      const bestBench = [...t.bench].sort((a, b) => b.live.points - a.live.points)[0];
      lines.push(`    Left on the bench: ${t.benchPoints} pts${bestBench && bestBench.live.points >= 5 ? ` (incl. ${bestBench.name} ${bestBench.live.points})` : ""}`);
    }
    return lines;
  };

  // ---- Header ----
  const event = bootstrap.events.find((e: any) => e.id === gameweek);
  say(`GAMEWEEK ${gameweek} FACT SHEET — FPL Draft League`);
  say(`Last match of the gameweek: ${lastDay}. "Day" next to each player is when their club played.`);
  if (event?.most_captained) {
    const mc = player(event.most_captained);
    if (mc) say(`Most-captained player in real FPL this week: ${mc.name} (${mc.live.points} pts).`);
  }
  say();

  // ---- League results ----
  const after = computeStandings(league, (gw) => gw <= gameweek);
  const before = gameweek > 1 ? computeStandings(league, (gw) => gw <= gameweek - 1) : null;

  DIVISIONS.forEach((div) => {
    say(`=== ${DIVISION_NAMES[div].toUpperCase()} ===`);
    const fixtures = league.fixtures.filter((f) => f.division === div && f.gameweek === gameweek);
    const results: { home: string; away: string; hs: number; as: number; margin: number }[] = [];

    fixtures.forEach((f) => {
      const home = teams[f.home_entry_id];
      if (f.is_bye || !f.away_entry_id) {
        say();
        say(`${nameOf[f.home_entry_id]} — BYE (scored ${home?.score ?? "?"}, doesn't count)`);
        teamDetail(home, null).slice(1).forEach((l) => say(l));
        return;
      }
      const away = teams[f.away_entry_id];
      const hs = home?.score ?? null;
      const as = away?.score ?? null;
      say();
      say(`${nameOf[f.home_entry_id]} ${hs ?? "?"} - ${as ?? "?"} ${nameOf[f.away_entry_id]}`);
      if (hs != null && as != null) {
        results.push({ home: nameOf[f.home_entry_id], away: nameOf[f.away_entry_id], hs, as, margin: Math.abs(hs - as) });
        say(hs === as ? "  Result: draw" : `  Result: ${hs > as ? nameOf[f.home_entry_id] : nameOf[f.away_entry_id]} win by ${Math.abs(hs - as)}`);
      }
      teamDetail(home, as).forEach((l) => say(l));
      teamDetail(away, hs).forEach((l) => say(l));
    });

    // Division highlights
    const divTeams = Object.values(teams).filter((t) => t.division === div && t.score != null);
    say();
    say(`-- ${DIVISION_NAMES[div]} highlights --`);
    if (results.length) {
      const sortedByMargin = [...results].sort((a, b) => b.margin - a.margin);
      const fmt = (r: (typeof results)[number]) => `${r.home} ${r.hs} - ${r.as} ${r.away}`;
      say(`Biggest win: ${fmt(sortedByMargin[0])} (by ${sortedByMargin[0].margin})`);
      const closest = sortedByMargin[sortedByMargin.length - 1];
      say(`Closest game: ${fmt(closest)} (${closest.margin === 0 ? "a draw" : `by ${closest.margin}`})`);
    }
    if (divTeams.length) {
      const byScore = [...divTeams].sort((a, b) => b.score! - a.score!);
      say(`Highest score: ${byScore[0].manager} ${byScore[0].score}. Lowest: ${byScore[byScore.length - 1].manager} ${byScore[byScore.length - 1].score}`);
      const caps = divTeams.filter((t) => t.captain).sort((a, b) => b.captain!.live.points - a.captain!.live.points);
      if (caps.length) {
        say(`Best captain: ${caps[0].manager} with ${caps[0].captain!.name} (${caps[0].captain!.live.points * 2})`);
        const worst = caps[caps.length - 1];
        say(`Worst captain: ${worst.manager} with ${worst.captain!.name} (${worst.captain!.live.points * 2})`);
      }
      const bench = [...divTeams].sort((a, b) => b.benchPoints - a.benchPoints)[0];
      if (bench && bench.benchPoints > 0) say(`Most points left on the bench: ${bench.manager} (${bench.benchPoints})`);
      const bestPlayers = divTeams
        .filter((t) => t.bestPlayer)
        .sort((a, b) => b.bestPlayer!.live.points - a.bestPlayer!.live.points);
      if (bestPlayers.length)
        say(`Best individual player: ${pl(bestPlayers[0].bestPlayer)} for ${bestPlayers[0].manager}${contributions(bestPlayers[0].bestPlayer!)}`);
    }

    // Table
    const prevPos: Record<string, number> = {};
    (before?.[div] ?? []).forEach((r, i) => (prevPos[r.entryId] = i + 1));
    say();
    say(`-- Table after Gameweek ${gameweek} --`);
    (after[div] ?? []).forEach((r, i) => {
      const moved = before ? prevPos[r.entryId] - (i + 1) : 0;
      const mv = !before ? "" : moved > 0 ? ` (up ${moved})` : moved < 0 ? ` (down ${-moved})` : " (no change)";
      say(`${i + 1}. ${r.managerName} — ${r.leaguePts} pts, W${r.w} D${r.d} L${r.l}, ${r.ptsFor} points for${r.penalties ? `, ${r.penalties} penalty pts` : ""}${mv}`);
    });
    const leaderNow = after[div]?.[0];
    const leaderBefore = before?.[div]?.[0];
    if (leaderNow && leaderBefore && leaderNow.entryId !== leaderBefore.entryId) say(`NEW LEADER: ${leaderNow.managerName} (was ${leaderBefore.managerName})`);

    // Streaks and records
    const entryIds = (after[div] ?? []).map((r) => r.entryId);
    const streaks: string[] = [];
    entryIds.forEach((id) => {
      const games = league.fixtures
        .filter((f) => f.gameweek <= gameweek && !f.is_bye && f.away_entry_id && (f.home_entry_id === id || f.away_entry_id === id))
        .sort((a, b) => b.gameweek - a.gameweek)
        .map((f) => {
          const mine = league.scores[`${id}:${f.gameweek}`];
          const theirs = league.scores[`${f.home_entry_id === id ? f.away_entry_id : f.home_entry_id}:${f.gameweek}`];
          if (mine == null || theirs == null) return null;
          return mine > theirs ? "W" : mine < theirs ? "L" : "D";
        })
        .filter(Boolean) as string[];
      if (!games.length) return;
      let run = 1;
      while (run < games.length && games[run] === games[0]) run++;
      const name = nameOf[id];
      if (run >= 3) streaks.push(`${name}: ${run} ${games[0] === "W" ? "wins" : games[0] === "L" ? "defeats" : "draws"} in a row`);
      if (!games.includes("W")) streaks.push(`${name}: still looking for a first win`);
      if (!games.includes("L") && games.length >= 3) streaks.push(`${name}: unbeaten`);
    });
    if (streaks.length) say(`Streaks: ${streaks.join("; ")}`);
    say();
  });

  // ---- Michu Cup ----
  const cupThisWeek = cup.fixtures.filter((f) => f.gameweek === gameweek && f.away);
  if (cupThisWeek.length) {
    say("=== MICHU CUP (group stage) ===");
    const groups = Array.from(new Set(cupThisWeek.map((f) => f.group))).sort((a, b) => a - b);
    const standings = buildStandings(
      cup.fixtures.filter((f) => f.gameweek <= gameweek),
      cup.penalties.filter((p) => p.gameweek <= gameweek)
    );
    const { outcomes } = assignOutcomes(standings);
    const outcomeWord = { through: "through", bestThird: "through as a best third", secondary: "secondary competition", out: "out" };
    groups.forEach((g) => {
      say(`Group ${g}:`);
      cupThisWeek
        .filter((f) => f.group === g)
        .forEach((f) => say(`  ${f.home.name} ${f.home.score ?? "?"} - ${f.away!.score ?? "?"} ${f.away!.name}`));
      const rows = standings[g] ?? [];
      say(`  Group as it stands: ${rows.map((r, i) => `${i + 1}. ${r.name} ${r.pts}pts (${outcomeWord[outcomes[r.entryId]]})`).join(", ")}`);
    });
    const cupGws = Array.from(new Set(cup.fixtures.map((f) => f.gameweek)));
    const left = cupGws.filter((gw) => gw > gameweek).length;
    say(left ? `Group stage: ${left} gameweek${left === 1 ? "" : "s"} left (Group 3 finishes earlier).` : "That was the last round of the group stage.");
    say();
  }

  // ---- Manager of the Month ----
  const months = gameweekMonthsFromEvents(bootstrap.events);
  const thisMonth = months.find((m) => m.gameweek === gameweek);
  if (thisMonth) {
    const monthGws = months.filter((m) => m.monthKey === thisMonth.monthKey).map((m) => m.gameweek);
    const counted = monthGws.filter((gw) => gw <= gameweek);
    const isFinal = gameweek === Math.max(...monthGws);
    const isPenultimate = !isFinal && gameweek + 1 === Math.max(...monthGws);
    const totals = await getMonthTotals(counted);
    say(`=== MANAGER OF THE MONTH — ${thisMonth.monthLabel} ===`);
    say(isFinal ? "This was the final week of the month — the winners are decided." : `After ${counted.length} of ${monthGws.length} gameweeks.${isPenultimate ? " Next gameweek is the final week of the month." : ""}`);
    DIVISIONS.forEach((div) => {
      const sorted = totals.filter((t) => t.division === div).sort((a, b) => b.total - a.total);
      const lead = sorted[0] && sorted[1] ? sorted[0].total - sorted[1].total : 0;
      say(
        `${DIVISION_NAMES[div]}: ${sorted.slice(0, 5).map((t, i) => `${i + 1}. ${t.managerName} ${t.total}`).join(", ")}` +
          (sorted[0] ? (isFinal ? ` — WINNER: ${sorted[0].managerName}` : ` — leader ahead by ${lead}`) : "")
      );
    });
    say();
  }

  // ---- What's next ----
  const next = bootstrap.events.find((e: any) => e.id === gameweek + 1);
  if (next) {
    // League deadline = first kick-off of the gameweek (FPL's deadline is earlier)
    const kickoffs = await firstKickoffs();
    const nextDeadline = new Date(kickoffs[gameweek + 1] ?? next.deadline_time);
    const gapDays = event ? (nextDeadline.getTime() - new Date(event.deadline_time).getTime()) / 86400000 : 0;
    say("=== NEXT UP ===");
    say(
      `Gameweek ${gameweek + 1} deadline: ${nextDeadline.toLocaleString("en-GB", {
        timeZone: "Europe/London",
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "numeric",
        minute: "2-digit",
      })}${gapDays > 10 ? " — there's an international break first" : ""}`
    );
  }

  return out.join("\n");
}
