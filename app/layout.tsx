import AuthStatus from "@/components/AuthStatus";

export const metadata = {
  title: "FPL Draft League",
  description: "FPL fantasy draft league — AML, Division 2, Division 3",
};

import Nav from "@/components/Nav";

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
          <Nav />
          </nav>
          <AuthStatus />
          {children}
        </div>
      </body>
    </html>
  );
}