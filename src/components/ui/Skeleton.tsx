export default function Skeleton({ className = '' }: { className?: string }) {
  return <div data-testid="skeleton" className={`bg-base-3 ${className}`} />;
}
