type ChipState = 'default' | 'active' | 'flagged';

export default function Chip({
  children,
  state = 'default',
  onClick,
}: {
  children: React.ReactNode;
  state?: ChipState;
  onClick?: () => void;
}) {
  const styles: Record<ChipState, string> = {
    default: 'border-line text-fg-2',
    active: 'border-fg text-fg',
    flagged: 'border-select text-select',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 px-3 font-spec text-[11px] uppercase tracking-widest border ${styles[state]}`}
      style={{ borderRadius: 0 }}
    >
      {children}
    </button>
  );
}
