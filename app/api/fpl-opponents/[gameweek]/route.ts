import { fplJson, fplError } from "@/lib/fpl";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameweek: string }> }
) {
  try {
    const { gameweek } = await params;

    const [bootstrapData, fixturesData] = await Promise.all([
      fplJson("bootstrap-static/"),
      fplJson(`fixtures/?event=${gameweek}`),
    ]);

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
  } catch (err) {
    return fplError(err);
  }
}