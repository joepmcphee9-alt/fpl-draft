import Link from "next/link";

// Temporary home button, fixed to the top-right corner of every page.
// Replace during the styling pass.
export default function HomeButton() {
  return (
    <Link
      href="/"
      aria-label="Home"
      title="Home"
      style={{
        position: "fixed",
        top: 12,
        right: 16,
        zIndex: 1000,
        width: 40,
        height: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        border: "1px solid #333",
        background: "#0b0f14",
        color: "#e6edf3",
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h5v-6h4v6h5V9.5" />
      </svg>
    </Link>
  );
}