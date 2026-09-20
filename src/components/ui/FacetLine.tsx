export default function FacetLine({ facets, className = '' }: { facets: [string, string]; className?: string }) {
  return (
    <p className={`font-spec text-chip uppercase tracking-wide text-select ${className}`} data-testid="facet-line">
      {facets[0]}
      <span aria-hidden="true"> × </span>
      <span className="sr-only"> and </span>
      {facets[1]}
    </p>
  );
}
