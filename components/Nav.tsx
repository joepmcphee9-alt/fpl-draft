"use client";

import { useState } from "react";

const links = [
  { href: "/", label: "Standings" },
  { href: "/fixtures", label: "Fixtures & Results" },
  { href: "/submit", label: "Submit lineup" },
  { href: "/matchup", label: "My matchup" },
  { href: "/mom", label: "Manager of the Month" },
  { href: "/draft-history", label: "Draft History" },
  { href: "/michu-cup", label: "Michu Cup" },
  { href: "/admin", label: "Admin" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <nav style={{ position: "relative", padding: "0.5rem 0" }}>
      <button
        onClick={() => setOpen(!open)}
        aria-label="Menu"
        style={{
          background: "none",
          border: "1px solid #333",
          borderRadius: 6,
          color: "#e6edf3",
          padding: "0.4rem 0.7rem",
          cursor: "pointer",
          fontSize: "1rem",
        }}
      >
        ☰ Menu
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 0.3rem)",
            left: 0,
            background: "#161b22",
            border: "1px solid #333",
            borderRadius: 8,
            padding: "0.5rem 0",
            minWidth: 200,
            zIndex: 10,
          }}
        >
          {links.map((link) => (
            
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              style={{
                display: "block",
                padding: "0.5rem 1rem",
                color: "#e6edf3",
                textDecoration: "none",
              }}
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </nav>
  );
}