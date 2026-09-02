"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type PlayerInfo = { name: string; position: string };

// Cached in memory for the page session so we don't refetch the full
// FPL player list every time a different squad is expanded.
let fplPlayersCache: Record<number, PlayerInfo> | null = null;

async function getFplPlayerMap(): Promise<Record<number, PlayerInfo>> {
  if (fplPlayersCache) return fplPlayersCache;
  const res = await fetch("/api/fpl-players");
  const players = await res.json();
  const map: Record<number, PlayerInfo> = {};
  players.forEach((p: any) => {
    map[p.id] = { name: p.name, position: p.position };
  });
  fplPlayersCache = map;
  return map;
}

const POSITION_ORDER = ["GK", "DEF", "MID", "FWD"];
const POSITION_LABELS: Record<string, string> = {
  GK: "Goalkeepers",
  DEF: "Defenders",
  MID: "Midfielders",
  FWD: "Forwards",
};
const POSITION_COLORS: Record<string, string> = {
  GK: "#f1c40f",
  DEF: "#58a6ff",
  MID: "#3fb950",
  FWD: "#f85149",
};

export default function SquadList({ entryId }: { entryId: string }) {
  const [grouped, setGrouped] = useState<Record<string, string[]> | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("squad_players")
        .select("fpl_player_id")
        .eq("entry_id", entryId);

      const infoMap = await getFplPlayerMap();
      const byPosition: Record<string, string[]> = { GK: [], DEF: [], MID: [], FWD: [] };
      (data ?? []).forEach((row) => {
        const info = infoMap[row.fpl_player_id];
        const pos = info?.position && byPosition[info.position] ? info.position : "FWD";
        byPosition[pos].push(info?.name ?? `Unknown (id ${row.fpl_player_id})`);
      });
      Object.keys(byPosition).forEach((pos) => byPosition[pos].sort());
      setGrouped(byPosition);
    };
    load();
  }, [entryId]);

  if (!grouped) {
    return <p style={{ opacity: 0.6, padding: "0.5rem 0" }}>Loading squad…</p>;
  }

  const totalPlayers = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);
  if (totalPlayers === 0) {
    return <p style={{ opacity: 0.6, padding: "0.5rem 0" }}>No squad loaded yet.</p>;
  }

  return (
    <div style={{ padding: "0.75rem 0 1rem 1rem", display: "flex", gap: "2rem", flexWrap: "wrap" }}>
      {POSITION_ORDER.map((pos) => {
        const names = grouped[pos];
        if (!names || names.length === 0) return null;
        return (
          <div key={pos}>
            <p style={{ fontSize: "0.75rem", opacity: 0.7, color: POSITION_COLORS[pos], marginBottom: "0.3rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>
              {POSITION_LABELS[pos]}
            </p>
            {names.map((name) => (
              <div key={name} style={{ fontSize: "0.9rem", color: POSITION_COLORS[pos], padding: "0.1rem 0" }}>
                {name}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}