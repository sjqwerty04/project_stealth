export default function TicketStub({
  title,
  meta,
  selected,
  onClick,
}: {
  title: string;
  meta?: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full min-h-11 text-left px-3 py-3 border ${
        selected ? 'border-fg bg-base-3' : 'border-line bg-base-2'
      }`}
      style={{ borderRadius: 0 }}
    >
      <p className="font-display text-fg text-base leading-tight">{title}</p>
      {meta && (
        <p className="font-spec text-[10px] uppercase tracking-widest text-fg-3 mt-1">{meta}</p>
      )}
    </button>
  );
}
