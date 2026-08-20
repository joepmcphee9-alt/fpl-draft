// backfill-keepers.js
// Usage: node backfill-keepers.js
// For every squad, finds which club(s) they have a goalkeeper from, and
// checks whether they have ALL of that club's keepers (per the league rule
// that drafting a keeper gives you the whole club's keepers). Writes any
// missing ones to backfill_keepers.sql for review before running.

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const envFile = fs.readFileSync(".env.local", "utf8");
const supabaseUrl = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Fetching live FPL player list...");
  const res = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/");
  const data = await res.json();
  const teamById = Object.fromEntries(data.teams.map((t) => [t.id, t.name]));

  const keepersByTeam = {}; // teamId -> [player ids]
  const playerById = {};
  data.elements.forEach((el) => {
    playerById[el.id] = { name: `${el.first_name} ${el.second_name}`, team: el.team, isGk: el.element_type === 1 };
    if (el.element_type === 1) {
      (keepersByTeam[el.team] ??= []).push(el.id);
    }
  });

  console.log("Fetching all squads from Supabase...");
  const { data: entries } = await supabase
    .from("entries")
    .select("id, division, players(name)")
    .order("division", { ascending: true });

  const { data: squadRows } = await supabase.from("squad_players").select("entry_id, fpl_player_id");

  const squadsByEntry = {};
  squadRows.forEach((row) => {
    (squadsByEntry[row.entry_id] ??= []).push(row.fpl_player_id);
  });

  const toAdd = []; // { entryId, managerName, division, fplPlayerId, playerName, team }
  const summary = [];

  for (const entry of entries) {
    const managerName = entry.players?.name ?? "Unknown";
    const squadIds = new Set(squadsByEntry[entry.id] ?? []);
    const currentKeeperTeams = new Set();
    squadIds.forEach((id) => {
      if (playerById[id]?.isGk) currentKeeperTeams.add(playerById[id].team);
    });

    currentKeeperTeams.forEach((teamId) => {
      const fullList = keepersByTeam[teamId] ?? [];
      const missing = fullList.filter((id) => !squadIds.has(id));
      if (missing.length > 0) {
        summary.push(
          `Division ${entry.division} — ${managerName}: missing ${missing.length} keeper(s) from ${teamById[teamId]} — ${missing.map((id) => playerById[id].name).join(", ")}`
        );
        missing.forEach((id) => {
          toAdd.push({ entryId: entry.id, fplPlayerId: id });
        });
      }
    });
  }

  console.log(`\n${summary.length} squads missing club-mate keepers:\n`);
  summary.forEach((s) => console.log(s));

  if (toAdd.length === 0) {
    console.log("\nNothing to add — every squad already has all keepers for their drafted club(s).");
    return;
  }

  const values = toAdd.map((r) => `('${r.entryId}', ${r.fplPlayerId})`).join(",\n  ");
  const sql = `insert into squad_players (entry_id, fpl_player_id)\nvalues\n  ${values}\non conflict (entry_id, fpl_player_id) do nothing;\n`;

  fs.writeFileSync("backfill_keepers.sql", sql);
  console.log(`\n${toAdd.length} rows written to backfill_keepers.sql — review it, then run it in Supabase's SQL editor.`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});