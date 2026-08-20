"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// Lightweight UI-only guard — not full security on its own, paired with a
// matching database policy below.
const ADMIN_EMAILS = ["joepmcphee9@gmail.com", "dan_cooper910@hotmail.com", "andrewghammache@gmail.com"];

const inputStyle = {
  padding: "0.5rem",
  marginTop: "0.3rem",
  borderRadius: 6,
  border: "1px solid #333",
  background: "#161b22",
  color: "#e6edf3",
};

export default function AdminPage() {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [gameweek, setGameweek] = useState("");
  const [deadline, setDeadline] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      setEmail(data.session?.user.email ?? null);

      const { data: settings } = await supabase
        .from("league_settings")
        .select("current_gameweek, deadline")
        .maybeSingle();

      if (settings) {
        setGameweek(String(settings.current_gameweek));
        setDeadline(new Date(settings.deadline).toISOString().slice(0, 16));
      }
      setLoading(false);
    };
    load();
  }, []);

  const save = async () => {
    setStatus("saving");
    const { error } = await supabase
      .from("league_settings")
      .update({
        current_gameweek: parseInt(gameweek, 10),
        deadline: new Date(deadline).toISOString(),
      })
      .eq("id", true);

    setStatus(error ? "error" : "saved");
  };

  if (loading) {
    return (
      <main>
        <p>Loading…</p>
      </main>
    );
  }

  if (!ADMIN_EMAILS.includes(email ?? "")) {
    return (
      <main>
        <h1>Admin</h1>
        <p>This page is only for the league admin.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Admin — league settings</h1>

      <label style={{ display: "block", marginTop: "1rem" }}>
        Current gameweek
      </label>
      <input
        type="number"
        value={gameweek}
        onChange={(e) => setGameweek(e.target.value)}
        style={{ ...inputStyle, width: 120 }}
      />

      <label style={{ display: "block", marginTop: "1rem" }}>Deadline</label>
      <input
        type="datetime-local"
        value={deadline}
        onChange={(e) => setDeadline(e.target.value)}
        style={inputStyle}
      />

      <br />
      <button
        onClick={save}
        disabled={status === "saving"}
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
        {status === "saving" ? "Saving…" : "Save"}
      </button>
      {status === "saved" && <p style={{ color: "#3fb950" }}>Saved!</p>}
      {status === "error" && (
        <p style={{ color: "#f85149" }}>Something went wrong.</p>
      )}
        <p style={{ marginTop: "2rem" }}>
        <a href="/admin/submissions" style={{ color: "#58a6ff" }}>View submissions →</a>
        </p>
    </main>
  );
}