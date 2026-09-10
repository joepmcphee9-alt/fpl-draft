"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type PlayerInfo = { name: string; position: string };
type TransferRow = { window_label: string; summary: string };

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
  const [transfers, setTransfers] = useState<TransferRow[]>([]);

  useEffect(() => {
    const load = async () => {
      const [{ data: squadRows }, { data: transferRows }] = await Promise.all([
        supabase.from("squad_players").select("fpl_player_id").eq("entry_id", entryId),
        supabase
          .from("transfer_history")
          .select("window_label, summary")
          .eq("entry_id", entryId)
          .order("created_at", { ascending: false }),
      ]);

      const infoMap = await getFplPlayerMap();
      const byPosition: Record<string, string[]> = { GK: [], DEF: [], MID: [], FWD: [] };
      (squadRows ?? []).forEach((row) => {
        const info = infoMap[row.fpl_player_id];
        const pos = info?.position && byPosition[info.position] ? info.position : "FWD";
        byPosition[pos].push(info?.name ?? `Unknown (id ${row.fpl_player_id})`);
      });
      Object.keys(byPosition).forEach((pos) => byPosition[pos].sort());
      setGrouped(byPosition);
      setTransfers(transferRows ?? []);
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
    <div style={{ padding: "0.75rem 0 1rem 1rem" }}>
      <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
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

      {transfers.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <p style={{ fontSize: "0.75rem", opacity: 0.6, marginBottom: "0.3rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Transfers
          </p>
          {transfers.map((t, i) => (
            <p key={i} style={{ fontSize: "0.85rem", opacity: 0.75, margin: "0.2rem 0" }}>
              <strong>{t.window_label}:</strong> {t.summary}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}