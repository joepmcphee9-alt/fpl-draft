import { buildResultsEmail } from "@/lib/resultsEmail";

export const dynamic = "force-dynamic";

// Used by the Apps Script that sends the end-of-gameweek email.
// Returns { gameweek, subject, html, text }.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameweek: string }> }
) {
  const { gameweek } = await params;
  const gw = Number(gameweek);
  if (!Number.isInteger(gw) || gw < 1 || gw > 38) {
    return Response.json({ error: "Gameweek must be a number from 1 to 38" }, { status: 400 });
  }
  try {
    return Response.json(await buildResultsEmail(gw));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    return Response.json({ error: message }, { status: 502 });
  }
}
