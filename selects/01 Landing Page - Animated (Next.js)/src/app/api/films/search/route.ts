import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");
  if (!query) {
    return Response.json({ results: [] });
  }

  const res = await fetch(
    `https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`
  );
  const data = await res.json();

  return Response.json({
    results: (data.results || []).slice(0, 8).map((f: Record<string, unknown>) => ({
      id: f.id,
      title: f.title,
      year: (f.release_date as string)?.split("-")[0] || "",
      poster_path: f.poster_path,
      vote_average: f.vote_average,
    })),
  });
}
