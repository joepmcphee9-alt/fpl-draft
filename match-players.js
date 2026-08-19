// match-players.js
// Usage: node match-players.js draft_picks.csv matched_output.csv
//
// Reads a CSV with columns: division,manager,round,player
// Fetches the live FPL player list, matches each pick to an FPL player ID,
// and writes an output CSV with the match (or a REVIEW flag if uncertain).

const fs = require("fs");

function normalize(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9]/g, ""); // strip punctuation/spaces
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const cols = line.split(",");
    const row = {};
    headers.forEach((h, i) => (row[h.trim()] = (cols[i] || "").trim()));
    return row;
  });
}

async function main() {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    console.error("Usage: node match-players.js <input.csv> <output.csv>");
    process.exit(1);
  }

  console.log("Fetching live FPL player list...");
  const res = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/");
  const data = await res.json();
  const elements = data.elements; // all players
  const teams = data.teams; // all clubs
  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]));
  const teamByNormName = Object.fromEntries(
    teams.map((t) => [normalize(t.name), t])
  );
  // also index short names like ARS, MUN
  teams.forEach((t) => (teamByNormName[normalize(t.short_name)] = t));

  // Build lookup maps: normalized name -> array of matching players
  const byWebName = {};
  const bySecondName = {};
  const byFullName = {};

  for (const el of elements) {
    const web = normalize(el.web_name);
    const second = normalize(el.second_name);
    const full = normalize(el.first_name + el.second_name);

    (byWebName[web] ??= []).push(el);
    (bySecondName[second] ??= []).push(el);
    (byFullName[full] ??= []).push(el);
  }

  const picks = parseCsv(fs.readFileSync(inputPath, "utf8")).filter(
    (r) => r.player
  );

  const output = [];

  for (const pick of picks) {
    const rawName = pick.player.trim();
    const norm = normalize(rawName);

    // Check for "Team GK" style picks (e.g. "Arsenal GK", "City GKs")
    const gkMatch = rawName.match(/^(.+?)\s*GKs?$/i);
    if (gkMatch) {
      const teamGuess = normalize(gkMatch[1]);
      const team =
        teamByNormName[teamGuess] ||
        Object.values(teamByNormName).find((t) =>
          normalize(t.name).includes(teamGuess)
        );
      if (team) {
        const keepers = elements.filter(
          (el) => el.team === team.id && el.element_type === 1
        );
        keepers.forEach((k) => {
          output.push({
            ...pick,
            match_type: "TEAM_GK",
            fpl_id: k.id,
            matched_name: `${k.first_name} ${k.second_name}`,
            team: team.name,
          });
        });
        continue;
      } else {
        output.push({ ...pick, match_type: "REVIEW_NO_TEAM_MATCH", fpl_id: "", matched_name: "", team: "" });
        continue;
      }
    }

    // Try exact matches in order of specificity
    let candidates = byWebName[norm] || bySecondName[norm] || byFullName[norm];

    // Fallback: substring match on second_name
    if (!candidates || candidates.length === 0) {
      candidates = elements.filter((el) =>
        normalize(el.second_name).includes(norm) || norm.includes(normalize(el.second_name))
      );
    }

    if (!candidates || candidates.length === 0) {
      output.push({ ...pick, match_type: "REVIEW_NO_MATCH", fpl_id: "", matched_name: "", team: "" });
    } else if (candidates.length === 1) {
      const el = candidates[0];
      output.push({
        ...pick,
        match_type: "MATCHED",
        fpl_id: el.id,
        matched_name: `${el.first_name} ${el.second_name}`,
        team: teamById[el.team].name,
      });
    } else {
      // Ambiguous — list all candidates for manual review
      output.push({
        ...pick,
        match_type: "REVIEW_AMBIGUOUS",
        fpl_id: "",
        matched_name: candidates
          .map((el) => `${el.first_name} ${el.second_name} (${teamById[el.team].name}, id=${el.id})`)
          .join(" | "),
        team: "",
      });
    }
  }

  const header = "division,manager,round,player,match_type,fpl_id,matched_name,team";
  const csvLines = [header, ...output.map((r) =>
    [r.division, r.manager, r.round, r.player, r.match_type, r.fpl_id, r.matched_name, r.team]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  )];

  fs.writeFileSync(outputPath, csvLines.join("\n"));

  const reviewCount = output.filter((r) => r.match_type.startsWith("REVIEW")).length;
  console.log(`Done. ${output.length} rows written to ${outputPath}.`);
  console.log(`${reviewCount} rows need manual review (flagged in match_type column).`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});