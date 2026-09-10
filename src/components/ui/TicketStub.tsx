import BarUnit from './BarUnit';

export default function TicketStub({
  title,
  meta,
  poster,
  empty,
  selected,
  onClick,
}: {
  title: string;
  meta?: string;
  poster?: string | null;
  empty?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  const showArt = Boolean(poster) || empty;

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={empty ? 'ticket-slot-empty' : showArt ? 'ticket-slot' : undefined}
      className={`w-full min-h-11 text-left border overflow-hidden ${
        selected ? 'border-fg bg-base-3' : 'border-line bg-base-2'
      }`}
      style={{ borderRadius: 0 }}
    >
      {showArt ? (
        <>
          <div className="flex gap-3 p-3 items-start">
            <div
              className="relative shrink-0 overflow-hidden bg-base-3"
              style={{ width: 46, height: 69, borderRadius: 2 }}
            >
              {empty || !poster ? (
                <div className="absolute inset-0 border border-dashed border-line" data-testid="skeleton" />
              ) : (
                <img src={poster} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1 flex flex-col gap-1.5">
              <p className="font-display font-extrabold text-[17px] leading-none text-fg tracking-tight">
                {title}
              </p>
              {meta && (
                <p className="font-spec text-[8.5px] uppercase tracking-[0.03em] text-fg-3 leading-[1.65]">
                  {meta}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-[5px] overflow-hidden px-2 pb-1.5" aria-hidden>
            {Array.from({ length: 32 }, (_, i) => (
              <BarUnit key={i} state="empty" width={3} height={5} />
            ))}
          </div>
        </>
      ) : (
        <div className="px-3 py-3">
          <p className="font-display text-fg text-base leading-tight">{title}</p>
          {meta && (
            <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3 mt-1">{meta}</p>
          )}
        </div>
      )}
    </button>
  );
}
