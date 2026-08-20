"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import MatchupView from "@/components/MatchupView";

export default function MyMatchupPage() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [fixtureId, setFixtureId] = useState<string | null>(null);
  const [noFixture, setNoFixture] = useState(false);
  const [gameweek, setGameweek] = useState<number | null>(null);

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
        .select("id")
        .eq("player_id", player.id)
        .maybeSingle();
      if (!entry) {
        setLoading(false);
        return;
      }

      const { data: fixture } = await supabase
        .from("fixtures")
        .select("id")
        .eq("gameweek", gw)
        .or(`home_entry_id.eq.${entry.id},away_entry_id.eq.${entry.id}`)
        .maybeSingle();

      if (!fixture) {
        setNoFixture(true);
      } else {
        setFixtureId(fixture.id);
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

  if (noFixture || !fixtureId) {
    return (
      <main>
        <h1>My matchup</h1>
        <p style={{ opacity: 0.6 }}>No fixture found for you this gameweek.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>My matchup — Gameweek {gameweek}</h1>
      <p style={{ marginBottom: "1.5rem" }}>
        <a href="/fixtures" style={{ color: "#58a6ff" }}>See all this gameweek's matches →</a>
      </p>
      <MatchupView fixtureId={fixtureId} />
    </main>
  );
}