import Link from "next/link";
import CupNav from "../CupNav";
import { CUP_BASE_PATH, CupFixture, CupSide, getCupFixtures } from "@/lib/michuCup";

export const revalidate = 60;

const STATUS_STYLE: Record<CupFixture["status"], { label: string; color: string }> = {
  final: { label: "FT", color: "#58a6ff" },
  live: { label: "Live", color: "#3fb950" },
  upcoming: { label: "", color: "#8b949e" },
};

function Name({ side, won }: { side: CupSide; won: boolean }) {
  return <span style={{ fontWeight: won ? 700 : 400 }}>{side.name}</span>;
}

function MatchRow({ f }: { f: CupFixture }) {
  if (!f.away) {
    return (
      <div style={{ padding: "0.35rem 0", opacity: 0.6 }}>
        {f.home.name} — bye
      </div>
    );
  }
  const h = f.home.score;
  const a = f.away.score;
  const scored = h !== null && a !== null;
  const status = STATUS_STYLE[f.status];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr 3rem",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.35rem 0",
        borderBottom: "1px solid #1c2530",
      }}
    >
      <span style={{ textAlign: "right" }}>
        <Name side={f.home} won={scored && h! > a!} />
      </span>
      <span style={{ minWidth: "4.5rem", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
        {scored ? `${h} – ${a}` : "v"}
      </span>
      <span>
        <Name side={f.away} won={scored && a! > h!} />
      </span>
      <span style={{ fontSize: "0.8rem", color: status.color }}>{status.label}</span>
    </div>
  );
}

export default async function MichuCupFixturesPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const { group } = await searchParams;
  const { fixtures, currentGameweek } = await getCupFixtures();
  const groups = Array.from(new Set(fixtures.map((f) => f.group))).sort((a, b) => a - b);
  const selected = Number(group) || null;
  const shown = selected ? fixtures.filter((f) => f.group === selected) : fixtures;
  const gameweeks = Array.from(new Set(shown.map((f) => f.gameweek))).sort((a, b) => a - b);

  const filterLink = (group: number | null, label: string) => (
    <Link
      key={label}
      href={group ? `${CUP_BASE_PATH}/fixtures?group=${group}` : `${CUP_BASE_PATH}/fixtures`}
      style={{
        color: "inherit",
        textDecoration: selected === group ? "underline" : "none",
        opacity: selected === group ? 1 : 0.6,
      }}
    >
      {label}
    </Link>
  );

  return (
    <main>
      <h1>Michu Cup</h1>
      <CupNav active="fixtures" />

      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
        {filterLink(null, "All groups")}
        {groups.map((g) => filterLink(g, `Group ${g}`))}
      </div>

      {gameweeks.length === 0 && <p style={{ opacity: 0.6 }}>No cup fixtures loaded yet.</p>}

      {gameweeks.map((gw) => {
        const inGw = shown.filter((f) => f.gameweek === gw);
        const gwGroups = Array.from(new Set(inGw.map((f) => f.group))).sort((a, b) => a - b);
        return (
          <section key={gw} style={{ marginBottom: "2rem" }}>
            <h2 style={{ marginBottom: "0.5rem" }}>
              Gameweek {gw}
              {gw === currentGameweek && (
                <span style={{ fontSize: "0.8rem", color: "#3fb950", marginLeft: "0.6rem" }}>current</span>
              )}
            </h2>
            {gwGroups.map((g) => {
              const matches = inGw.filter((f) => f.group === g && f.away);
              const byes = inGw.filter((f) => f.group === g && !f.away);
              return (
                <div key={g} style={{ marginBottom: "1rem" }}>
                  {!selected && <h3 style={{ fontSize: "0.95rem", opacity: 0.7, margin: "0.5rem 0" }}>Group {g}</h3>}
                  {matches.map((f) => <MatchRow key={f.id} f={f} />)}
                  {byes.map((f) => <MatchRow key={f.id} f={f} />)}
                </div>
              );
            })}
          </section>
        );
      })}
    </main>
  );
}