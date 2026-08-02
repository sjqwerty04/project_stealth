import { NextRequest } from "next/server";

interface TMDBFilm {
  id: number;
  title: string;
  backdrop_path: string | null;
  poster_path: string | null;
}

interface TMDBVideo {
  key: string;
  site: string;
  type: string;
  official: boolean;
}

interface TMDBLogo {
  file_path: string;
  iso_639_1: string | null;
  width: number;
}

export async function GET(request: NextRequest) {
  try {
    const region = request.nextUrl.searchParams.get("region") || "";
    const regionParam = region ? `&region=${region}` : "";
    const API_KEY = process.env.TMDB_API_KEY;

    // 1. Get trending films
    const trendingRes = await fetch(
      `https://api.themoviedb.org/3/trending/movie/week?api_key=${API_KEY}&language=en-US${regionParam}`
    );
    const trendingData = await trendingRes.json();
    const films: TMDBFilm[] = (trendingData.results || []).slice(0, 20);

    // 2. Fetch trailer key + logo in parallel per film (cap at 14 for performance)
    const filmSubset = films.slice(0, 14);
    const trailerResults = await Promise.allSettled(
      filmSubset.map(async (film) => {
        // Fetch videos and logos in parallel for each film
        const [vidData, imgData] = await Promise.all([
          fetch(
            `https://api.themoviedb.org/3/movie/${film.id}/videos?api_key=${API_KEY}`
          ).then((r) => r.json()),
          fetch(
            `https://api.themoviedb.org/3/movie/${film.id}/images?api_key=${API_KEY}&include_image_language=en,null`
          ).then((r) => r.json()),
        ]);

        const videos: TMDBVideo[] = vidData.results || [];
        const logos: TMDBLogo[] = imgData.logos || [];

        // Prefer official YouTube trailer, fall back to any YouTube video
        const trailer =
          videos.find(
            (v) => v.site === "YouTube" && v.type === "Trailer" && v.official
          ) ||
          videos.find((v) => v.site === "YouTube" && v.type === "Trailer") ||
          videos.find((v) => v.site === "YouTube");

        // Prefer English logo, fall back to language-agnostic, then any
        const logo =
          logos.find((l) => l.iso_639_1 === "en") ||
          logos.find((l) => l.iso_639_1 === null) ||
          logos[0] ||
          null;

        return {
          id: film.id,
          title: film.title,
          youtubeKey: trailer?.key || null,
          logoUrl: logo
            ? `https://image.tmdb.org/t/p/original${logo.file_path}`
            : null,
          backdrop: film.backdrop_path
            ? `https://image.tmdb.org/t/p/w780${film.backdrop_path}`
            : null,
          poster: film.poster_path
            ? `https://image.tmdb.org/t/p/w342${film.poster_path}`
            : null,
          // Start at 35s to skip green band + slow intro, end at 42s (7s clip)
          start: 35,
          end: 42,
        };
      })
    );

    const trailers = trailerResults
      .filter(
        (r): r is PromiseFulfilledResult<ReturnType<typeof Object.assign>> =>
          r.status === "fulfilled"
      )
      .map((r) => r.value);

    return Response.json({ trailers });
  } catch (error) {
    console.error("Failed to fetch film trailers", error);
    return Response.json(
      { trailers: [], error: "Failed to fetch film trailers" },
      { status: 500 }
    );
  }
}
