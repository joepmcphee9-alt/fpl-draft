import { cachedFpl, fplError, fplJson } from "@/lib/fpl";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameweek: string }> }
) {
  try {
    const { gameweek } = await params;
    const data = await cachedFpl(`fixtures-raw-${gameweek}`, 60, () => fplJson(`fixtures/?event=${gameweek}`));
    return Response.json(data);
  } catch (err) {
    return fplError(err);
  }
}
