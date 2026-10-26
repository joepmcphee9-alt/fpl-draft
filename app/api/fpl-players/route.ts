import { cachedFpl, fplError, fplJson } from "@/lib/fpl";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const players = await cachedFpl("players", 3600, async () => {
      const data = await fplJson("bootstrap-static/");

      const positionNames: Record<number, string> = {
        1: "GK",
        2: "DEF",
        3: "MID",
        4: "FWD",
      };

      return data.elements.map((el: any) => ({
        id: el.id,
        name: el.web_name,
        position: positionNames[el.element_type] ?? "UNK",
        team: el.team,
      }));
    });
    return Response.json(players);
  } catch (err) {
    return fplError(err);
  }
}
