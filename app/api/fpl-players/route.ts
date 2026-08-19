export async function GET() {
  const res = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/");
  const data = await res.json();

  const map: Record<number, string> = {};
  data.elements.forEach((el: any) => {
    map[el.id] = el.web_name;
  });

  return Response.json(map);
}