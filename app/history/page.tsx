export const dynamic = "force-dynamic";

const BASE_URL = "https://tgrssvplbmndlzyvfiyq.supabase.co/storage/v1/object/public/history";

const BOARD_YEARS: { year: string; images: string[] }[] = [
  { year: "13/14", images: ["1314-1.jpg", "1314-2.jpg"] },
  { year: "15/16", images: ["1516-1.jpg"] },
  { year: "16/17", images: ["1617-1.jpg", "1617-2.jpg"] },
  { year: "17/18", images: ["1718-1.jpg", "1718-2.jpg"] },
  { year: "18/19", images: ["1819-1.jpg"] },
  { year: "19/20", images: ["1920-1.jpg", "1920-2.jpg"] },
  { year: "20/21", images: ["2021-1.jpg"] },
  { year: "21/22", images: ["2122-1.jpg", "2122-2.jpg"] },
  { year: "22/23", images: ["2223-1.jpg", "2223-2.jpg"] },
  { year: "23/24", images: ["2324-1.jpg", "2324-2.jpg", "2324-3.jpg"] },
  { year: "24/25", images: ["2425-1.jpg", "2425-2.jpg", "2425-3.jpg"] },
  { year: "25/26", images: ["2526-1.jpg", "2526-2.jpg", "2526-3.jpg"] },
  { year: "26/27", images: ["2627-1.jpg", "2627-2.jpg", "2627-3.jpg"] },
];

const GALLERY_IMAGES = Array.from({ length: 10 }, (_, i) => `${String(i + 1).padStart(2, "0")}.jpg`);

const STORY = `At the beginning of the 2012/13 season, Joe picked his FPL team as normal and, having read an article about what a underrated bargain Swansea City's new signing was going to be, inserted Miguel Perez Cuesta into the midfield of his lineup. Though it was his first season in La Liga after a career in the country's second division, 'Michu' had just scored 15 goals in 37 games for Rayo Vallecano before his move to the Prem.

Listed as a bargain midfielder on the game, Michu was handed the number 9 shirt with the Swans fully intending for him to play up front. He made his debut at Loftus Road, running riot with two goals and an assist in a dream start, winning 5-0 against QPR. By GW3, he'd scored twice more and had gone from 4% ownership at the start, to appearing in more than 400,000 squads going into September.

Joe was pissed. The 'diamond in the rough' that he'd gambled on was now in nearly every squad in his Mini Leagues. Having been an NFL fan for the previous five years or so, and venturing into the world of fantasy leagues for that, the idea of the FPL Draft was born.

Alongside work colleague Dan and football badger mate Mash, the three decided to form a league for the following season, with the first ever Committee Meeting taking place in The Loft in the summer of 2013. With Lauren McPhee working behind the bar at the time, she pulled the names out of the hat for the original first round order, and the league was born.

Unsure how to navigate the transfer window, the group ridiculously decided to draft AFTER GW3 in early September, with Gav picking the first ever player; Robin Van Persie. Andy then took Luis Suarez (with three games of his ban remaining) before Stu took Aguero, Dan took Rooney and Wayne took... Roberto Soldado!! In the back half of the first round, Martyn selected Sturridge, Paul chose Giroud, Mash took Benteke, the Curry & Jumby combination team took Walcott and I rounded off the first round by taking David Silva.

With Suarez hitting incredible heights, Andy stormed to the title that first season, becoming our first ever winner by almost 200 points and bagging five MOM pots in the process.

In year three, for the 15/16 season Westy joined to make it an 11-man division, while Jumby recorded a single GW score of 110 points which, to this day, remains the highest ever (he got within one point of that score himself in 18/19, while Shaun's score of 101 in 23/24 is the only over three-figure non-DGW total).

With interest high in the group's social circles, it was clear the game needed to grow. At the beginning of the 16/17 season it was decided that four teams would be relegated into a new Division 2, where more people would be added to form two leagues of eight.

Westy won back-to-back titles during this transition stage, where we'd also moved to a head-to-head format, while Andy - the inaugural winner - was relegated the first time that it became a possibility. In the 2017/18 season, the Michu Cup was born and, at the time, was a half-season competition in which Jonno won it during the Winter and Paul then was victorious in the Spring. It was in that same season that Wayne recorded our lowest ever score, recording just ten points one week which, as anyone with semi-decent math skills will know, not even one point per player.

The eight-man divisions only lasted a season, with a 20-strong lineup set for the 2018/19 campaign. Curry achieved the feat of winning Div 2 in its first season before taking the Div 1 title in the season after.

It was during this season in which the format of the Michu changed and a secondary competition was born - with the name of the comp changing yearly and to be named after a player who'd had a huge FPL impact either during their career or the previous season. Andreas Weimann, Callum Paterson, The Great Lord Lundstram, Sergio Aguero, Cristiano Ronaldo, Harry Kane, Ezri 'Ngoyo' Konsa, Cole Palmer, Kevin De Bruyne and Mo Salah can all count themselves lucky to be part of that illustrious group.

The 10-man, two division format remained unchanged and in place for four full seasons until the summer of 2023, where an eight-man third division was formed. Two more people joined in 2024, completing a three-division, 30-man lineup.

In the summer of 2026, following the death of Andy, the competition's first ever winner, the top division was named after him and will henceforth be known as the 'Andy McPhee League', with Divisions 2 and 3 retaining their names. As well as honouring him by name, the awarding of a 'Green Jacket', Masters style (due to his other love of golf) was announced to also be awarded to the winner of the AML from the 2026/27 campaign onwards.`;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const selectedYear = params.year && BOARD_YEARS.some((b) => b.year === params.year) ? params.year : null;
  const selectedBoard = BOARD_YEARS.find((b) => b.year === selectedYear);

  return (
    <main>
      <img
        src={`${BASE_URL}/hero.jpg`}
        alt="The league"
        style={{ width: "100%", maxHeight: 420, objectFit: "cover", borderRadius: 8, marginBottom: "1.5rem" }}
      />

      <h1>Our History</h1>

      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, marginTop: "1rem", maxWidth: 800 }}>
        {STORY}
      </div>

      <h2 style={{ marginTop: "3rem" }}>Draft Boards Through the Years</h2>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", margin: "1rem 0" }}>
        {BOARD_YEARS.map((b) => {
          const isActive = b.year === selectedYear;
          return (
            
              key={b.year}
              href={`/history?year=${encodeURIComponent(b.year)}`}
              style={{
                padding: "0.4rem 0.9rem",
                borderRadius: 6,
                textDecoration: "none",
                fontSize: "0.9rem",
                background: isActive ? "#238636" : "rgba(255,255,255,0.05)",
                color: isActive ? "white" : "#e6edf3",
                border: isActive ? "none" : "1px solid #333",
              }}
            >
              {b.year}
            </a>
          );
        })}
      </div>

      {selectedBoard && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
          {selectedBoard.images.map((img) => (
            <img
              key={img}
              src={`${BASE_URL}/boards/${img}`}
              alt={`${selectedBoard.year} draft board`}
              style={{ width: "100%", borderRadius: 8 }}
            />
          ))}
        </div>
      )}

      <h2 style={{ marginTop: "3rem" }}>Gallery</h2>
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          overflowX: "auto",
          paddingBottom: "1rem",
          marginTop: "1rem",
        }}
      >
        {GALLERY_IMAGES.map((img) => (
          <img
            key={img}
            src={`${BASE_URL}/gallery/${img}`}
            alt="League memory"
            style={{ height: 220, borderRadius: 8, flexShrink: 0 }}
          />
        ))}
      </div>
    </main>
  );
}