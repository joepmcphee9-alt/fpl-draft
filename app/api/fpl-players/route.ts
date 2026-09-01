export const dynamic = "force-dynamic";

export async function GET() {
  const res = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/");
  const data = await res.json();

  const positionNames: Record<number, string> = {
    1: "GK",
    2: "DEF",
    3: "MID",
    4: "FWD",
  };

  const players = data.elements.map((el: any) => ({
    id: el.id,
    name: el.web_name,
    position: positionNames[el.element_type] ?? "UNK",
    team: el.team,
  }));

  return Response.json(players);
}