import { buildGwStats } from "@/lib/gwStats";

export const dynamic = "force-dynamic";

// Plain-text fact sheet for a gameweek, e.g. /api/gw-stats/7
export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameweek: string }> }
) {
  const { gameweek } = await params;
  const gw = Number(gameweek);
  if (!Number.isInteger(gw) || gw < 1 || gw > 38) {
    return new Response("Gameweek must be a number from 1 to 38", { status: 400 });
  }
  try {
    const text = await buildGwStats(gw);
    return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    return new Response(`Couldn't build the fact sheet: ${message}`, { status: 502 });
  }
}
