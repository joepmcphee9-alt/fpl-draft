import { cachedFpl, fplError, fplJson } from "@/lib/fpl";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameweek: string }> }
) {
  try {
    const { gameweek } = await params;
    const statusByTeam = await cachedFpl(`fixture-status-${gameweek}`, 60, async () => {
      const fixtures = await fplJson(`fixtures/?event=${gameweek}`);

      // Map each team to their match status this gameweek
      const status: Record<number, "not_started" | "live" | "finished"> = {};
      fixtures.forEach((f: any) => {
        let s: "not_started" | "live" | "finished" = "not_started";
        if (f.finished_provisional) s = "finished";
        else if (f.started) s = "live";
        status[f.team_h] = s;
        status[f.team_a] = s;
      });
      return status;
    });

    return Response.json(statusByTeam);
  } catch (err) {
    return fplError(err);
  }
}
