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
  home_entry_id: string;
  away_entry_id: string | null;
  home: { players: { name: string } | null } | null;
  away: { players: { name: string } | null } | null;
};

async function getFixtures(gameweek: number): Promise<Fixture[]> {
  const { data, error } = await supabase
    .from("fixtures")
    .select(
      "id, division, is_bye, home_entry_id, away_entry_id, home:home_entry_id(players(name)), away:away_entry_id(players(name))"
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

async function getScores(gameweek: number): Promise<Record<string, number>> {
  const { data } = await supabase
    .from("entry_scores")
    .select("entry_id, points")
    .eq("gameweek", gameweek);

  const map: Record<string, number> = {};
  (data ?? []).forEach((row) => {
    map[row.entry_id] = row.points;
  });
  return map;
}

export default async function FixturesPage({
  searchParams,
}: {
  searchParams: Promise<{ gw?: string }>;
}) {
  const params = await searchParams;
  const currentGameweek = await getCurrentGameweek();
  const gameweek = params.gw ? parseInt(params.gw, 10) : currentGameweek;

  const [fixtures, scores] = await Promise.all([
    getFixtures(gameweek),
    getScores(gameweek),
  ]);
  const divisions = [1, 2, 3];

  const navLinkStyle = { color: "#58a6ff", padding: "0.3rem 0.6rem" };

  return (
    <main>
      <h1>Fixtures & Results</h1>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", margin: "1rem 0" }}>
        <a href={`/fixtures?gw=${gameweek - 1}`} style={navLinkStyle}>← GW{gameweek - 1}</a>
        <strong>Gameweek {gameweek}</strong>
        <a href={`/fixtures?gw=${gameweek + 1}`} style={navLinkStyle}>GW{gameweek + 1} →</a>
        {gameweek !== currentGameweek && (
          <a href="/fixtures" style={{ ...navLinkStyle, opacity: 0.7 }}>(back to current)</a>
        )}
      </div>

      {divisions.map((div) => {
        const rows = fixtures.filter((f) => f.division === div);
        return (
          <section key={div} style={{ marginTop: "2rem" }}>
            <h2>{divisionNames[div]}</h2>
            {rows.length === 0 ? (
              <p style={{ opacity: 0.6 }}>No fixtures loaded for this gameweek.</p>
            ) : (
              <div>
                {rows.map((f) => {
                  const homeScore = scores[f.home_entry_id];
                  const awayScore = f.away_entry_id ? scores[f.away_entry_id] : undefined;
                  const content = (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto 1fr",
                        alignItems: "center",
                        padding: "0.5rem 0",
                        borderBottom: "1px solid #1c2530",
                      }}
                    >
                      {f.is_bye ? (
                        <>
                          <span style={{ textAlign: "left" }}>{f.home?.players?.name ?? "—"}</span>
                          <span style={{ textAlign: "center", opacity: 0.6, padding: "0 1rem" }}>
                            {homeScore ?? "—"} pts
                          </span>
                          <span style={{ textAlign: "right", opacity: 0.6 }}>Bye</span>
                        </>
                      ) : (
                        <>
                          <span style={{ textAlign: "left" }}>{f.home?.players?.name ?? "—"}</span>
                          <span style={{ textAlign: "center", opacity: 0.6, padding: "0 1rem" }}>
                            {homeScore ?? "—"} v {awayScore ?? "—"}
                          </span>
                          <span style={{ textAlign: "right" }}>{f.away?.players?.name ?? "—"}</span>
                        </>
                      )}
                    </div>
                  );
                  return f.is_bye ? (
                    <div key={f.id}>{content}</div>
                  ) : (
                    <a key={f.id} href={`/matchup/${f.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                      {content}
                    </a>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </main>
  );
}