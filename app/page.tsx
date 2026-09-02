import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

const divisionNames: Record<number, string> = {
  1: "The Andy McPhee League",
  2: "Division 2",
  3: "Division 3",
};

const POSITION_ORDER = ["GK", "DEF", "MID", "FWD"];
const POSITION_COLORS: Record<string, string> = {
  GK: "rgba(241,196,15,0.18)",
  DEF: "rgba(63,185,80,0.18)",
  MID: "rgba(88,166,255,0.18)",
  FWD: "rgba(248,81,73,0.18)",
};

type ManagerSquad = {
  name: string;
  byPosition: Record<string, string[]>;
  totalRows: number;
};

async function getData() {
  const [entriesRes, squadRes, bootstrapRes] = await Promise.all([
    supabase.from("entries").select("id, division, players(name)").order("division", { ascending: true }),
    supabase.from("squad_players").select("entry_id, fpl_player_id"),
    fetch("https://fantasy.premierleague.com/api/bootstrap-static/", { cache: "no-store" }),
  ]);

  const bootstrapData = await bootstrapRes.json();
  const positionNames: Record<number, string> = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };
  const playerInfoById: Record<number, { name: string; position: string }> = {};
  bootstrapData.elements.forEach((el: any) => {
    playerInfoById[el.id] = { name: el.web_name, position: positionNames[el.element_type] ?? "FWD" };
  });

  return { entries: entriesRes.data ?? [], squadRows: squadRes.data ?? [], playerInfoById };
}

export default async function SquadsPage() {
  const { entries, squadRows, playerInfoById } = await getData();

  const squadByEntry: Record<string, number[]> = {};
  squadRows.forEach((r: any) => {
    if (!squadByEntry[r.entry_id]) squadByEntry[r.entry_id] = [];
    squadByEntry[r.entry_id].push(r.fpl_player_id);
  });

  const divisions = [1, 2, 3];

  return (
    <main>
      <h1>Squads</h1>

      {divisions.map((div) => {
        const divEntries = entries.filter((e: any) => e.division === div);
        const managers: ManagerSquad[] = divEntries.map((e: any) => {
          const byPosition: Record<string, string[]> = { GK: [], DEF: [], MID: [], FWD: [] };
          (squadByEntry[e.id] ?? []).forEach((fplId) => {
            const info = playerInfoById[fplId];
            const pos = info?.position && byPosition[info.position] ? info.position : "FWD";
            byPosition[pos].push(info?.name ?? `id ${fplId}`);
          });
          POSITION_ORDER.forEach((pos) => byPosition[pos].sort());
          const totalRows = POSITION_ORDER.reduce((sum, pos) => sum + byPosition[pos].length, 0);
          return { name: e.players?.name ?? "Unknown", byPosition, totalRows };
        });

        const maxRows = Math.max(0, ...managers.map((m) => m.totalRows));

        const cellForManager = (manager: ManagerSquad, rowIndex: number) => {
          let offset = rowIndex;
          for (const pos of POSITION_ORDER) {
            const group = manager.byPosition[pos];
            if (offset < group.length) return { name: group[offset], color: POSITION_COLORS[pos] };
            offset -= group.length;
          }
          return null;
        };

        return (
          <section key={div} style={{ marginTop: "2rem", overflowX: "auto" }}>
            <h2>{divisionNames[div]}</h2>
            {managers.length === 0 ? (
              <p style={{ opacity: 0.6 }}>No entries loaded yet.</p>
            ) : (
              <table style={{ borderCollapse: "collapse", marginTop: "0.5rem", minWidth: "100%" }}>
                <thead>
                  <tr>
                    {managers.map((m) => (
                      <th
                        key={m.name}
                        style={{
                          padding: "0.4rem 0.8rem",
                          textAlign: "left",
                          borderBottom: "2px solid #333",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {m.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: maxRows }).map((_, rowIndex) => (
                    <tr key={rowIndex}>
                      {managers.map((m) => {
                        const cell = cellForManager(m, rowIndex);
                        return (
                          <td
                            key={m.name}
                            style={{
                              padding: "0.3rem 0.8rem",
                              fontSize: "0.85rem",
                              whiteSpace: "nowrap",
                              background: cell?.color ?? "transparent",
                            }}
                          >
                            {cell?.name ?? ""}
                          </td>
                        );
                      })}
                    </tr>
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
