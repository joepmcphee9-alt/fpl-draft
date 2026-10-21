import { supabase } from "@/lib/supabaseClient";
import { firstKickoffs, fplJson } from "@/lib/fpl";
import { DIVISIONS, DIVISION_NAMES, LeagueRow, bandFor, computeStandings, loadLeagueData } from "@/lib/leagueTable";
import { gameweekMonthsFromEvents, getMonthTotals } from "@/lib/mom";
import { getCupFixtures } from "@/lib/michuCup";

export const SITE_URL = "https://fpl-fantasy-draft.vercel.app";

export type ResultsEmail = { gameweek: number; subject: string; html: string; text: string };

// Builds the end-of-gameweek results email. The site and the email both use
// this, so the email always matches what the site shows.
export async function buildResultsEmail(gameweek: number): Promise<ResultsEmail> {
  const [bootstrap, league, cup, settingsRes, kickoffs] = await Promise.all([
    fplJson("bootstrap-static/"),
    loadLeagueData(),
    getCupFixtures(),
    supabase.from("league_settings").select("current_gameweek, deadline").maybeSingle(),
    firstKickoffs(),
  ]);

  const nameOf: Record<string, string> = {};
  league.entries.forEach((e) => (nameOf[e.id] = e.name));
  const score = (entryId: string) => league.scores[`${entryId}:${gameweek}`];

  // ---- Division results, top scores and tables ----
  const after = computeStandings(league, (gw) => gw <= gameweek);
  const before = gameweek > 1 ? computeStandings(league, (gw) => gw <= gameweek - 1) : null;

  const divisions = DIVISIONS.map((div) => {
    const fixtures = league.fixtures.filter((f) => f.division === div && f.gameweek === gameweek);
    const matches = fixtures
      .filter((f) => !f.is_bye && f.away_entry_id)
      .map((f) => ({
        home: nameOf[f.home_entry_id] ?? "—",
        away: nameOf[f.away_entry_id!] ?? "—",
        homeScore: score(f.home_entry_id),
        awayScore: score(f.away_entry_id!),
      }));
    const byes = fixtures
      .filter((f) => f.is_bye || !f.away_entry_id)
      .map((f) => ({ name: nameOf[f.home_entry_id] ?? "—", score: score(f.home_entry_id) }));

    const divEntries = league.entries.filter((e) => e.division === div);
    const weekScores = divEntries
      .map((e) => ({ name: e.name, points: score(e.id) }))
      .filter((s) => s.points != null) as { name: string; points: number }[];
    const best = weekScores.length ? Math.max(...weekScores.map((s) => s.points)) : null;
    const topScorers = best == null ? [] : weekScores.filter((s) => s.points === best).map((s) => s.name);

    const prevPos: Record<string, number> = {};
    (before?.[div] ?? []).forEach((r, i) => (prevPos[r.entryId] = i + 1));
    const table = (after[div] ?? []).map((r, i) => ({
      ...r,
      pos: i + 1,
      moved: before ? prevPos[r.entryId] - (i + 1) : null,
      band: bandFor(div, i + 1),
    }));

    return { div, name: DIVISION_NAMES[div], matches, byes, topScore: best, topScorers, table };
  });

  // ---- Michu Cup ----
  const cupMatches = cup.fixtures.filter((f) => f.gameweek === gameweek && f.away);
  const cupGroups = Array.from(new Set(cupMatches.map((f) => f.group))).sort((a, b) => a - b);

  // ---- Manager of the Month ----
  const months = gameweekMonthsFromEvents(bootstrap.events);
  const thisMonth = months.find((m) => m.gameweek === gameweek);
  const monthGws = thisMonth ? months.filter((m) => m.monthKey === thisMonth.monthKey).map((m) => m.gameweek) : [];
  const countedGws = monthGws.filter((gw) => gw <= gameweek);
  const isFinalMomWeek = monthGws.length > 0 && gameweek === Math.max(...monthGws);
  const momTotals = await getMonthTotals(countedGws);
  const mom = DIVISIONS.map((div) => {
    const sorted = momTotals.filter((t) => t.division === div).sort((a, b) => b.total - a.total);
    const top = sorted[0]?.total;
    return {
      div,
      name: DIVISION_NAMES[div],
      topThree: sorted.slice(0, 3),
      winners: top != null ? sorted.filter((t) => t.total === top).map((t) => t.managerName) : [],
    };
  });

  // ---- Next deadline ----
  // The league's deadline is the first kick-off of the gameweek. Use the one
  // set on the admin page if the next gameweek is already set up there.
  const nextGw = gameweek + 1;
  const settings = settingsRes.data;
  const deadlineIso =
    settings?.current_gameweek === nextGw && settings?.deadline ? settings.deadline : kickoffs[nextGw] ?? null;
  const deadlineText = deadlineIso
    ? new Date(deadlineIso)
        .toLocaleString("en-GB", {
          timeZone: "Europe/London",
          weekday: "long",
          day: "numeric",
          month: "long",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
        .replace(" at ", ", ")
        .replace(/\s(am|pm)$/i, "$1")
    : null;

  // ---- Render ----
  const subject = `GW${gameweek} RESULTS`;
  const html = renderHtml({
    gameweek,
    divisions,
    cupMatches,
    cupGroups,
    mom,
    momLabel: thisMonth?.monthLabel ?? "",
    momProgress: `${countedGws.length} of ${monthGws.length}`,
    isFinalMomWeek,
    nextGw,
    deadlineText,
  });
  const text = renderText({
    gameweek,
    divisions,
    cupMatches,
    mom,
    momLabel: thisMonth?.monthLabel ?? "",
    isFinalMomWeek,
    nextGw,
    deadlineText,
  });

  return { gameweek, subject, html, text };
}

// ------------------------------------------------------------------
// HTML (inline styles only — email apps ignore stylesheets)
// ------------------------------------------------------------------

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const C = {
  text: "#1f2328",
  muted: "#656d76",
  line: "#e5e7eb",
  win: "#1a7f37",
  lose: "#cf222e",
  gold: "#d4a72c",
  green: "#2da44e",
  red: "#cf222e",
  accent: "#0969da",
};

const td = (content: string, style = "") =>
  `<td style="padding:6px 6px;border-bottom:1px solid ${C.line};${style}">${content}</td>`;
const th = (content: string, style = "") =>
  `<th style="padding:6px 6px;border-bottom:2px solid ${C.line};font-size:12px;color:${C.muted};font-weight:600;${style}">${content}</th>`;
const h2 = (t: string) =>
  `<h2 style="font-size:18px;margin:28px 0 8px;color:${C.text};">${t}</h2>`;
const h3 = (t: string) =>
  `<h3 style="font-size:14px;margin:16px 0 6px;color:${C.muted};text-transform:uppercase;letter-spacing:0.04em;">${t}</h3>`;
const tableOpen = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">`;

function scoreLine(home: string, away: string, hs?: number, as?: number) {
  const done = hs != null && as != null;
  const hw = done && hs! > as!;
  const aw = done && as! > hs!;
  return `<tr>
    ${td(esc(home), `text-align:right;width:42%;${hw ? "font-weight:700;" : ""}`)}
    ${td(done ? `${hs} – ${as}` : "v", "text-align:center;white-space:nowrap;font-variant-numeric:tabular-nums;")}
    ${td(esc(away), `width:42%;${aw ? "font-weight:700;" : ""}`)}
  </tr>`;
}

function movement(moved: number | null) {
  if (moved == null) return "";
  if (moved > 0) return `<span style="color:${C.win};">▲${moved}</span>`;
  if (moved < 0) return `<span style="color:${C.lose};">▼${-moved}</span>`;
  return `<span style="color:${C.muted};">–</span>`;
}

function standingsTable(rows: (LeagueRow & { pos: number; moved: number | null; band: string | null })[]) {
  const bandColor: Record<string, string> = { gold: C.gold, green: C.green, red: C.red };
  const showMove = rows.some((r) => r.moved != null);
  return `${tableOpen}
    <tr>${th("Pos", "text-align:left;")}${showMove ? th("") : ""}${th("Name", "text-align:left;")}${th("W-D-L")}${th("Pts")}${th("Pts For")}</tr>
    ${rows
      .map(
        (r) => `<tr>
        ${td(String(r.pos), `border-left:4px solid ${r.band ? bandColor[r.band] : "transparent"};`)}
        ${showMove ? td(movement(r.moved), "font-size:12px;white-space:nowrap;") : ""}
        ${td(esc(r.managerName))}
        ${td(`${r.w}-${r.d}-${r.l}`, "text-align:center;white-space:nowrap;")}
        ${td(String(r.leaguePts), "text-align:center;font-weight:700;")}
        ${td(String(r.ptsFor), "text-align:center;")}
      </tr>`
      )
      .join("")}
  </table>`;
}

type RenderInput = {
  gameweek: number;
  divisions: any[];
  cupMatches: any[];
  cupGroups: number[];
  mom: { div: number; name: string; topThree: { managerName: string; total: number }[]; winners: string[] }[];
  momLabel: string;
  momProgress: string;
  isFinalMomWeek: boolean;
  nextGw: number;
  deadlineText: string | null;
};

function renderHtml(d: RenderInput) {
  const parts: string[] = [];

  d.divisions.forEach((div: any) => {
    parts.push(h2(esc(div.name)));
    parts.push(tableOpen + div.matches.map((m: any) => scoreLine(m.home, m.away, m.homeScore, m.awayScore)).join("") + "</table>");
    div.byes.forEach((b: any) =>
      parts.push(
        `<p style="margin:6px 0;font-size:13px;color:${C.muted};">${esc(b.name)} had a bye${b.score != null ? ` (scored ${b.score})` : ""}</p>`
      )
    );
    if (div.topScore != null) {
      parts.push(
        `<p style="margin:8px 0 0;font-size:13px;">Top score this week: <strong>${esc(div.topScorers.join(" & "))}</strong> with ${div.topScore}</p>`
      );
    }
    parts.push(h3(`Table after Gameweek ${d.gameweek}`));
    parts.push(standingsTable(div.table));
  });

  if (d.cupMatches.length > 0) {
    parts.push(h2("Michu Cup"));
    d.cupGroups.forEach((g) => {
      parts.push(h3(`Group ${g}`));
      parts.push(
        tableOpen +
          d.cupMatches
            .filter((f) => f.group === g)
            .map((f) => scoreLine(f.home.name, f.away.name, f.home.score ?? undefined, f.away.score ?? undefined))
            .join("") +
          "</table>"
      );
    });
    parts.push(
      `<p style="margin:10px 0 0;font-size:13px;"><a href="${SITE_URL}/michu-cup/table" style="color:${C.accent};">Michu Cup group tables →</a></p>`
    );
  }

  parts.push(h2(`Manager of the Month — ${esc(d.momLabel)}`));
  parts.push(
    `<p style="margin:0 0 6px;font-size:13px;color:${C.muted};">${
      d.isFinalMomWeek ? "Final standings for the month." : `After ${d.momProgress} gameweeks.`
    }</p>`
  );
  d.mom.forEach((m) => {
    parts.push(h3(esc(m.name)));
    if (d.isFinalMomWeek && m.winners.length) {
      parts.push(
        `<p style="margin:4px 0 8px;font-size:16px;">🏆 <strong>${esc(m.winners.join(" & "))}</strong> ${
          m.winners.length > 1 ? "are joint Managers" : "is Manager"
        } of the Month</p>`
      );
    }
    parts.push(
      tableOpen +
        m.topThree
          .map(
            (t, i) => `<tr>${td(String(i + 1), "width:28px;")}${td(esc(t.managerName))}${td(`${t.total} pts`, "text-align:right;")}</tr>`
          )
          .join("") +
        "</table>"
    );
  });

  if (d.deadlineText) {
    parts.push(
      `<div style="margin:28px 0 0;padding:12px 14px;background:#f6f8fa;border-radius:6px;font-size:14px;">
        <strong>Gameweek ${d.nextGw} deadline:</strong> ${esc(d.deadlineText)}<br>
        <a href="${SITE_URL}/submit" style="color:${C.accent};">Submit your lineup →</a>
      </div>`
    );
  }

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f0f2f5;">
<div style="padding:16px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${C.text};">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;padding:20px 18px;">
    <p style="margin:0;font-size:12px;color:${C.muted};text-transform:uppercase;letter-spacing:0.06em;">FPL Draft League</p>
    <h1 style="margin:4px 0 0;font-size:24px;">Gameweek ${d.gameweek} results</h1>
    ${parts.join("\n")}
    <p style="margin:28px 0 0;font-size:12px;color:${C.muted};">
      <a href="${SITE_URL}/table" style="color:${C.accent};">Full tables</a> ·
      <a href="${SITE_URL}/fixtures" style="color:${C.accent};">Fixtures &amp; results</a> ·
      <a href="${SITE_URL}/mom" style="color:${C.accent};">Manager of the Month</a>
    </p>
  </div>
</div>
</body></html>`;
}

// Plain-text version for email apps that don't show HTML.
function renderText(d: Omit<RenderInput, "cupGroups" | "momProgress">) {
  const lines: string[] = [`GAMEWEEK ${d.gameweek} RESULTS`, ""];
  const s = (n?: number) => (n == null ? "-" : String(n));
  d.divisions.forEach((div: any) => {
    lines.push(div.name.toUpperCase());
    div.matches.forEach((m: any) => lines.push(`  ${m.home} ${s(m.homeScore)} - ${s(m.awayScore)} ${m.away}`));
    div.byes.forEach((b: any) => lines.push(`  ${b.name} had a bye${b.score != null ? ` (scored ${b.score})` : ""}`));
    if (div.topScore != null) lines.push(`  Top score: ${div.topScorers.join(" & ")} (${div.topScore})`);
    lines.push("  Table:");
    div.table.forEach((r: any) => lines.push(`  ${r.pos}. ${r.managerName}  ${r.w}-${r.d}-${r.l}  ${r.leaguePts} pts  (${r.ptsFor} for)`));
    lines.push("");
  });
  if (d.cupMatches.length > 0) {
    lines.push("MICHU CUP");
    d.cupMatches.forEach((f) => lines.push(`  Group ${f.group}: ${f.home.name} ${s(f.home.score)} - ${s(f.away.score)} ${f.away.name}`));
    lines.push("");
  }
  lines.push(`MANAGER OF THE MONTH — ${d.momLabel}${d.isFinalMomWeek ? " (final)" : ""}`);
  d.mom.forEach((m) => {
    lines.push(`  ${m.name}: ` + m.topThree.map((t, i) => `${i + 1}. ${t.managerName} ${t.total}`).join(", "));
    if (d.isFinalMomWeek && m.winners.length) lines.push(`  Winner: ${m.winners.join(" & ")}`);
  });
  if (d.deadlineText) {
    lines.push("", `Gameweek ${d.nextGw} deadline: ${d.deadlineText}`, `${SITE_URL}/submit`);
  }
  return lines.join("\n");
}
