import CupNav from "../CupNav";
import {
  BEST_THIRDS_THROUGH,
  HONORARY_SEEDS,
  Outcome,
  StandingRow,
  assignOutcomes,
  buildStandings,
  getCupFixtures,
} from "@/lib/michuCup";

export const revalidate = 60;

const OUTCOME_STYLE: Record<Outcome, { color: string; label: string }> = {
  through: { color: "#3fb950", label: "Through" },
  bestThird: { color: "#3fb950", label: `Best ${BEST_THIRDS_THROUGH} thirds — through` },
  secondary: { color: "#d29922", label: "Secondary competition" },
  out: { color: "#f85149", label: "Out" },
};

const cell = { padding: "0.45rem 0.5rem", textAlign: "right" as const };
const nameCell = { ...cell, textAlign: "left" as const };

function StandingsTable({
  rows,
  outcomes,
  showPenalty,
  showGroup = false,
}: {
  rows: StandingRow[];
  outcomes: Record<string, Outcome>;
  showPenalty: boolean;
  showGroup?: boolean;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #333" }}>
            <th style={nameCell}>Pos</th>
            <th style={nameCell}>Name</th>
            {showGroup && <th style={nameCell}>Group</th>}
            <th style={cell}>P</th>
            <th style={cell}>W</th>
            <th style={cell}>D</th>
            <th style={cell}>L</th>
            <th style={cell}>Pts Diff</th>
            {showPenalty && <th style={cell}>Pen</th>}
            <th style={cell}>Pts</th>
            <th style={cell}>Pts For</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const outcome = outcomes[r.entryId];
            return (
              <tr key={r.entryId} style={{ borderBottom: "1px solid #1c2530" }}>
                <td
                  style={{ ...nameCell, borderLeft: `4px solid ${OUTCOME_STYLE[outcome].color}` }}
                  title={OUTCOME_STYLE[outcome].label}
                >
                  {i + 1}
                </td>
                <td style={nameCell}>{r.name}</td>
                {showGroup && <td style={nameCell}>{r.group}</td>}
                <td style={cell}>{r.played}</td>
                <td style={cell}>{r.won}</td>
                <td style={cell}>{r.drawn}</td>
                <td style={cell}>{r.lost}</td>
                <td style={cell}>{r.diff > 0 ? `+${r.diff}` : r.diff}</td>
                {showPenalty && (
                  <td style={{ ...cell, color: r.penalty ? "#f85149" : undefined }}>{r.penalty || ""}</td>
                )}
                <td style={{ ...cell, fontWeight: 700 }}>{r.pts}</td>
                <td style={cell}>{r.pointsFor}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Legend() {
  const items: Outcome[] = ["through", "secondary", "out"];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem", fontSize: "0.85rem", opacity: 0.85 }}>
      {items.map((o) => (
        <span key={o} style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
          <span style={{ width: 12, height: 12, background: OUTCOME_STYLE[o].color, borderRadius: 2 }} />
          {o === "through" ? "Through (top two + best four thirds)" : OUTCOME_STYLE[o].label}
        </span>
      ))}
    </div>
  );
}

export default async function MichuCupTablePage() {
  const { fixtures, penalties } = await getCupFixtures();
  const standings = buildStandings(fixtures, penalties);
  const { outcomes, thirds } = assignOutcomes(standings);
  const groups = Object.keys(standings).map(Number).sort((a, b) => a - b);
  const showPenalty = Object.values(standings).some((rows) => rows.some((r) => r.penalty !== 0));
  const liveGws = Array.from(new Set(fixtures.filter((f) => f.status === "live").map((f) => f.gameweek)));
  const finished = fixtures.length > 0 && fixtures.every((f) => f.isBye || f.status === "final");

  return (
    <main>
      <h1>Michu Cup</h1>
      <CupNav active="table" />

      {groups.length === 0 ? (
        <p style={{ opacity: 0.6 }}>No cup fixtures loaded yet.</p>
      ) : (
        <>
          <Legend />
          <p style={{ opacity: 0.7, fontSize: "0.9rem" }}>
            {finished ? "Final group positions." : "Positions as they stand."}
            {liveGws.length > 0 && ` Includes live scores from Gameweek ${liveGws.join(", ")}.`}
            {" "}Missed deadlines cost 3 points in the cup as well as the league.
          </p>
        </>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 440px), 1fr))",
          gap: "2rem",
          marginTop: "1.5rem",
        }}
      >
        {groups.map((g) => (
          <section key={g}>
            <h2 style={{ marginBottom: "0.25rem" }}>Group {g}</h2>
            <p style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", opacity: 0.6 }}>
              {HONORARY_SEEDS[g]
                ? `Honorary seed: ${HONORARY_SEEDS[g]} · top two through, 3rd and 4th to the secondary competition`
                : "Top two through · 3rd into the best-thirds race · 4th to the secondary competition · 5th out"}
            </p>
            <StandingsTable rows={standings[g]} outcomes={outcomes} showPenalty={showPenalty} />
          </section>
        ))}
      </div>

      {thirds.length > 0 && (
        <section style={{ marginTop: "2.5rem", maxWidth: 640 }}>
          <h2 style={{ marginBottom: "0.25rem" }}>Third-placed sides</h2>
          <p style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", opacity: 0.6 }}>
            The best {BEST_THIRDS_THROUGH} go through; the rest go to the secondary competition. Group 3's third
            place isn't in this race.
          </p>
          <StandingsTable rows={thirds} outcomes={outcomes} showPenalty={showPenalty} showGroup />
        </section>
      )}
    </main>
  );
}