import SelectsChaseLoader from './SelectsChaseLoader';

export default function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      data-testid="skeleton"
      className={`relative overflow-hidden bg-base-3 flex items-center justify-center ${className}`}
    >
      <SelectsChaseLoader size="sm" activeColor="#FF3B14" idleColor="#2B2B2F" />
    </div>
  );
}
