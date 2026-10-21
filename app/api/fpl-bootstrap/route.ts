import { fplJson, fplError } from "@/lib/fpl";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await fplJson("bootstrap-static/");

    const teamNames: Record<number, string> = {};
    data.teams.forEach((t: any) => {
      teamNames[t.id] = t.short_name;
    });

    const events = data.events.map((ev: any) => ({ id: ev.id, deadline_time: ev.deadline_time }));

    return Response.json({ teamNames, events });
  } catch (err) {
    return fplError(err);
  }
}