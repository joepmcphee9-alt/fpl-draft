"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type LeagueSettings = { current_gameweek: number; deadline: string };
type SquadPlayer = { id: number; name: string; position: string };

const inputStyle = {
  padding: "0.5rem",
  marginTop: "0.3rem",
  borderRadius: 6,
  border: "1px solid #333",
  background: "#161b22",
  color: "#e6edf3",
};

const POSITION_ORDER = ["GK", "DEF", "MID", "FWD"];
const MAX_STARTERS = 11;
const BENCH_SIZE = 7;
const VALID_FORMATIONS = ["3-4-3", "3-5-2", "4-4-2", "4-3-3", "4-5-1", "5-4-1", "5-3-2", "5-2-3"];

async function getFplPlayers(): Promise<Record<number, { name: string; position: string }>> {
  const res = await fetch("/api/fpl-players");
  const players = await res.json();
  const map: Record<number, { name: string; position: string }> = {};
  players.forEach((p: any) => {
    map[p.id] = { name: p.name, position: p.position };
  });
  return map;
}

export default function SubmitPage() {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [settings, setSettings] = useState<LeagueSettings | null>(null);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [benchOrder, setBenchOrder] = useState<(number | null)[]>(Array(BENCH_SIZE).fill(null));
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

      const playerMap = await getFplPlayers();
      const squadList = (squadRows ?? [])
        .map((r) => {
          const info = playerMap[r.fpl_player_id];
          return {
            id: r.fpl_player_id,
            name: info?.name ?? `Unknown (id ${r.fpl_player_id})`,
            position: info?.position ?? "UNK",
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      setSquad(squadList);

      if (settingsData) {
        const { data: existing } = await supabase
          .from("lineups")
          .select("submitted_at, starting_xi, captain_id, vice_captain_id, bench_order")
          .eq("entry_id", entry.id)
          .eq("gameweek", settingsData.current_gameweek)
          .maybeSingle();

        if (existing) {
          setLastSubmitted(existing.submitted_at);
          setSelected(new Set(existing.starting_xi ?? []));
          setCaptainId(existing.captain_id ?? null);
          setViceCaptainId(existing.vice_captain_id ?? null);
          if (existing.bench_order?.length) {
            const padded = [...existing.bench_order];
            while (padded.length < BENCH_SIZE) padded.push(null);
            setBenchOrder(padded);
          }
        }
      }

      setLoading(false);
    };
    load();
  }, []);

  const deadlinePassed = settings ? new Date() > new Date(settings.deadline) : false;

  const gkCount = squad.filter((p) => selected.has(p.id) && p.position === "GK").length;
  const defCount = squad.filter((p) => selected.has(p.id) && p.position === "DEF").length;
  const midCount = squad.filter((p) => selected.has(p.id) && p.position === "MID").length;
  const fwdCount = squad.filter((p) => selected.has(p.id) && p.position === "FWD").length;
  const formationStr = `${defCount}-${midCount}-${fwdCount}`;
  const isValidFormation =
    selected.size === MAX_STARTERS && gkCount === 1 && VALID_FORMATIONS.includes(formationStr);

  const togglePlayer = (player: SquadPlayer) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(player.id)) {
        next.delete(player.id);
        if (captainId === player.id) setCaptainId(null);
        if (viceCaptainId === player.id) setViceCaptainId(null);
        setBenchOrder((b) => b.map((id) => (id === player.id ? null : id)));
      } else {
        if (next.size >= MAX_STARTERS) return prev; // full
        if (player.position === "GK" && gkCount >= 1) return prev; // only 1 GK starts
        next.add(player.id);
        setBenchOrder((b) => b.map((id) => (id === player.id ? null : id)));
      }
      return next;
    });
  };

  const setBenchSlot = (slotIndex: number, playerId: number | null) => {
    setBenchOrder((prev) => {
      const next = [...prev];
      // clear this player from any other slot first
      for (let i = 0; i < next.length; i++) {
        if (next[i] === playerId) next[i] = null;
      }
      next[slotIndex] = playerId;
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
        bench_order: benchOrder,
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
  const benchEligible = squad.filter((p) => !selected.has(p.id));
  const benchUsedElsewhere = (slotIndex: number, playerId: number) =>
    benchOrder.some((id, i) => id === playerId && i !== slotIndex);

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
        Starting XI ({selected.size} / {MAX_STARTERS} — exactly 1 GK):
      </p>
      <p style={{ marginBottom: "1rem" }}>
        Formation: <strong>{defCount}-{midCount}-{fwdCount}</strong>{" "}
        {selected.size === MAX_STARTERS && gkCount === 1 && (
          isValidFormation ? (
            <span style={{ color: "#3fb950" }}>✓ valid</span>
          ) : (
            <span style={{ color: "#f85149" }}>
              ✗ not a valid formation — needs to be one of: {VALID_FORMATIONS.join(", ")}
            </span>
          )
        )}
      </p>

      {POSITION_ORDER.map((pos) => {
        const posPlayers = squad.filter((p) => p.position === pos);
        if (posPlayers.length === 0) return null;
        return (
          <div key={pos} style={{ marginBottom: "1rem" }}>
            <p style={{ opacity: 0.6, fontSize: "0.8rem", marginBottom: "0.3rem" }}>{pos}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", maxWidth: 400 }}>
              {posPlayers.map((p) => {
                const isChecked = selected.has(p.id);
                const wouldExceedMax = !isChecked && selected.size >= MAX_STARTERS;
                const wouldExceedGk = !isChecked && p.position === "GK" && gkCount >= 1;
                return (
                  <label key={p.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", opacity: wouldExceedMax || wouldExceedGk ? 0.4 : 1 }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={deadlinePassed || wouldExceedMax || wouldExceedGk}
                      onChange={() => togglePlayer(p)}
                    />
                    {p.name}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}

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

      <p style={{ marginTop: "2rem", marginBottom: "0.5rem" }}>
        Bench, in order (1st sub off first):
      </p>
      {benchOrder.map((slotValue, i) => (
        <div key={i} style={{ marginBottom: "0.4rem" }}>
          <label style={{ marginRight: "0.5rem", opacity: 0.7 }}>{i + 1}.</label>
          <select
            value={slotValue ?? ""}
            disabled={deadlinePassed}
            onChange={(e) => setBenchSlot(i, e.target.value ? Number(e.target.value) : null)}
            style={{ ...inputStyle, width: 240 }}
          >
            <option value="">— empty —</option>
            {benchEligible
              .filter((p) => !benchUsedElsewhere(i, p.id))
              .map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.position})</option>
              ))}
          </select>
        </div>
      ))}

      <br />
      <button
        onClick={submit}
        disabled={deadlinePassed || status === "saving" || !isValidFormation}
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