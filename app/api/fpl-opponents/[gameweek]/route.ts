export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameweek: string }> }
) {
  const { gameweek } = await params;

  const [bootstrapRes, fixturesRes] = await Promise.all([
    fetch("https://fantasy.premierleague.com/api/bootstrap-static/"),
    fetch(`https://fantasy.premierleague.com/api/fixtures/?event=${gameweek}`),
  ]);
  const bootstrapData = await bootstrapRes.json();
  const fixturesData = await fixturesRes.json();

  const teamNameById: Record<number, string> = {};
  bootstrapData.teams.forEach((t: any) => {
    teamNameById[t.id] = t.short_name;
  });

  // For each team, work out their opponent and whether they're home or away
  const opponentByTeam: Record<number, { opponent: string; isHome: boolean }> = {};
  fixturesData.forEach((f: any) => {
    opponentByTeam[f.team_h] = { opponent: teamNameById[f.team_a] ?? "TBC", isHome: true };
    opponentByTeam[f.team_a] = { opponent: teamNameById[f.team_h] ?? "TBC", isHome: false };
  });

  return Response.json(opponentByTeam);
}