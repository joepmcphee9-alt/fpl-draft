import { cachedFpl, fplError, fplJson } from "@/lib/fpl";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await cachedFpl("bootstrap", 3600, async () => {
      const data = await fplJson("bootstrap-static/");

      const teamNames: Record<number, string> = {};
      data.teams.forEach((t: any) => {
        teamNames[t.id] = t.short_name;
      });

      const events = data.events.map((ev: any) => ({ id: ev.id, deadline_time: ev.deadline_time }));

      return { teamNames, events };
    });
    return Response.json(result);
  } catch (err) {
    return fplError(err);
  }
}
