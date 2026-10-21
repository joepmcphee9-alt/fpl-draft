import { fplJson, fplError } from "@/lib/fpl";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameweek: string }> }
) {
  try {
    const { gameweek } = await params;
    const data = await fplJson(`event/${gameweek}/live/`);

    const map: Record<number, { points: number; minutes: number }> = {};
    data.elements.forEach((el: any) => {
      map[el.id] = { points: el.stats.total_points, minutes: el.stats.minutes };
    });

    return Response.json(map);
  } catch (err) {
    return fplError(err);
  }
}