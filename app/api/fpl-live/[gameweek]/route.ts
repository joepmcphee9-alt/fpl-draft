import { cachedFpl, fplError, fplJson } from "@/lib/fpl";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameweek: string }> }
) {
  try {
    const { gameweek } = await params;
    const map = await cachedFpl(`live-${gameweek}`, 60, async () => {
      const data = await fplJson(`event/${gameweek}/live/`);

      const points: Record<number, { points: number; minutes: number }> = {};
      data.elements.forEach((el: any) => {
        points[el.id] = { points: el.stats.total_points, minutes: el.stats.minutes };
      });
      return points;
    });

    return Response.json(map);
  } catch (err) {
    return fplError(err);
  }
}
