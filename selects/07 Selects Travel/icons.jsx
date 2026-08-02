// icons.jsx — minimal stroke icon set (24x24, currentColor)
function Ic({ d, size = 22, fill = 'none', sw = 1.8, children, vb = 24, style }) {
  return (
    <svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} fill={fill} stroke="currentColor"
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style}>
      {d ? <path d={d} /> : children}
    </svg>
  );
}
const IconSearch   = (p) => <Ic {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></Ic>;
const IconClose    = (p) => <Ic {...p} d="M6 6l12 12M18 6L6 18" />;
const IconChevR    = (p) => <Ic {...p} d="M9 6l6 6-6 6" />;
const IconChevL    = (p) => <Ic {...p} d="M15 6l-6 6 6 6" />;
const IconChevD    = (p) => <Ic {...p} d="M6 9l6 6 6-6" />;
const IconPlay     = (p) => <Ic {...p} fill="currentColor" sw="0"><path d="M7 4.5v15l13-7.5z" /></Ic>;
const IconBookmark = (p) => <Ic {...p}><path d="M6 4h12v17l-6-4-6 4z" /></Ic>;
const IconBookmarkF= (p) => <Ic {...p} fill="currentColor"><path d="M6 4h12v17l-6-4-6 4z" /></Ic>;
const IconShare    = (p) => <Ic {...p}><path d="M12 3v13M12 3L8 7M12 3l4 4" /><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" /></Ic>;
const IconNav      = (p) => <Ic {...p}><path d="M3 11l18-8-8 18-2-8z" /></Ic>;
const IconPin      = (p) => <Ic {...p}><path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></Ic>;
const IconWalk     = (p) => <Ic {...p}><circle cx="13" cy="4" r="1.6" fill="currentColor" stroke="none" /><path d="M11 8l2 4 3 1M13 12l-1 4 1 4M12 16l-3 4" /></Ic>;
const IconLayers   = (p) => <Ic {...p}><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></Ic>;
const IconBell     = (p) => <Ic {...p}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" /><path d="M10.5 21a2 2 0 0 0 3 0" /></Ic>;
const IconClock    = (p) => <Ic {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></Ic>;
const IconFilm     = (p) => <Ic {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M3 15h18M8 4v16M16 4v16" /></Ic>;
const IconCompass  = (p) => <Ic {...p}><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" fill="currentColor" stroke="none" /></Ic>;
const IconGrid     = (p) => <Ic {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Ic>;
const IconHeart    = (p) => <Ic {...p}><path d="M12 20s-7-4.5-7-9.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 2.5c0 5-7 9.5-7 9.5z" /></Ic>;

Object.assign(window, {
  IconSearch, IconClose, IconChevR, IconChevL, IconChevD, IconPlay, IconBookmark, IconBookmarkF,
  IconShare, IconNav, IconPin, IconWalk, IconLayers, IconBell, IconClock, IconFilm, IconCompass, IconGrid, IconHeart,
});
