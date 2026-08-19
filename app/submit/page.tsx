"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type LeagueSettings = { current_gameweek: number; deadline: string };

const inputStyle = {
  padding: "0.5rem",
  marginTop: "0.3rem",
  borderRadius: 6,
  border: "1px solid #333",
  background: "#161b22",
  color: "#e6edf3",
};

export default function SubmitPage() {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [settings, setSettings] = useState<LeagueSettings | null>(null);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [lastSubmitted, setLastSubmitted] = useState<string | null>(null);
  const [startingXi, setStartingXi] = useState("");
  const [captainId, setCaptainId] = useState("");
  const [status, setStatus] = useState
    "idle" | "saving" | "saved" | "error"
  >("idle");
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

      if (player && settingsData) {
        const { data: entry } = await supabase
          .from("entries")
          .select("id")
          .eq("player_id", player.id)
          .maybeSingle();

        if (entry) {
          setEntryId(entry.id);
          const { data: existing } = await supabase
            .from("lineups")
            .select("submitted_at, starting_xi, captain_id")
            .eq("entry_id", entry.id)
            .eq("gameweek", settingsData.current_gameweek)
            .maybeSingle();

          if (existing) {
            setLastSubmitted(existing.submitted_at);
            setStartingXi((existing.starting_xi ?? []).join(", "));
            setCaptainId(
              existing.captain_id ? String(existing.captain_id) : ""
            );
          }
        }
      }
      setLoading(false);
    };
    load();
  }, []);

  const deadlinePassed = settings
    ? new Date() > new Date(settings.deadline)
    : false;

  const submit = async () => {
    if (!entryId || !settings || deadlinePassed) return;
    setStatus("saving");

    const xiArray = startingXi
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));

    const { error } = await supabase.from("lineups").upsert(
      {
        entry_id: entryId,
        gameweek: settings.current_gameweek,
        starting_xi: xiArray,
        captain_id: captainId ? parseInt(captainId, 10) : null,
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

  if (loading) {
    return (
      <main>
        <p>Loading…</p>
      </main>
    );
  }

  if (!email) {
    return (
      <main>
        <h1>Submit your lineup</h1>
        <p>You need to be logged in to submit a lineup.</p>
        <a href="/login" style={{ color: "#58a6ff" }}>
          Go to login
        </a>
      </main>
    );
  }

  if (!entryId) {
    return (
      <main>
        <h1>Submit your lineup</h1>
        <p>
          We couldn't find a league entry linked to {email}. Check with the
          league admin.
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1>Submit your lineup</h1>
      {settings && (
        <p style={{ opacity: 0.7 }}>
          Gameweek {settings.current_gameweek} — deadline{" "}
          {new Date(settings.deadline).toLocaleString()}
        </p>
      )}
      {lastSubmitted && (
        <p style={{ opacity: 0.7 }}>
          Last submitted: {new Date(lastSubmitted).toLocaleString()}
        </p>
      )}
      {deadlinePassed && (
        <p style={{ color: "#f85149" }}>
          Deadline has passed — submissions are locked.
        </p>
      )}

      <label style={{ display: "block", marginTop: "1rem" }}>
        Starting XI (comma-separated FPL player IDs — for testing, any
        numbers work)
      </label>
      <input
        type="text"
        value={startingXi}
        onChange={(e) => setStartingXi(e.target.value)}
        disabled={deadlinePassed}
        style={{ ...inputStyle, width: "100%", maxWidth: 480 }}
      />

      <label style={{ display: "block", marginTop: "1rem" }}>
        Captain (FPL player ID)
      </label>
      <input
        type="text"
        value={captainId}
        onChange={(e) => setCaptainId(e.target.value)}
        disabled={deadlinePassed}
        style={{ ...inputStyle, width: 160 }}
      />

      <br />
      <button
        onClick={submit}
        disabled={deadlinePassed || status === "saving"}
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
      {status === "error" && (
        <p style={{ color: "#f85149" }}>Something went wrong — try again.</p>
      )}
    </main>
  );
}