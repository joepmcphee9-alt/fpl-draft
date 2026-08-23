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

async function getLivePoints(gameweek: number): Promise<Record<number, { points: number; minutes: number }>> {
  const res = await fetch(`/api/fpl-live/${gameweek}`);
  return res.json();
}

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

      const live = await getLivePoints(fixture.gameweek);
      setLivePoints(live);

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

  const renderSide = (side: Side | null) => {
    if (!side) return <p style={{ opacity: 0.6 }}>No data</p>;

    const subs = side.appliedSubs || [];
    const colorForPlayer = (id: number) => {
      const idx = subs.findIndex((s) => s.out === id || s.in === id);
      return idx >= 0 ? SUB_COLORS[idx % SUB_COLORS.length] : undefined;
    };
    // The effective XI reflects any applied substitutions — this is what
    // actually counted toward the score, so it's what gets displayed.
    const effectiveXi = side.startingXi.map((id) => {
      const sub = subs.find((s) => s.out === id);
      return sub ? sub.in : id;
    });

    // Note: we deliberately don't auto-swap to the vice-captain here for a
    // player who simply hasn't kicked off yet. Always doubling the named
    // captain is the safer approximation for a captain still to play.
    const effectiveCaptainId = side.captainId;

    return (
      <div style={{ flex: 1 }}>
        <h3>{side.managerName}</h3>
        <p style={{ fontSize: "1.8rem", margin: "0.3rem 0" }}>{side.score ?? "—"}</p>
        {effectiveXi.length === 0 ? (
          <p style={{ opacity: 0.6, fontSize: "0.9rem" }}>No lineup submitted yet</p>
        ) : (
          <>