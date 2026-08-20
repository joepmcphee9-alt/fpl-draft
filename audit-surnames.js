// audit-surnames.js
// Usage: node audit-surnames.js
// Finds every surname shared by 2+ real FPL players, then checks every squad
// in the database for anyone with a shared surname — these are the ones at
// risk of having been silently matched to the wrong player.

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
  const positionNames = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };
  const teamById = Object.fromEntries(data.teams.map((t) => [t.id, t.name]));

  const playerById = {};
  const bySurname = {};
  data.elements.forEach((el) => {
    const info = {
      id: el.id,
      name: `${el.first_name} ${el.second_name}`,
      position: positionNames[el.element_type],
      team: teamById[el.team],
      surname: el.web_name.toLowerCase(),
    };
    playerById[el.id] = info;
    (bySurname[info.surname] ??= []).push(info);
  });

  const sharedSurnames = new Set(
    Object.entries(bySurname)
      .filter(([, players]) => players.length > 1)
      .map(([surname]) => surname)
  );

  console.log(`Found ${sharedSurnames.size} surnames shared by more than one player.`);

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

  const flagged = [];

  for (const entry of entries) {
    const managerName = entry.players?.name ?? "Unknown";
    const squadIds = squadsByEntry[entry.id] ?? [];

    for (const id of squadIds) {
      const info = playerById[id];
      if (!info) continue;
      if (sharedSurnames.has(info.surname)) {
        const alternatives = bySurname[info.surname].filter((p) => p.id !== id);
        flagged.push(
          `Division ${entry.division} — ${managerName}: currently has ${info.name} (${info.team}, ${info.position}) ` +
          `— surname "${info.surname}" also matches: ${alternatives.map((p) => `${p.name} (${p.team}, ${p.position})`).join(", ")}`
        );
      }
    }
  }

  console.log(`\n\n${flagged.length} squad entries have a shared surname — worth a manual check against what was actually drafted:\n`);
  flagged.forEach((f) => console.log(f + "\n"));

  fs.writeFileSync("surname_audit_report.txt", flagged.join("\n\n"));
  console.log("Also written to surname_audit_report.txt");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});