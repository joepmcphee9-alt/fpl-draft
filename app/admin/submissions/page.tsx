"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const ADMIN_EMAILS = ["joepmcphee9@gmail.com", "dan_cooper910@hotmail.com", "andrewghammache@gmail.com"];

const divisionNames: Record<number, string> = {
  1: "The Andy McPhee League",
  2: "Division 2",
  3: "Division 3",
};

type Row = {
  entryId: string;
  managerName: string;
  division: number;
  submittedAt: string | null;
};

export default function SubmissionsPage() {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [gameweek, setGameweek] = useState<number | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userEmail = sessionData.session?.user.email ?? null;
      setEmail(userEmail);

      if (!userEmail || !ADMIN_EMAILS.includes(userEmail)) {
        setLoading(false);
        return;
      }

      const { data: settings } = await supabase
        .from("league_settings")
        .select("current_gameweek")
        .maybeSingle();
      const gw = settings?.current_gameweek ?? 1;
      setGameweek(gw);

      const { data: entries } = await supabase
        .from("entries")
        .select("id, division, players(name, email)")
        .order("division", { ascending: true });

      // Exclude memorial/non-playing entries (no email on file — they were
      // never set up to log in or submit) from the submissions tracker.
      const playingEntries = (entries ?? []).filter((e: any) => e.players?.email);

      const { data: lineups } = await supabase
        .from("lineups")
        .select("entry_id, submitted_at")
        .eq("gameweek", gw);

      const submittedMap: Record<string, string> = {};
      (lineups ?? []).forEach((l) => {
        submittedMap[l.entry_id] = l.submitted_at;
      });

      const built: Row[] = playingEntries.map((e: any) => ({
        entryId: e.id,
        managerName: e.players?.name ?? "Unknown",
        division: e.division,
        submittedAt: submittedMap[e.id] ?? null,
      }));

      // Not-submitted first within each division, then most recent first
      built.sort((a, b) => {
        if (a.division !== b.division) return a.division - b.division;
        if (!a.submittedAt && b.submittedAt) return -1;
        if (a.submittedAt && !b.submittedAt) return 1;
        if (!a.submittedAt && !b.submittedAt) return 0;
        return new Date(b.submittedAt!).getTime() - new Date(a.submittedAt!).getTime();
      });

      setRows(built);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <main><p>Loading…</p></main>;

  if (!email || !ADMIN_EMAILS.includes(email)) {
    return (
      <main>
        <h1>Submissions</h1>
        <p>This page is only for the league admin.</p>
      </main>
    );
  }

  const divisions = [1, 2, 3];
  const notSubmittedCount = rows.filter((r) => !r.submittedAt).length;

  return (
    <main>
      <h1>Submissions — Gameweek {gameweek}</h1>
      <p style={{ opacity: 0.7, marginBottom: "1.5rem" }}>
        {notSubmittedCount === 0
          ? "Everyone has submitted."
          : `${notSubmittedCount} manager(s) haven't submitted yet.`}
      </p>

      {divisions.map((div) => {
        const divRows = rows.filter((r) => r.division === div);
        return (
          <section key={div} style={{ marginTop: "2rem" }}>
            <h2>{divisionNames[div]}</h2>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "0.5rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #333" }}>
                  <th style={{ padding: "0.5rem 0" }}>Manager</th>
                  <th>Last submitted</th>
                </tr>
              </thead>
              <tbody>
                {divRows.map((r) => (
                  <tr key={r.entryId} style={{ borderBottom: "1px solid #1c2530" }}>
                    <td style={{ padding: "0.5rem 0" }}>{r.managerName}</td>
                    <td>
                      {r.submittedAt ? (
                        new Date(r.submittedAt).toLocaleString()
                      ) : (
                        <span style={{ color: "#f85149" }}>Not submitted</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </main>
  );
}