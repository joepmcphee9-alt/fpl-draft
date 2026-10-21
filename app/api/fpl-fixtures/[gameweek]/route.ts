import { fplJson, fplError } from "@/lib/fpl";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameweek: string }> }
) {
  try {
    const { gameweek } = await params;
    const fixtures = await fplJson(`fixtures/?event=${gameweek}`);

    // Map each team to their match status this gameweek
    const statusByTeam: Record<number, "not_started" | "live" | "finished"> = {};
    fixtures.forEach((f: any) => {
      let status: "not_started" | "live" | "finished" = "not_started";
      if (f.finished_provisional) status = "finished";
      else if (f.started) status = "live";
      statusByTeam[f.team_h] = status;
      statusByTeam[f.team_a] = status;
    });

    return Response.json(statusByTeam);
  } catch (err) {
    return fplError(err);
  }
}