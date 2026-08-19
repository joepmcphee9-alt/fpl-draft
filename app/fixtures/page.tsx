import { supabase } from "@/lib/supabaseClient";

const divisionNames: Record<number, string> = {
  1: "The Andy McPhee League",
  2: "Division 2",
  3: "Division 3",
};

async function getCurrentGameweek(): Promise<number> {
  const { data } = await supabase
    .from("league_settings")
    .select("current_gameweek")
    .maybeSingle();
  return data?.current_gameweek ?? 1;
}

type Fixture = {
  id: string;
  division: number;
  is_bye: boolean;
  home_score: number | null;
  away_score: number | null;
  home: { players: { name: string } | null } | null;
  away: { players: { name: string } | null } | null;
};

async function getFixtures(gameweek: number): Promise<Fixture[]> {
  const { data, error } = await supabase
    .from("fixtures")
    .select(
      "id, division, is_bye, home_score, away_score, home:home_entry_id(players(name)), away:away_entry_id(players(name))"
    )
    .eq("gameweek", gameweek)
    .order("division", { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }
  return (data ?? []).map((row: any) => ({
    ...row,
    home: Array.isArray(row.home) ? row.home[0] : row.home,
    away: Array.isArray(row.away) ? row.away[0] : row.away,
  }));
}

export default async function FixturesPage() {
  const gameweek = await getCurrentGameweek();
  const fixtures = await getFixtures(gameweek);
  const divisions = [1, 2, 3];

  return (
    <main>
      <h1>Fixtures — Gameweek {gameweek}</h1>

      {divisions.map((div) => {
        const rows = fixtures.filter((f) => f.division === div);
        return (
          <section key={div} style={{ marginTop: "2rem" }}>
            <h2>{divisionNames[div]}</h2>
            {rows.length === 0 ? (
              <p style={{ opacity: 0.6 }}>No fixtures loaded for this gameweek.</p>
            ) : (
              <div>
                {rows.map((f) => (
                  <div
                    key={f.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "0.5rem 0",
                      borderBottom: "1px solid #1c2530",
                    }}
                  >
                    {f.is_bye ? (
                      <span>{f.home?.players?.name ?? "—"} — Bye</span>
                    ) : (
                      <>
                        <span>{f.home?.players?.name ?? "—"}</span>
                        <span style={{ opacity: 0.6 }}>
                          {f.home_score ?? "—"} v {f.away_score ?? "—"}
                        </span>
                        <span>{f.away?.players?.name ?? "—"}</span>
                      </>
                    )}
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