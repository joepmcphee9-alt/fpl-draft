import AuthStatus from "@/components/AuthStatus";

export const metadata = {
  title: "FPL Draft League",
  description: "FPL fantasy draft league — AML, Division 2, Division 3",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          margin: 0,
          padding: "2rem",
          background: "#0b0f14",
          color: "#e6edf3",
          minHeight: "100vh",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <nav style={{ display: "flex", gap: "1rem", padding: "0.5rem 0", fontSize: "0.9rem" }}>
            <a href="/" style={{ color: "#e6edf3" }}>Standings</a>
            <a href="/fixtures" style={{ color: "#e6edf3" }}>Fixtures</a>
            <a href="/submit" style={{ color: "#e6edf3" }}>Submit lineup</a>
            <a href="/matchup" style={{ color: "#e6edf3" }}>My matchup</a>
            <a href="/mom" style={{ color: "#e6edf3" }}>Manager of the Month</a>
            <a href="/admin" style={{ color: "#e6edf3" }}>Admin</a>
          </nav>
          <AuthStatus />
          {children}
        </div>
      </body>
    </html>
  );
}