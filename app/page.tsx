import { supabase } from "@/lib/supabaseClient";
import EntryRow from "@/components/EntryRow";

type Entry = {
  id: string;
  division: number;
  team_name: string | null;
  players: { name: string } | null;
};

async function getEntries(): Promise<Entry[]> {
  const { data, error } = await supabase
    .from("entries")
    .select("id, division, team_name, players(name)")
    .order("division", { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }
  // Supabase types the joined relation as an array by default — flatten it.
  return (data ?? []).map((row: any) => ({
    ...row,
    players: Array.isArray(row.players) ? row.players[0] : row.players,
  }));
}

export default async function StandingsPage() {
  const entries = await getEntries();
  const divisions = [1, 2, 3];

 const divisionNames: Record<number, string> = {
    1: "The Andy McPhee League",
    2: "Division 2",
    3: "Division 3",
  };

  return (
    <main>
      <h1>FPL Draft League</h1>
      <p style={{ opacity: 0.7 }}>Standings will populate here once scores are synced in.</p>

      {divisions.map((div) => {
        const rows = entries.filter((e) => e.division === div);
        return (
          <section key={div} style={{ marginTop: "2rem" }}>
            <h2>{divisionNames[div]}</h2>
            {rows.length === 0 ? (
              <p style={{ opacity: 0.6 }}>No entries loaded yet.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid #333" }}>
                    <th style={{ padding: "0.5rem 0" }}>Player</th>
                    <th>Team</th>
                  </tr>
                </thead>
                 <tbody>
                  {rows.map((e) => (
                    <EntryRow key={e.id} entry={e} />
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </main>
  );
}
