"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// Cached in memory for the page session so we don't refetch the full
// FPL player list every time a different squad is expanded.
let fplPlayersCache: Record<number, string> | null = null;

async function getFplPlayerMap(): Promise<Record<number, string>> {
  if (fplPlayersCache) return fplPlayersCache;
  const res = await fetch("/api/fpl-players");
  const map = await res.json();
  fplPlayersCache = map;
  return map;
}

export default function SquadList({ entryId }: { entryId: string }) {
  const [players, setPlayers] = useState<string[] | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("squad_players")
        .select("fpl_player_id")
        .eq("entry_id", entryId);

      const nameMap = await getFplPlayerMap();
      const names = (data ?? [])
        .map((row) => nameMap[row.fpl_player_id] ?? `Unknown (id ${row.fpl_player_id})`)
        .sort();
      setPlayers(names);
    };
    load();
  }, [entryId]);

  if (!players) {
    return <p style={{ opacity: 0.6, padding: "0.5rem 0" }}>Loading squad…</p>;
  }
  if (players.length === 0) {
    return <p style={{ opacity: 0.6, padding: "0.5rem 0" }}>No squad loaded yet.</p>;
  }

  return (
    <div style={{ padding: "0.5rem 0 1rem 1rem", opacity: 0.85, fontSize: "0.9rem" }}>
      {players.join(", ")}
    </div>
  );
}