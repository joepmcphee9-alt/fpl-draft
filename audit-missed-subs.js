// audit-missed-subs.js
// Usage: node audit-missed-subs.js
// Independently re-checks every lineup for the current gameweek: for any
// starter who genuinely failed to play (their team's match finished, 0
// minutes), confirms whether they were correctly substituted. Flags any
// mismatch between what SHOULD have happened and what's actually stored.

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const envFile = fs.readFileSync(".env.local", "utf8");
const supabaseUrl = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

const POSITION_NAMES = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };
const VALID_FORMATIONS = ["3-4-3", "3-5-2", "4-4-2", "4-3-3", "4-5-1", "5-4-1", "5-3-2", "5-2-3"];

function formationString(xi, playerInfoById) {
  const counts = { DEF: 0, MID: 0, FWD: 0 };
  xi.forEach((id) => {
    const pos = playerInfoById[id] ? playerInfoById[id].position : null;
    if (pos && counts[pos] !== undefined) counts[pos]++;
  });
  return `${counts.DEF}-${counts.MID}-${counts.FWD}`;
}

async function main() {
  console.log("Fetching live FPL data...");
  const [bootstrapRes, entriesRes] = await Promise.all([
    fetch("https://fantasy.premierleague.com/api/bootstrap-static/"),
    supabase.from("entries").select("id, division, players(name)"),
  ]);
  const bootstrapData = await bootstrapRes.json();
  const playerInfoById = {};
  bootstrapData.elements.forEach((el) => {
    playerInfoById[el.id] = { position: POSITION_NAMES[el.element_type], team: el.team };
  });

  const { data: settings } = await supabase.from("league_settings").select("current_gameweek").maybeSingle();
  const gameweek = settings.current_gameweek;

  const liveRes = await fetch(`https://fantasy.premierleague.com/api/event/${gameweek}/live/`);
  const liveData = await liveRes.json();
  const statsById = {};
  liveData.elements.forEach((el) => {
    statsById[el.id] = { points: el.stats.total_points, minutes: el.stats.minutes };
  });

  const fixturesRes = await fetch(`https://fantasy.premierleague.com/api/fixtures/?event=${gameweek}`);
  const fixturesData = await fixturesRes.json();
  const teamFinished = {};
  fixturesData.forEach((f) => {
    teamFinished[f.team_h] = f.finished_provisional === true;
    teamFinished[f.team_a] = f.finished_provisional === true;
  });

  const didNotPlay = (id) => {
    const stats = statsById[id];
    const info = playerInfoById[id];
    if (!stats || !info) return false;
    return stats.minutes === 0 && teamFinished[info.team] === true;
  };

  const { data: entries } = entriesRes;
  const entryById = {};
  (entries ?? []).forEach((e) => (entryById[e.id] = e));

  const { data: lineups } = await supabase
    .from("lineups")
    .select("entry_id, starting_xi, bench_order")
    .eq("gameweek", gameweek);

  const { data: scores } = await supabase
    .from("entry_scores")
    .select("entry_id, applied_subs")
    .eq("gameweek", gameweek);
  const appliedSubsByEntry = {};
  (scores ?? []).forEach((s) => (appliedSubsByEntry[s.entry_id] = s.applied_subs || []));

  const issues = [];

  (lineups ?? []).forEach((lineup) => {
    const entry = entryById[lineup.entry_id];
    const managerName = entry?.players?.name ?? "Unknown";
    const division = entry?.division ?? "?";

    const actualSubs = appliedSubsByEntry[lineup.entry_id] || [];
    const actualOutIds = new Set(actualSubs.map((s) => s.out));

    (lineup.starting_xi || []).forEach((id) => {
      if (!didNotPlay(id)) return;

      if (actualOutIds.has(id)) return;

      const failedInfo = playerInfoById[id];
      const bench = (lineup.bench_order || []).filter((b) => b);
      let foundLegalReplacement = null;

      for (const candidateId of bench) {
        const candidateInfo = playerInfoById[candidateId];
        if (!candidateInfo) continue;
        if (failedInfo.position === "GK" && candidateInfo.position !== "GK") continue;
        if (failedInfo.position !== "GK" && candidateInfo.position === "GK") continue;
        if (didNotPlay(candidateId)) continue;

        const hypotheticalXi = lineup.starting_xi.map((x) => (x === id ? candidateId : x));
        const gkCount = hypotheticalXi.filter((x) => playerInfoById[x]?.position === "GK").length;
        if (gkCount === 1 && VALID_FORMATIONS.includes(formationString(hypotheticalXi, playerInfoById))) {
          foundLegalReplacement = candidateId;
          break;
        }
      }

      if (foundLegalReplacement) {
        issues.push(
          `Division ${division} — ${managerName}: player id ${id} failed to play and a legal replacement (id ${foundLegalReplacement}) EXISTS on the bench, but no substitution was applied. This looks like a real bug — worth re-running scoreCurrentGameweek() and checking again.`
        );
      } else {
        issues.push(
          `Division ${division} — ${managerName}: player id ${id} failed to play, but no legal bench replacement is currently available (correct — nothing to fix here, though worth confirming this makes sense for their specific bench).`
        );
      }
    });
  });

  console.log(`\n${issues.length} situations found:\n`);
  issues.forEach((i) => console.log(i + "\n"));

  if (issues.length === 0) {
    console.log("No missed-substitution situations found — everyone who should have been subbed, was.");
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});