"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type PlayerLookup = Record<number, { name: string; position: string; team: number }>;
type FixtureStatus = "not_started" | "live" | "finished";

const POSITION_ORDER = ["GK", "DEF", "MID", "FWD"];

const sortByPosition = (ids: number[], playerMap: PlayerLookup) =>
  [...ids].sort((a, b) => {
    const posA = POSITION_ORDER.indexOf(playerMap[a]?.position ?? "");
    const posB = POSITION_ORDER.indexOf(playerMap[b]?.position ?? "");
    return posA - posB;
  });

let fplPlayersCache: PlayerLookup | null = null;
async function getFplPlayers(): Promise<PlayerLookup> {
  if (fplPlayersCache) return fplPlayersCache;
  const res = await fetch("/api/fpl-players");
  const players = await res.json();
  const map: PlayerLookup = {};
  players.forEach((p: any) => {
    map[p.id] = { name: p.name, position: p.position, team: p.team };
  });
  fplPlayersCache = map;
  return map;
}

async function getLivePoints(gameweek: number): Promise<Record<number, { points: number; minutes: number }>> {
  const res = await fetch(`/api/fpl-live/${gameweek}`);
  return res.json();
}

async function getFixtureStatus(gameweek: number): Promise<Record<number, FixtureStatus>> {
  const res = await fetch(`/api/fpl-fixtures/${gameweek}`);
  return res.json();
}

const STATUS_LABEL: Record<FixtureStatus, string> = {
  not_started: "Not started",
  live: "Live",
  finished: "FT",
};
const STATUS_COLOR: Record<FixtureStatus, string> = {
  not_started: "#8b949e",
  live: "#3fb950",
  finished: "#58a6ff",
};

type Side = {
  entryId: string;
  managerName: string;
  score: number | null;
  startingXi: number[];
  captainId: number | null;
  viceCaptainId: number | null;
  benchOrder: (number | null)[];
  appliedSubs: { out: number; in: number }[] | null;
};

const SUB_COLORS = ["#f85149", "#f1c40f", "#3fb950", "#58a6ff", "#bc8cff"];

export default function MatchupView({ fixtureId }: { fixtureId: string }) {
  const [loading, setLoading] = useState(true);
  const [gameweek, setGameweek] = useState<number | null>(null);
  const [playerMap, setPlayerMap] = useState<PlayerLookup>({});
  const [home, setHome] = useState<Side | null>(null);
  const [away, setAway] = useState<Side | null>(null);
  const [livePoints, setLivePoints] = useState<Record<number, { points: number; minutes: number }>>({});
  const [fixtureStatus, setFixtureStatus] = useState<Record<number, FixtureStatus>>({});
  const [isBye, setIsBye] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: fixture } = await supabase
        .from("fixtures")
        .select("gameweek, home_entry_id, away_entry_id, is_bye")
        .eq("id", fixtureId)
        .maybeSingle();

      if (!fixture) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setGameweek(fixture.gameweek);

      const homeOnly = fixture.is_bye;
      setIsBye(homeOnly);

      const [homeLineup, awayLineup, homeEntryInfo, awayEntryInfo, scores, players] = await Promise.all([
        supabase
          .from("lineups")
          .select("starting_xi, captain_id, vice_captain_id, bench_order")
          .eq("entry_id", fixture.home_entry_id)
          .eq("gameweek", fixture.gameweek)
          .maybeSingle(),
        !homeOnly && fixture.away_entry_id
          ? supabase
              .from("lineups")
              .select("starting_xi, captain_id, vice_captain_id, bench_order")
              .eq("entry_id", fixture.away_entry_id)
              .eq("gameweek", fixture.gameweek)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from("entries").select("id, players(name)").eq("id", fixture.home_entry_id).maybeSingle(),
        !homeOnly && fixture.away_entry_id
          ? supabase.from("entries").select("id, players(name)").eq("id", fixture.away_entry_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from("entry_scores").select("entry_id, points, applied_subs").eq("gameweek", fixture.gameweek),
        getFplPlayers(),
      ]);

      const [live, status] = await Promise.all([
        getLivePoints(fixture.gameweek),
        getFixtureStatus(fixture.gameweek),
      ]);
      setLivePoints(live);
      setFixtureStatus(status);

      setPlayerMap(players);

      const scoreMap: Record<string, number> = {};
      const subsMap: Record<string, { out: number; in: number }[] | null> = {};
      (scores.data ?? []).forEach((r: any) => {
        scoreMap[r.entry_id] = r.points;
        subsMap[r.entry_id] = r.applied_subs;
      });

      const homeName = (homeEntryInfo.data as any)?.players?.name ?? "Home";
      const awayName = (awayEntryInfo.data as any)?.players?.name ?? "Away";

      setHome({
        entryId: fixture.home_entry_id,
        managerName: homeName,
        score: scoreMap[fixture.home_entry_id] ?? null,
        startingXi: homeLineup.data?.starting_xi ?? [],
        captainId: homeLineup.data?.captain_id ?? null,
        viceCaptainId: homeLineup.data?.vice_captain_id ?? null,
        benchOrder: homeLineup.data?.bench_order ?? [],
        appliedSubs: subsMap[fixture.home_entry_id] ?? null,
      });

      if (fixture.away_entry_id && !homeOnly) {
        setAway({
          entryId: fixture.away_entry_id,
          managerName: awayName,
          score: scoreMap[fixture.away_entry_id] ?? null,
          startingXi: awayLineup.data?.starting_xi ?? [],
          captainId: awayLineup.data?.captain_id ?? null,
          viceCaptainId: awayLineup.data?.vice_captain_id ?? null,
          benchOrder: awayLineup.data?.bench_order ?? [],
          appliedSubs: subsMap[fixture.away_entry_id] ?? null,
        });
      }

      setLoading(false);
    };
    load();
  }, [fixtureId]);

  if (loading) return <p>Loading…</p>;
  if (notFound) return <p style={{ opacity: 0.6 }}>Fixture not found.</p>;

  const maxSubsCount = Math.max(home?.appliedSubs?.length ?? 0, away?.appliedSubs?.length ?? 0);
  const renderSide = (side: Side | null) => {
    if (!side) return <p style={{ opacity: 0.6 }}>No data</p>;

    const subs = side.appliedSubs || [];
    const colorForPlayer = (id: number) => {
      const idx = subs.findIndex((s) => s.out === id || s.in === id);
      return idx >= 0 ? SUB_COLORS[idx % SUB_COLORS.length] : undefined;
    };
    const effectiveXi = side.startingXi.map((id) => {
      const sub = subs.find((s) => s.out === id);
      return sub ? sub.in : id;
    });

    const effectiveCaptainId = side.captainId;

    return (
      <div style={{ flex: 1 }}>
        <h3>{side.managerName}</h3>
        <p style={{ fontSize: "1.8rem", margin: "0.3rem 0" }}>{side.score ?? "—"}</p>
        {effectiveXi.length === 0 ? (
          <p style={{ opacity: 0.6, fontSize: "0.9rem" }}>No lineup submitted yet</p>
        ) : (
          <>
            <div style={{ fontSize: "0.9rem", opacity: 0.85 }}>
              {sortByPosition(effectiveXi, playerMap).map((id) => {
                const info = playerMap[id];
                const tag = id === side.captainId ? " (C)" : id === side.viceCaptainId ? " (VC)" : "";
                const rawPts = livePoints[id]?.points;
                const isDoubled = id === effectiveCaptainId;
                const displayPts = isDoubled && rawPts != null ? rawPts * 2 : rawPts;
                const color = colorForPlayer(id);
                const status = info ? fixtureStatus[info.team] : undefined;
                return (
                  <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: color || undefined }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      {status && (
                        <span
                          title={STATUS_LABEL[status]}
                          style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_COLOR[status], flexShrink: 0 }}
                        />
                      )}
                      {info?.name ?? `id ${id}`}{tag}
                    </span>
                    <span style={{ opacity: color ? 1 : 0.7 }}>{displayPts ?? "—"}</span>
                  </div>
                );
              })}
            </div>
            {maxSubsCount > 0 && (
              <div style={{ fontSize: "0.8rem", opacity: 0.7, marginTop: "0.5rem", minHeight: `${maxSubsCount * 1.2}rem` }}>
                {subs.map((s, i) => (
                  <div key={i} style={{ color: SUB_COLORS[i % SUB_COLORS.length] }}>
                    Sub: {playerMap[s.out]?.name ?? s.out} → {playerMap[s.in]?.name ?? s.in}
                  </div>
                ))}
              </div>
            )}
            {side.benchOrder.some((id) => id !== null) && (
              <>
                <p style={{ marginTop: "1rem", marginBottom: "0.3rem", fontSize: "0.8rem", opacity: 0.6 }}>
                  Bench
                </p>
                <div style={{ fontSize: "0.85rem", opacity: 0.7 }}>
                  {side.benchOrder.map((id, i) => {
                    if (!id) return null;
                    const info = playerMap[id];
                    const status = info ? fixtureStatus[info.team] : undefined;
                    const pts = livePoints[id]?.points;
                    return (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: colorForPlayer(id) || undefined }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          {status && (
                            <span
                              title={STATUS_LABEL[status]}
                              style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_COLOR[status], flexShrink: 0 }}
                            />
                          )}
                          {i + 1}. {info?.name ?? `id ${id}`}
                        </span>
                        <span>{pts ?? "—"}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            <p style={{ fontSize: "0.75rem", opacity: 0.5, marginTop: "0.75rem" }}>
              <span style={{ color: STATUS_COLOR.not_started }}>●</span> Not started &nbsp;
              <span style={{ color: STATUS_COLOR.live }}>●</span> Live &nbsp;
              <span style={{ color: STATUS_COLOR.finished }}>●</span> Full-time
            </p>
          </>
        )}
      </div>
    );
  };

  if (isBye) {
    return (
      <div>
        <p style={{ opacity: 0.7, marginBottom: "1rem" }}>Bye week — no opponent, but your squad still scores.</p>
        {renderSide(home)}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: "2rem" }}>
      {renderSide(home)}
      {renderSide(away)}
    </div>
  );
}
