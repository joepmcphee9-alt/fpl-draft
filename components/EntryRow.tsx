"use client";

import { useState } from "react";
import SquadList from "./SquadList";

type Entry = {
  id: string;
  team_name: string | null;
  players: { name: string } | null;
};

export default function EntryRow({ entry }: { entry: Entry }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr
        onClick={() => setOpen(!open)}
        style={{ borderBottom: "1px solid #1c2530", cursor: "pointer" }}
      >
        <td style={{ padding: "0.5rem 0" }}>{entry.players?.name ?? "—"}</td>
        <td>{entry.team_name ?? "—"}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={2}>
            <SquadList entryId={entry.id} />
          </td>
        </tr>
      )}
    </>
  );
}