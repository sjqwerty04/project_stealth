import type { ReactNode } from 'react';

type IconName = 'home' | 'hunt' | 'library' | 'you';

const MOTION = 'transform .45s cubic-bezier(.34,1.56,.64,1), fill .3s, stroke .3s';

function Frame({ size, children }: { size: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="miter" strokeLinecap="square" aria-hidden="true">
      {children}
    </svg>
  );
}

function TicketIcon({ on, size }: { on: boolean; size: number }) {
  return (
    <Frame size={size}>
      <path d="M2.6 6.5H14.4V17.5H2.6V13.7A1.7 1.7 0 0 0 2.6 10.3Z" />
      <path
        d="M16.4 6.5H21.4V10.3A1.7 1.7 0 0 0 21.4 13.7V17.5H16.4Z"
        style={{
          fill: on ? 'var(--select)' : 'none',
          stroke: on ? 'var(--select)' : 'currentColor',
          transformBox: 'fill-box',
          transformOrigin: '0% 0%',
          transform: on ? 'translate(0.9px,0.5px) rotate(10deg)' : 'none',
          transition: MOTION,
        }}
      />
    </Frame>
  );
}

function ViewfinderIcon({ on, size }: { on: boolean; size: number }) {
  const k = on ? 2.2 : 0;
  const corner = (x: number, y: number, dx: number, dy: number) => `M${x + dx * 5.2} ${y}H${x}V${y + dy * 5.2}`;
  return (
    <Frame size={size}>
      <g style={{ transform: `translate(${k}px,${k}px)`, transition: MOTION }}><path d={corner(3, 3, 1, 1)} /></g>
      <g style={{ transform: `translate(${-k}px,${k}px)`, transition: MOTION }}><path d={corner(21, 3, -1, 1)} /></g>
      <g style={{ transform: `translate(${k}px,${-k}px)`, transition: MOTION }}><path d={corner(3, 21, 1, -1)} /></g>
      <g style={{ transform: `translate(${-k}px,${-k}px)`, transition: MOTION }}><path d={corner(21, 21, -1, -1)} /></g>
      <path d="M10.6 15.2H12.7L14.4 8.8H12.3Z" style={{ fill: on ? 'var(--select)' : 'currentColor', stroke: 'none', opacity: on ? 1 : 0.7, transition: MOTION }} />
    </Frame>
  );
}

function ShelfIcon({ on, size }: { on: boolean; size: number }) {
  return (
    <Frame size={size}>
      <path d="M2 20.6H22" />
      <path d="M3.6 20.6V6.2H8.2V20.6" style={{ fill: on ? 'currentColor' : 'none', transition: MOTION }} />
      <path d="M10 20.6V8.6H14.4V20.6" style={{ fill: on ? 'currentColor' : 'none', transition: MOTION }} />
      <path
        d="M15.6 20.6V7.4H20V20.6Z"
        style={{
          fill: on ? 'var(--select)' : 'none',
          stroke: on ? 'var(--select)' : 'currentColor',
          transformBox: 'fill-box',
          transformOrigin: '100% 100%',
          transform: on ? 'rotate(17deg)' : 'rotate(9deg)',
          transition: MOTION,
        }}
      />
    </Frame>
  );
}

function NegativeIcon({ on, size }: { on: boolean; size: number }) {
  return (
    <Frame size={size}>
      <circle cx="12" cy="12" r="8.6" />
      <g style={{ transformBox: 'view-box', transformOrigin: '12px 12px', transform: on ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .7s cubic-bezier(.65,0,.35,1)' }}>
        <path d="M13.9 3.6A8.6 8.6 0 0 0 10.1 20.4Z" style={{ fill: on ? 'var(--select)' : 'currentColor', stroke: 'none', opacity: on ? 1 : 0.55, transition: MOTION }} />
      </g>
    </Frame>
  );
}

const ICONS = {
  home: TicketIcon,
  hunt: ViewfinderIcon,
  library: ShelfIcon,
  you: NegativeIcon,
} as const;

export default function TabIcon({ name, on = false, size = 22 }: { name: IconName; on?: boolean; size?: number }) {
  const Icon = ICONS[name];
  return <Icon on={on} size={size} />;
}
