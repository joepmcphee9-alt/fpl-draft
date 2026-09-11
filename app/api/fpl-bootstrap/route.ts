export const dynamic = "force-dynamic";

export async function GET() {
  const res = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/");
  const data = await res.json();

  const teamNames: Record<number, string> = {};
  data.teams.forEach((t: any) => {
    teamNames[t.id] = t.short_name;
  });

  const events = data.events.map((ev: any) => ({ id: ev.id, deadline_time: ev.deadline_time }));

  return Response.json({ teamNames, events });
}