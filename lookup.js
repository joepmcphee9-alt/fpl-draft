// lookup.js
// Usage: node lookup.js kadioglu
// Prints any player whose name loosely contains the search term, with their real FPL id.

async function main() {
  const term = process.argv[2];
  if (!term) {
    console.error("Usage: node lookup.js <search term>");
    process.exit(1);
  }

  const res = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/");
  const data = await res.json();
  const teamById = Object.fromEntries(data.teams.map((t) => [t.id, t.name]));

  const search = term.toLowerCase();
  const matches = data.elements.filter((el) =>
    (el.first_name + el.second_name + el.web_name)
      .toLowerCase()
      .includes(search)
  );

  if (matches.length === 0) {
    console.log("No matches found.");
  } else {
    matches.forEach((el) => {
      console.log(
        `id=${el.id}  ${el.first_name} ${el.second_name}  (${teamById[el.team]})  web_name="${el.web_name}"`
      );
    });
  }
}

main();