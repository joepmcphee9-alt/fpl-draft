"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type LeagueSettings = { current_gameweek: number; deadline: string };
type SquadPlayer = { id: number; name: string };

const inputStyle = {
  padding: "0.5rem",
  marginTop: "0.3rem",
  borderRadius: 6,
  border: "1px solid #333",
  background: "#161b22",
  color: "#e6edf3",
};

async function getFplPlayerMap(): Promise<Record<number, string>> {
  const res = await fetch("/api/fpl-players");
  return res.json();
}

export default function SubmitPage() {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [settings, setSettings] = useState<LeagueSettings | null>(null);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [captainId, setCaptainId] = useState<number | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<number | null>(null);
  const [lastSubmitted, setLastSubmitted] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userEmail = sessionData.session?.user.email ?? null;
      setEmail(userEmail);
      if (!userEmail) {
        setLoading(false);
        return;
      }

      const { data: settingsData } = await supabase
        .from("league_settings")
        .select("current_gameweek, deadline")
        .maybeSingle();
      setSettings(settingsData);

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
        .select("id")
        .eq("player_id", player.id)
        .maybeSingle();
      if (!entry) {
        setLoading(false);
        return;
      }
      setEntryId(entry.id);

      const { data: squadRows } = await supabase
        .from("squad_players")
        .select("fpl_player_id")
        .eq("entry_id", entry.id);

      const nameMap = await getFplPlayerMap();
      const squadList = (squadRows ?? [])
        .map((r) => ({ id: r.fpl_player_id, name: nameMap[r.fpl_player_id] ?? `Unknown (id ${r.fpl_player_id})` }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setSquad(squadList);

      if (settingsData) {
        const { data: existing } = await supabase
          .from("lineups")
          .select("submitted_at, starting_xi, captain_id, vice_captain_id")
          .eq("entry_id", entry.id)
          .eq("gameweek", settingsData.current_gameweek)
          .maybeSingle();

        if (existing) {
          setLastSubmitted(existing.submitted_at);
          setSelected(new Set(existing.starting_xi ?? []));
          setCaptainId(existing.captain_id ?? null);
          setViceCaptainId(existing.vice_captain_id ?? null);
        }
      }

      setLoading(false);
    };
    load();
  }, []);

  const deadlinePassed = settings ? new Date() > new Date(settings.deadline) : false;

  const togglePlayer = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (captainId === id) setCaptainId(null);
        if (viceCaptainId === id) setViceCaptainId(null);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const submit = async () => {
    if (!entryId || !settings || deadlinePassed) return;
    setStatus("saving");

    const { error } = await supabase.from("lineups").upsert(
      {
        entry_id: entryId,
        gameweek: settings.current_gameweek,
        starting_xi: Array.from(selected),
        captain_id: captainId,
        vice_captain_id: viceCaptainId,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "entry_id,gameweek" }
    );

    if (error) {
      console.error(error);
      setStatus("error");
    } else {
      setStatus("saved");
      setLastSubmitted(new Date().toISOString());
    }
  };

  if (loading) return <main><p>Loading…</p></main>;

  if (!email) {
    return (
      <main>
        <h1>Submit your lineup</h1>
        <p>You need to be logged in to submit a lineup.</p>
        <a href="/login" style={{ color: "#58a6ff" }}>Go to login</a>
      </main>
    );
  }

  if (!entryId) {
    return (
      <main>
        <h1>Submit your lineup</h1>
        <p>We couldn't find a league entry linked to {email}. Check with the league admin.</p>
      </main>
    );
  }

  if (squad.length === 0) {
    return (
      <main>
        <h1>Submit your lineup</h1>
        <p style={{ opacity: 0.6 }}>No squad loaded yet — check back once the draft's been entered.</p>
      </main>
    );
  }

  const selectedPlayers = squad.filter((p) => selected.has(p.id));

  return (
    <main>
      <h1>Submit your lineup</h1>
      {settings && (
        <p style={{ opacity: 0.7 }}>
          Gameweek {settings.current_gameweek} — deadline {new Date(settings.deadline).toLocaleString()}
        </p>
      )}
      {lastSubmitted && (
        <p style={{ opacity: 0.7 }}>Last submitted: {new Date(lastSubmitted).toLocaleString()}</p>
      )}
      {deadlinePassed && (
        <p style={{ color: "#f85149" }}>Deadline has passed — submissions are locked.</p>
      )}

      <p style={{ marginTop: "1.5rem", marginBottom: "0.5rem" }}>
        Tick who's starting ({selected.size} selected):
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxWidth: 400 }}>
        {squad.map((p) => (
          <label key={p.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="checkbox"
              checked={selected.has(p.id)}
              disabled={deadlinePassed}
              onChange={() => togglePlayer(p.id)}
            />
            {p.name}
          </label>
        ))}
      </div>

      <label style={{ display: "block", marginTop: "1.5rem" }}>Captain</label>
      <select
        value={captainId ?? ""}
        disabled={deadlinePassed || selectedPlayers.length === 0}
        onChange={(e) => setCaptainId(e.target.value ? Number(e.target.value) : null)}
        style={{ ...inputStyle, width: 240 }}
      >
        <option value="">— choose captain —</option>
        {selectedPlayers.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      <label style={{ display: "block", marginTop: "1rem" }}>Vice-captain</label>
      <select
        value={viceCaptainId ?? ""}
        disabled={deadlinePassed || selectedPlayers.length === 0}
        onChange={(e) => setViceCaptainId(e.target.value ? Number(e.target.value) : null)}
        style={{ ...inputStyle, width: 240 }}
      >
        <option value="">— choose vice-captain —</option>
        {selectedPlayers
          .filter((p) => p.id !== captainId)
          .map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
      </select>

      <br />
      <button
        onClick={submit}
        disabled={deadlinePassed || status === "saving" || selected.size === 0}
        style={{
          marginTop: "1.5rem",
          padding: "0.6rem 1.2rem",
          background: "#238636",
          color: "white",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
        }}
      >
        {status === "saving" ? "Saving…" : "Submit lineup"}
      </button>
      {status === "saved" && <p style={{ color: "#3fb950" }}>Saved!</p>}
      {status === "error" && <p style={{ color: "#f85149" }}>Something went wrong — try again.</p>}
    </main>
  );
}