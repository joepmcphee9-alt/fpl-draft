"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type PlayerLookup = Record<number, { name: string; position: string }>;

async function getFplPlayers(): Promise<PlayerLookup> {
  const res = await fetch("/api/fpl-players");
  const players = await res.json();
  const map: PlayerLookup = {};
  players.forEach((p: any) => {
    map[p.id] = { name: p.name, position: p.position };
  });
  return map;
}

type Side = {
  entryId: string;
  managerName: string;
  score: number | null;
  startingXi: number[];
  captainId: number | null;
  viceCaptainId: number | null;
};

export default function MatchupPage() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [gameweek, setGameweek] = useState<number | null>(null);
  const [playerMap, setPlayerMap] = useState<PlayerLookup>({});
  const [me, setMe] = useState<Side | null>(null);
  const [opponent, setOpponent] = useState<Side | null>(null);
  const [isBye, setIsBye] = useState(false);
  const [noFixture, setNoFixture] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userEmail = sessionData.session?.user.email ?? null;
      setEmail(userEmail);
      if (!userEmail) {
        setLoading(false);
        return;
      }

      const { data: settings } = await supabase
        .from("league_settings")
        .select("current_gameweek")
        .maybeSingle();
      const gw = settings?.current_gameweek ?? 1;
      setGameweek(gw);

      const { data: player } = await supabase
        .from("players")
        .select("id")
        .eq("email", userEmail)
        .maybeSingle();
      if (!player) {
        setLoading(false);
        return;
      }

      const { data: entry } = await supabase
        .from("entries")
        .select("id, players(name)")
        .eq("player_id", player.id)
        .maybeSingle();
      if (!entry) {
        setLoading(false);
        return;
      }

      const { data: fixture } = await supabase
        .from("fixtures")
        .select("home_entry_id, away_entry_id, is_bye")
        .eq("gameweek", gw)
        .or(`home_entry_id.eq.${entry.id},away_entry_id.eq.${entry.id}`)
        .maybeSingle();

      if (!fixture) {
        setNoFixture(true);
        setLoading(false);
        return;
      }

      if (fixture.is_bye) {
        setIsBye(true);
        setLoading(false);
        return;
      }

      const opponentEntryId =
        fixture.home_entry_id === entry.id ? fixture.away_entry_id : fixture.home_entry_id;

      const [myLineup, oppLineup, myEntryInfo, oppEntryInfo, scores, players] = await Promise.all([
        supabase
          .from("lineups")
          .select("starting_xi, captain_id, vice_captain_id")
          .eq("entry_id", entry.id)
          .eq("gameweek", gw)
          .maybeSingle(),
        opponentEntryId
          ? supabase
              .from("lineups")
              .select("starting_xi, captain_id, vice_captain_id")
              .eq("entry_id", opponentEntryId)
              .eq("gameweek", gw)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        Promise.resolve({ data: entry }),
        opponentEntryId
          ? supabase.from("entries").select("id, players(name)").eq("id", opponentEntryId).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from("entry_scores").select("entry_id, points").eq("gameweek", gw),
        getFplPlayers(),
      ]);

      setPlayerMap(players);

      const scoreMap: Record<string, number> = {};
      (scores.data ?? []).forEach((r: any) => (scoreMap[r.entry_id] = r.points));

      const myName = (myEntryInfo.data as any)?.players?.name ?? "You";
      const oppName = (oppEntryInfo.data as any)?.players?.name ?? "Opponent";

      setMe({
        entryId: entry.id,
        managerName: myName,
        score: scoreMap[entry.id] ?? null,
        startingXi: myLineup.data?.starting_xi ?? [],
        captainId: myLineup.data?.captain_id ?? null,
        viceCaptainId: myLineup.data?.vice_captain_id ?? null,
      });

      if (opponentEntryId) {
        setOpponent({
          entryId: opponentEntryId,
          managerName: oppName,
          score: scoreMap[opponentEntryId] ?? null,
          startingXi: oppLineup.data?.starting_xi ?? [],
          captainId: oppLineup.data?.captain_id ?? null,
          viceCaptainId: oppLineup.data?.vice_captain_id ?? null,
        });
      }

      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <main><p>Loading…</p></main>;

  if (!email) {
    return (
      <main>
        <h1>My matchup</h1>
        <p>You need to be logged in to view this.</p>
        <a href="/login" style={{ color: "#58a6ff" }}>Go to login</a>
      </main>
    );
  }

  if (noFixture) {
    return (
      <main>
        <h1>My matchup</h1>
        <p style={{ opacity: 0.6 }}>No fixture found for you this gameweek.</p>
      </main>
    );
  }

  if (isBye) {
    return (
      <main>
        <h1>My matchup — Gameweek {gameweek}</h1>
        <p style={{ opacity: 0.7 }}>You've got a bye this week.</p>
      </main>
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
          <div style={{ fontSize: "0.9rem", opacity: 0.85 }}>
            {side.startingXi.map((id) => {
              const info = playerMap[id];
              const tag = id === side.captainId ? " (C)" : id === side.viceCaptainId ? " (VC)" : "";
              return <div key={id}>{info?.name ?? `id ${id}`}{tag}</div>;
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <main>
      <h1>My matchup — Gameweek {gameweek}</h1>
      <div style={{ display: "flex", gap: "2rem", marginTop: "1.5rem" }}>
        {renderSide(me)}
        {renderSide(opponent)}
      </div>
    </main>
  );
}