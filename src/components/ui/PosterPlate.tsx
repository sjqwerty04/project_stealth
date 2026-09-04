type PosterState = 'seen' | 'unseen' | 'loading';

export default function PosterPlate({
  src,
  title,
  state = 'seen',
  className = '',
  onClick,
}: {
  src?: string | null;
  title?: string;
  state?: PosterState;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={title || 'Poster'}
      className={`relative overflow-hidden bg-base-3 ${className}`}
      style={{ borderRadius: 2, aspectRatio: '2 / 3' }}
    >
      {state === 'loading' || !src ? (
        <div className="absolute inset-0 bg-base-3" data-testid="skeleton" />
      ) : (
        <img src={src} alt={title || ''} className="h-full w-full object-cover" />
      )}
      {state === 'unseen' && (
        <div className="absolute inset-0 border border-dashed border-line" />
      )}
    </button>
  );
}
