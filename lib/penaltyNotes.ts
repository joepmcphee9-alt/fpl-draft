// Turns a table's penalties into asterisk markers and footnotes:
//   Bill*   ->   *Bill -3 for missed submission (GW8)
// The first manager penalised gets *, the next gets **, and so on, in the
// order their first penalty happened.

export type PenaltyIncident = {
  entryId: string;
  name: string;
  gameweek: number;
  points: number;
  reason?: string | null;
};

function describe(reason: string | null | undefined, count: number) {
  if (!reason || /deadline|submi/i.test(reason)) return count > 1 ? "missed submissions" : "missed submission";
  return reason.charAt(0).toLowerCase() + reason.slice(1);
}

export function penaltyMarkers(incidents: PenaltyIncident[]): {
  markers: Record<string, string>;
  notes: string[];
} {
  const live = incidents.filter((p) => p.points !== 0); // a penalty set to 0 has been let off
  const byEntry: Record<string, PenaltyIncident[]> = {};
  live.forEach((p) => (byEntry[p.entryId] ??= []).push(p));

  const offenders = Object.values(byEntry)
    .map((list) => list.sort((a, b) => a.gameweek - b.gameweek))
    .sort((a, b) => a[0].gameweek - b[0].gameweek || a[0].name.localeCompare(b[0].name));

  const markers: Record<string, string> = {};
  const notes: string[] = [];
  offenders.forEach((list, i) => {
    const marker = "*".repeat(i + 1);
    markers[list[0].entryId] = marker;

    // Group by reason, e.g. "-6 for missed submissions (GW8, GW12)"
    const byReason: Record<string, PenaltyIncident[]> = {};
    list.forEach((p) => (byReason[describe(p.reason, 1)] ??= []).push(p));
    const parts = Object.values(byReason).map((group) => {
      const total = group.reduce((sum, p) => sum + p.points, 0);
      const gws = group.map((p) => `GW${p.gameweek}`).join(", ");
      return `${total} for ${describe(group[0].reason, group.length)} (${gws})`;
    });
    notes.push(`${marker}${list[0].name} ${parts.join(", ")}`);
  });

  return { markers, notes };
}
