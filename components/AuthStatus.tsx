"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthStatus() {
  const [email, setEmail] = useState<string | null | undefined>(undefined); // undefined = still loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const logOut = async () => {
    await supabase.auth.signOut();
  };

  const barStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.5rem 0 1rem",
    fontSize: "0.9rem",
    opacity: 0.85,
  };

  if (email === undefined) {
    return <div style={barStyle} />;
  }

  if (email) {
    return (
      <div style={barStyle}>
        <span>Logged in as {email}</span>
        <button
          onClick={logOut}
          style={{
            background: "none",
            border: "1px solid #333",
            color: "#e6edf3",
            borderRadius: 6,
            padding: "0.3rem 0.7rem",
            cursor: "pointer",
          }}
        >
          Log out
        </button>
      </div>
    );
  }

  return (
    <div style={barStyle}>
      <a href="/login" style={{ color: "#58a6ff" }}>
        Log in
      </a>
    </div>
  );
}