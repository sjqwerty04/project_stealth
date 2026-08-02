import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const region = request.nextUrl.searchParams.get("region") || "";
    const regionParam = region ? `&region=${region}` : "";

    // Get trending films for the region
    const res = await fetch(
      `https://api.themoviedb.org/3/trending/movie/week?api_key=${process.env.TMDB_API_KEY}&language=en-US${regionParam}`
    );
    const data = await res.json();
    const films = data.results || [];

    // Collect backdrop images (these are the "action" stills)
    const stills = films
      .filter((f: Record<string, unknown>) => f.backdrop_path)
      .map((f: Record<string, unknown>) => ({
        id: f.id,
        title: f.title,
        backdrop: `https://image.tmdb.org/t/p/w780${f.backdrop_path}`,
        poster: f.poster_path
          ? `https://image.tmdb.org/t/p/w342${f.poster_path}`
          : null,
      }));

    return Response.json({ stills: stills.slice(0, 20) });
  } catch (error) {
    console.error("Failed to fetch film stills", error);
    return Response.json(
      { stills: [], error: "Failed to fetch film stills" },
      { status: 500 }
    );
  }
}
