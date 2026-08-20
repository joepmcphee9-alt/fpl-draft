// audit-squads.js
// Usage: node audit-squads.js
// Cross-checks every squad against live FPL data: flags anyone with 0 GKs,
// and prints every squad grouped by real position for manual review.

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

// Reads the same values you already have in .env.local
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
  const playerById = Object.fromEntries(
    data.elements.map((el) => [
      el.id,
      {
        name: `${el.first_name} ${el.second_name}`,
        position: positionNames[el.element_type],
        team: teamById[el.team],
      },
    ])
  );

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
  const report = [];

  for (const entry of entries) {
    const managerName = entry.players?.name ?? "Unknown";
    const squadIds = squadsByEntry[entry.id] ?? [];
    const squadDetails = squadIds.map((id) => playerById[id] ?? { name: `Unknown id ${id}`, position: "??", team: "??" });

    const gkCount = squadDetails.filter((p) => p.position === "GK").length;
    if (gkCount === 0) {
      flagged.push(`Division ${entry.division} — ${managerName}: NO GOALKEEPERS`);
    }

    report.push(`\n=== Division ${entry.division} — ${managerName} (${squadDetails.length} players) ===`);
    ["GK", "DEF", "MID", "FWD"].forEach((pos) => {
      const inPos = squadDetails.filter((p) => p.position === pos);
      if (inPos.length > 0) {
        report.push(`${pos}: ${inPos.map((p) => `${p.name} (${p.team})`).join(", ")}`);
      }
    });
  }

  console.log("\n\n################ FLAGGED ISSUES ################");
  if (flagged.length === 0) {
    console.log("None found — every squad has at least one goalkeeper.");
  } else {
    flagged.forEach((f) => console.log(f));
  }

  fs.writeFileSync("squad_audit_report.txt", report.join("\n"));
  console.log("\nFull squad-by-squad report written to squad_audit_report.txt — open it and scan each squad for anything that looks wrong (wrong club, wrong position, unfamiliar name).");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});