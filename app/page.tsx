import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

const divisionNames: Record<number, string> = {
  1: "The Andy McPhee League",
  2: "Division 2",
  3: "Division 3",
};

const POSITION_ORDER = ["GK", "DEF", "MID", "FWD"];
const POSITION_COLORS: Record<string, string> = {
  GK: "#f1c40f",
  DEF: "#3fb950",
  MID: "#58a6ff",
  FWD: "#f85149",
};

type ManagerSquad = {
  name: string;
  byPosition: Record<string, string[]>;
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
          return { name: e.players?.name ?? "Unknown", byPosition };
        });

        return (
          <section key={div} style={{ marginTop: "2rem" }}>
            <h2>{divisionNames[div]}</h2>
            {managers.length === 0 ? (
              <p style={{ opacity: 0.6 }}>No entries loaded yet.</p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                  gap: "1rem",
                  marginTop: "0.75rem",
                }}
              >
                {managers.map((m) => (
                  <div
                    key={m.name}
                    style={{
                      border: "1px solid #1c2530",
                      borderRadius: 8,
                      padding: "0.75rem",
                      background: "rgba(255,255,255,0.02)",
                    }}
                  >
                    <p style={{ fontWeight: 600, marginBottom: "0.5rem", borderBottom: "1px solid #1c2530", paddingBottom: "0.4rem" }}>
                      {m.name}
                    </p>
                    {POSITION_ORDER.map((pos) => {
                      const names = m.byPosition[pos];
                      if (names.length === 0) return null;
                      return (
                        <div key={pos} style={{ marginBottom: "0.5rem" }}>
                          {names.map((name) => (
                            <div
                              key={name}
                              style={{
                                fontSize: "0.82rem",
                                color: POSITION_COLORS[pos],
                                padding: "0.1rem 0",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {name}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </main>
  );
}
