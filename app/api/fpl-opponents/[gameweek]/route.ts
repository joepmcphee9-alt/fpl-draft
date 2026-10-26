import { cachedFpl, fplError, fplJson } from "@/lib/fpl";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameweek: string }> }
) {
  try {
    const { gameweek } = await params;

    const opponentByTeam = await cachedFpl(`opponents-${gameweek}`, 3600, async () => {
      const [bootstrapData, fixturesData] = await Promise.all([
        fplJson("bootstrap-static/"),
        fplJson(`fixtures/?event=${gameweek}`),
      ]);

      const teamNameById: Record<number, string> = {};
      bootstrapData.teams.forEach((t: any) => {
        teamNameById[t.id] = t.short_name;
      });

      // For each team, work out their opponent and whether they're home or away
      const opponents: Record<number, { opponent: string; isHome: boolean }> = {};
      fixturesData.forEach((f: any) => {
        opponents[f.team_h] = { opponent: teamNameById[f.team_a] ?? "TBC", isHome: true };
        opponents[f.team_a] = { opponent: teamNameById[f.team_h] ?? "TBC", isHome: false };
      });
      return opponents;
    });

    return Response.json(opponentByTeam);
  } catch (err) {
    return fplError(err);
  }
}
