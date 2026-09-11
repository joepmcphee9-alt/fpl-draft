"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const DIVISION_NAMES: Record<number, string> = {
  1: "The Andy McPhee League",
  2: "Division 2",
  3: "Division 3",
};

const REFRESH_MS = 60000;

type Fixture = {
  id: string;
  division: number;
  gameweek: number;
  home_entry_id: string;
  away_entry_id: string | null;
  is_bye: boolean;
  homeName?: string;
  awayName?: string;
};

type TableRow = {
  managerName: string;
  leaguePts: number;
  ptsFor: number;
};

export default function HomePage() {
  const [gameweek, setGameweek] = useState<number | null>(null);
  const [fixturesByDivision, setFixturesByDivision] = useState<Record<number, Fixture[]>>({});
  const [scores, setScores] = useState<Record<string, number>>({});
  const [expandedDivision, setExpandedDivision] = useState<number | null>(null);
  const [tableSnapshots, setTableSnapshots] = useState<Record<number, TableRow[]>>({});
  const [plFixtures, setPlFixtures] = useState<any[]>([]);
  const [teamNames, setTeamNames] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadDashboard = async () => {
    const { data: settings } = await supabase
      .from("league_settings")
      .select("current_gameweek")
      .maybeSingle();
    const gw = settings?.current_gameweek ?? 1;
    setGameweek(gw);

    const [{ data: entries }, { data: fixtures }, { data: scoreRows }, { data: penalties }, { data: allFixtures }, { data: allScores }] =
      await Promise.all([
        supabase.from("entries").select("id, division, players(name, email)"),
        supabase
          .from("fixtures")
          .select("id, division, gameweek, home_entry_id, away_entry_id, is_bye")
          .eq("gameweek", gw),
        supabase.from("entry_scores").select("entry_id, points").eq("gameweek", gw),
        supabase.from("penalties").select("entry_id, points"),
        supabase.from("fixtures").select("division, gameweek, home_entry_id, away_entry_id, is_bye").eq("is_bye", false),
        supabase.from("entry_scores").select("entry_id, gameweek, points"),
      ]);

    const playingEntries = (entries ?? []).filter((e: any) => e.players?.email);
    const nameByEntry: Record<string, string> = {};
    playingEntries.forEach((e: any) => (nameByEntry[e.id] = e.players?.name ?? "Unknown"));

    const scoreMap: Record<string, number> = {};
    (scoreRows ?? []).forEach((s) => (scoreMap[s.entry_id] = s.points));
    setScores(scoreMap);

    const byDiv: Record<number, Fixture[]> = { 1: [], 2: [], 3: [] };
    (fixtures ?? []).forEach((f: any) => {
      if (f.is_bye) return;
      byDiv[f.division]?.push({
        ...f,
        homeName: nameByEntry[f.home_entry_id],
        awayName: f.away_entry_id ? nameByEntry[f.away_entry_id] : undefined,
      });
    });
    setFixturesByDivision(byDiv);

    // --- League table snapshot (top 3 per division) ---
    const bootstrapRes = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/", { cache: "no-store" });
    const bootstrapData = await bootstrapRes.json();
    const now = new Date();
    const passedGameweeks = new Set<number>();
    bootstrapData.events.forEach((ev: any) => {
      if (new Date(ev.deadline_time) < now) passedGameweeks.add(ev.id);
    });

    const teamMap: Record<number, string> = {};
    bootstrapData.teams.forEach((t: any) => (teamMap[t.id] = t.short_name));
    setTeamNames(teamMap);

    const scoreByEntryGw: Record<string, number> = {};
    (allScores ?? []).forEach((s: any) => (scoreByEntryGw[`${s.entry_id}:${s.gameweek}`] = s.points));
    const penaltyByEntry: Record<string, number> = {};
    (penalties ?? []).forEach((p: any) => (penaltyByEntry[p.entry_id] = (penaltyByEntry[p.entry_id] || 0) + p.points));

        const rowsByEntry: Record<string, { w: number; d: number; l: number; ptsFor: number; managerName: string; division: number; entryId: string }> = {};
    playingEntries.forEach((e: any) => {
      rowsByEntry[e.id] = { w: 0, d: 0, l: 0, ptsFor: 0, managerName: e.players?.name ?? "Unknown", division: e.division, entryId: e.id };
    });
    (allFixtures ?? []).forEach((f: any) => {
      if (!f.away_entry_id || !passedGameweeks.has(f.gameweek)) return;
      const hs = scoreByEntryGw[`${f.home_entry_id}:${f.gameweek}`];
      const as = scoreByEntryGw[`${f.away_entry_id}:${f.gameweek}`];
      if (hs == null || as == null) return;
      const hr = rowsByEntry[f.home_entry_id];
      const ar = rowsByEntry[f.away_entry_id];
      if (!hr || !ar) return;
      hr.ptsFor += hs;
      ar.ptsFor += as;
      if (hs > as) { hr.w++; ar.l++; } else if (hs < as) { ar.w++; hr.l++; } else { hr.d++; ar.d++; }
    });

    const snapshots: Record<number, TableRow[]> = {};
    [1, 2, 3].forEach((div) => {
      const rows = Object.values(rowsByEntry)
        .filter((r) => r.division === div)
        .map((r) => ({
          managerName: r.managerName,
          leaguePts: r.w * 3 + r.d + (penaltyByEntry[r.entryId] || 0),
          ptsFor: r.ptsFor,
        }))
        .sort((a, b) => b.leaguePts - a.leaguePts || b.ptsFor - a.ptsFor)
        .slice(0, 3);
      snapshots[div] = rows;
    });
    setTableSnapshots(snapshots);

    // --- Real Premier League fixtures for this gameweek ---
    const plRes = await fetch(`https://fantasy.premierleague.com/api/fixtures/?event=${gw}`, { cache: "no-store" });
    const plData = await plRes.json();
    setPlFixtures(plData);

    setLastUpdated(new Date());
    setLoading(false);
  };

  useEffect(() => {
    loadDashboard();
    const timer = setInterval(loadDashboard, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  if (loading) return <main><p>Loading…</p></main>;

  const divisions = [1, 2, 3];

  return (
    <main>
      <h1>Welcome</h1>
      <p style={{ opacity: 0.5, fontSize: "0.8rem" }}>
        Gameweek {gameweek} · Updated {lastUpdated?.toLocaleTimeString()}
      </p>

      <h2 style={{ marginTop: "2rem" }}>This Week's Fixtures</h2>
      {divisions.map((div) => {
        const divFixtures = fixturesByDivision[div] ?? [];
        const isExpanded = expandedDivision === div;
        const shown = isExpanded ? divFixtures : divFixtures.slice(0, 1);
        return (
          <div key={div} style={{ marginTop: "1rem" }}>
            <p style={{ fontWeight: 600, marginBottom: "0.3rem" }}>{DIVISION_NAMES[div]}</p>
            {shown.map((f) => (
              <a
                key={f.id}
                href={`/matchup/${f.id}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto 1fr",
                  alignItems: "center",
                  padding: "0.4rem 0.5rem",
                  textDecoration: "none",
                  color: "inherit",
                  borderBottom: "1px solid #1c2530",
                }}
              >
                <span style={{ textAlign: "left" }}>{f.homeName}</span>
                <span style={{ textAlign: "center", opacity: 0.6, padding: "0 1rem" }}>
                  {scores[f.home_entry_id] ?? "—"} v {f.away_entry_id ? scores[f.away_entry_id] ?? "—" : "—"}
                </span>
                <span style={{ textAlign: "right" }}>{f.awayName}</span>
              </a>
            ))}
            {divFixtures.length > 1 && (
              <button
                onClick={() => setExpandedDivision(isExpanded ? null : div)}
                style={{
                  marginTop: "0.4rem",
                  background: "none",
                  border: "none",
                  color: "#58a6ff",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  padding: 0,
                }}
              >
                {isExpanded ? "Show less" : `Show all ${divFixtures.length} fixtures`}
              </button>
            )}
          </div>
        );
      })}

      <h2 style={{ marginTop: "2.5rem" }}>League Table Snapshot</h2>
      <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
        {divisions.map((div) => (
          <div key={div}>
            <p style={{ fontWeight: 600, marginBottom: "0.3rem" }}>{DIVISION_NAMES[div]}</p>
            {(tableSnapshots[div] ?? []).map((r, i) => (
              <div key={r.managerName} style={{ fontSize: "0.9rem", padding: "0.15rem 0" }}>
                {i + 1}. {r.managerName} — {r.leaguePts} pts
              </div>
            ))}
            <a href="/table" style={{ fontSize: "0.8rem", color: "#58a6ff" }}>Full table →</a>
          </div>
        ))}
      </div>

      <h2 style={{ marginTop: "2.5rem" }}>This Gameweek's Premier League Fixtures</h2>
      <div style={{ marginTop: "0.75rem", maxWidth: 400 }}>
        {plFixtures.map((f) => (
          <div key={f.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.3rem 0", borderBottom: "1px solid #1c2530", fontSize: "0.9rem" }}>
            <span>{teamNames[f.team_h]}</span>
            <span style={{ opacity: 0.6 }}>
              {f.finished || f.started ? `${f.team_h_score ?? 0} - ${f.team_a_score ?? 0}` : new Date(f.kickoff_time).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
            <span>{teamNames[f.team_a]}</span>
          </div>
        ))}
      </div>

      <p style={{ marginTop: "2.5rem", opacity: 0.5, fontSize: "0.85rem" }}>
        More coming soon: top-scoring player of the week, and a Premier League news feed.
      </p>
    </main>
  );
}