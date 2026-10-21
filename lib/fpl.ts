// One place for every call the site makes to the FPL API.
// FPL refuses some requests that don't look like they come from a browser,
// so we send browser-like headers, retry once, and fail with a clear message
// instead of a blank page.

const FPL_BASE = "https://fantasy.premierleague.com/api/";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  Accept: "application/json",
  "Accept-Language": "en-GB,en;q=0.9",
};

export async function fplJson(path: string): Promise<any> {
  let lastError = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(FPL_BASE + path, { headers: HEADERS, cache: "no-store" });
      const text = await res.text();
      if (!res.ok) {
        lastError = `FPL returned ${res.status} for ${path}: ${text.slice(0, 200)}`;
      } else {
        try {
          return JSON.parse(text);
        } catch {
          lastError = `FPL sent something that isn't data for ${path} (often "the game is being updated"): ${text.slice(0, 200)}`;
        }
      }
    } catch (err: any) {
      lastError = `Couldn't reach FPL for ${path}: ${err?.message ?? err}`;
    }
  }
  throw new Error(lastError);
}

export function fplError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  return Response.json({ error: message }, { status: 502 });
}
// When each gameweek's first match kicks off. This is the league's deadline
// (FPL's own deadline is earlier). Returns { gameweek: ISO time }.
export async function firstKickoffs(): Promise<Record<number, string>> {
  const fixtures = await fplJson("fixtures/");
  const first: Record<number, string> = {};
  fixtures.forEach((f: any) => {
    if (!f.event || !f.kickoff_time) return;
    if (!first[f.event] || new Date(f.kickoff_time) < new Date(first[f.event])) first[f.event] = f.kickoff_time;
  });
  return first;
}
