export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameweek: string }> }
) {
  const { gameweek } = await params;
  const res = await fetch(`https://fantasy.premierleague.com/api/fixtures/?event=${gameweek}`);
  const data = await res.json();
  return Response.json(data);
}