import MatchupView from "@/components/MatchupView";

export default async function FixtureMatchupPage({
  params,
}: {
  params: Promise<{ fixtureId: string }>;
}) {
  const { fixtureId } = await params;

  return (
    <main>
      <h1>Matchup</h1>
      <p style={{ marginBottom: "1.5rem" }}>
        <a href="/fixtures" style={{ color: "#58a6ff" }}>← Back to fixtures</a>
      </p>
      <MatchupView fixtureId={fixtureId} />
    </main>
  );
}