"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );

  const sendMagicLink = async () => {
    setStatus("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setStatus(error ? "error" : "sent");
  };

  return (
    <main>
      <h1>Log in</h1>
      <p style={{ opacity: 0.7 }}>
        Enter the email address you used to join the league — we'll send you
        a login link.
      </p>

      {status === "sent" ? (
        <p style={{ marginTop: "1rem" }}>
          Check your inbox — click the link we just sent to log in.
        </p>
      ) : (
        <>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{
              marginTop: "1rem",
              padding: "0.6rem",
              fontSize: "1rem",
              width: "100%",
              maxWidth: 320,
              borderRadius: 6,
              border: "1px solid #333",
              background: "#161b22",
              color: "#e6edf3",
            }}
          />
          <br />
          <button
            onClick={sendMagicLink}
            disabled={!email || status === "sending"}
            style={{
              marginTop: "1rem",
              padding: "0.6rem 1.2rem",
              background: "#238636",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            {status === "sending" ? "Sending…" : "Send login link"}
          </button>
          {status === "error" && (
            <p style={{ color: "#f85149", marginTop: "0.5rem" }}>
              Something went wrong sending that — try again.
            </p>
          )}
        </>
      )}
    </main>
  );
}
