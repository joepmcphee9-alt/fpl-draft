"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type PlayerLookup = Record<number, { name: string; position: string }>;

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
    map[p.id] = { name: p.name, position: p.position };
  });
  fplPlayersCache = map;
  return map;
}

type Side = {
  entryId: string;
  managerName: string;
  score: number | null;
  startingXi: number[];
  captainId: number | null;
  viceCaptainId: number | null;
  benchOrder: (number | null)[];
};

export default function MatchupView({ fixtureId }: { fixtureId: string }) {
  const [loading, setLoading] = useState(true);
  const [gameweek, setGameweek] = useState<number | null>(null);
  const [playerMap, setPlayerMap] = useState<PlayerLookup>({});
  const [home, setHome] = useState<Side | null>(null);
  const [away, setAway] = useState<Side | null>(null);
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

      if (fixture.is_bye) {
        setIsBye(true);
        setLoading(false);
        return;
      }

      const [homeLineup, awayLineup, homeEntryInfo, awayEntryInfo, scores, players] = await Promise.all([
        supabase
          .from("lineups")
          .select("starting_xi, captain_id, vice_captain_id, bench_order")
          .eq("entry_id", fixture.home_entry_id)
          .eq("gameweek", fixture.gameweek)
          .maybeSingle(),
        fixture.away_entry_id
          ? supabase
              .from("lineups")
              .select("starting_xi, captain_id, vice_captain_id, bench_order")
              .eq("entry_id", fixture.away_entry_id)
              .eq("gameweek", fixture.gameweek)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from("entries").select("id, players(name)").eq("id", fixture.home_entry_id).maybeSingle(),
        fixture.away_entry_id
          ? supabase.from("entries").select("id, players(name)").eq("id", fixture.away_entry_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from("entry_scores").select("entry_id, points").eq("gameweek", fixture.gameweek),
        getFplPlayers(),
      ]);

      setPlayerMap(players);

      const scoreMap: Record<string, number> = {};
      (scores.data ?? []).forEach((r: any) => (scoreMap[r.entry_id] = r.points));

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
      });

      if (fixture.away_entry_id) {
        setAway({
          entryId: fixture.away_entry_id,
          managerName: awayName,
          score: scoreMap[fixture.away_entry_id] ?? null,
          startingXi: awayLineup.data?.starting_xi ?? [],
          captainId: awayLineup.data?.captain_id ?? null,
          viceCaptainId: awayLineup.data?.vice_captain_id ?? null,
          benchOrder: awayLineup.data?.bench_order ?? [],
        });
      }

      setLoading(false);
    };
    load();
  }, [fixtureId]);

  if (loading) return <p>Loading…</p>;
  if (notFound) return <p style={{ opacity: 0.6 }}>Fixture not found.</p>;

  if (isBye) {
    return (
      <div>
        <p style={{ opacity: 0.7 }}>{home?.managerName ?? "This manager"} has a bye this week.</p>
      </div>
    );
  }

  const renderSide = (side: Side | null) => {
    if (!side) return <p style={{ opacity: 0.6 }}>No data</p>;
    return (
      <div style={{ flex: 1 }}>
        <h3>{side.managerName}</h3>
        <p style={{ fontSize: "1.8rem", margin: "0.3rem 0" }}>{side.score ?? "—"}</p>
        {side.startingXi.length === 0 ? (
          <p style={{ opacity: 0.6, fontSize: "0.9rem" }}>No lineup submitted yet</p>
        ) : (
          <>
            <div style={{ fontSize: "0.9rem", opacity: 0.85 }}>
              {sortByPosition(side.startingXi, playerMap).map((id) => {
                const info = playerMap[id];
                const tag = id === side.captainId ? " (C)" : id === side.viceCaptainId ? " (VC)" : "";
                return <div key={id}>{info?.name ?? `id ${id}`}{tag}</div>;
              })}
            </div>
            {side.benchOrder.some((id) => id !== null) && (
              <>
                <p style={{ marginTop: "1rem", marginBottom: "0.3rem", fontSize: "0.8rem", opacity: 0.6 }}>
                  Bench
                </p>
                <div style={{ fontSize: "0.85rem", opacity: 0.7 }}>
                  {side.benchOrder.map((id, i) =>
                    id ? (
                      <div key={i}>{i + 1}. {playerMap[id]?.name ?? `id ${id}`}</div>
                    ) : null
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", gap: "2rem" }}>
      {renderSide(home)}
      {renderSide(away)}
    </div>
  );
}