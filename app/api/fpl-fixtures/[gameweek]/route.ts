export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameweek: string }> }
) {
  const { gameweek } = await params;
  const res = await fetch(`https://fantasy.premierleague.com/api/fixtures/?event=${gameweek}`);
  const fixtures = await res.json();

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
}