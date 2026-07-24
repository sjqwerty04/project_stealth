/**
 * Required attribution for our metadata sources. TMDB's terms of use mandate this
 * exact notice for any application using their API, and their stated remedy for
 * non-compliance is revoking access.
 */
export default function AttributionNotice() {
  return (
    <p className="text-[10px] text-gray-600 leading-relaxed text-center pt-2">
      This product uses the TMDB API but is not endorsed or certified by{' '}
      <a
        href="https://www.themoviedb.org/"
        target="_blank"
        rel="noreferrer noopener"
        className="underline hover:text-gray-400"
      >
        TMDB
      </a>
      .
    </p>
  );
}
