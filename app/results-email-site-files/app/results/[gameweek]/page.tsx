import { buildResultsEmail } from "@/lib/resultsEmail";

export const dynamic = "force-dynamic";

// Preview of the end-of-gameweek results email, exactly as it will be sent.
export default async function ResultsEmailPreview({
  params,
}: {
  params: Promise<{ gameweek: string }>;
}) {
  const { gameweek } = await params;
  const gw = Number(gameweek);
  if (!Number.isInteger(gw) || gw < 1 || gw > 38) {
    return <p style={{ opacity: 0.6 }}>Gameweek must be a number from 1 to 38.</p>;
  }

  const email = await buildResultsEmail(gw);

  return (
    <main>
      <p style={{ opacity: 0.7, fontSize: "0.9rem" }}>
        Email preview — subject: <strong>{email.subject}</strong>
      </p>
      <iframe
        title={email.subject}
        srcDoc={email.html}
        style={{ width: "100%", height: "85vh", border: "1px solid #333", borderRadius: 8, background: "#fff" }}
      />
    </main>
  );
}
