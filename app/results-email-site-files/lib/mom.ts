import { supabase } from "@/lib/supabaseClient";
import { fplJson } from "@/lib/fpl";

// Manager of the Month: each gameweek belongs to the month its FPL deadline
// falls in, and the winner is the highest total points across those gameweeks.

export type GameweekInfo = { gameweek: number; monthKey: string; monthLabel: string };

export type EntryTotal = {
  entryId: string;
  managerName: string;
  division: number;
  total: number;
};

export function gameweekMonthsFromEvents(events: any[]): GameweekInfo[] {
  return events.map((ev: any) => {
    const d = new Date(ev.deadline_time);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = d.toLocaleString("en-GB", { month: "long", year: "numeric" });
    return { gameweek: ev.id, monthKey, monthLabel };
  });
}

export async function getGameweekMonths(): Promise<GameweekInfo[]> {
  const data = await fplJson("bootstrap-static/");
  return gameweekMonthsFromEvents(data.events);
}

export async function getMonthTotals(gameweeksInMonth: number[]): Promise<EntryTotal[]> {
  if (gameweeksInMonth.length === 0) return [];

  const { data: scores } = await supabase
    .from("entry_scores")
    .select("entry_id, points, gameweek")
    .in("gameweek", gameweeksInMonth);

  const { data: entries } = await supabase
    .from("entries")
    .select("id, division, players(name, email)"); // email used to exclude memorial entries

  const totalsByEntry: Record<string, number> = {};
  (scores ?? []).forEach((row) => {
    totalsByEntry[row.entry_id] = (totalsByEntry[row.entry_id] || 0) + row.points;
  });

  return (entries ?? [])
    .filter((e: any) => e.players?.email) // exclude memorial/non-playing entries
    .map((e: any) => ({
      entryId: e.id,
      managerName: e.players?.name ?? "Unknown",
      division: e.division,
      total: totalsByEntry[e.id] || 0,
    }));
}
