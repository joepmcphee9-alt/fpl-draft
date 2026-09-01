export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameweek: string }> }
) {
  const { gameweek } = await params;
  const res = await fetch(`https://fantasy.premierleague.com/api/event/${gameweek}/live/`);
  const data = await res.json();

  const map: Record<number, { points: number; minutes: number }> = {};
  data.elements.forEach((el: any) => {
    map[el.id] = { points: el.stats.total_points, minutes: el.stats.minutes };
  });

  return Response.json(map);
}