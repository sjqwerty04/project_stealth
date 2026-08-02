// ui.jsx — shared pieces: StreetMap (stylized abstract map), Sheet grabber, Stars
const { useState: useStateUI, useRef: useRefUI, useEffect: useEffUI } = React;

// Stylized dark "Apple-Maps"-style street map drawn with SVG. No real tiles.
function StreetMap({ accent = '#9b8cff', label = '', sub = '', walk = true, height = 230, dim = false }) {
  // a fixed, designed street grid + park + water; user dot bottom-left, destination pin upper-right
  return (
    <div style={{ position: 'relative', width: '100%', height, borderRadius: 22, overflow: 'hidden',
      background: dim ? '#0e0e14' : '#101019', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)' }}>
      <svg viewBox="0 0 400 280" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <radialGradient id="mapglow" cx="72%" cy="32%" r="60%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.20" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
          <filter id="pinblur"><feGaussianBlur stdDeviation="6" /></filter>
        </defs>
        <rect width="400" height="280" fill="#0d0d15" />
        {/* water */}
        <path d="M0 210 C70 196 120 230 200 222 C280 214 340 250 400 236 L400 280 L0 280 Z" fill="#0b1622" opacity="0.9" />
        <path d="M0 210 C70 196 120 230 200 222 C280 214 340 250 400 236" fill="none" stroke="#16324a" strokeWidth="1" opacity="0.6" />
        {/* park blob */}
        <path d="M250 30 C300 24 340 50 336 92 C332 128 286 140 256 122 C228 106 222 56 250 30 Z" fill="#0f2018" opacity="0.85" />
        {/* blocks (subtle fills) */}
        <g fill="#13131e">
          <rect x="24" y="40" width="70" height="46" rx="3" /><rect x="110" y="36" width="60" height="40" rx="3" />
          <rect x="24" y="104" width="70" height="58" rx="3" /><rect x="110" y="92" width="60" height="70" rx="3" />
          <rect x="186" y="150" width="64" height="44" rx="3" /><rect x="44" y="178" width="78" height="26" rx="3" />
        </g>
        {/* streets */}
        <g stroke="#23232f" strokeWidth="7" strokeLinecap="round">
          <line x1="100" y1="0" x2="100" y2="280" /><line x1="178" y1="0" x2="178" y2="280" />
          <line x1="0" y1="86" x2="400" y2="86" /><line x1="0" y1="168" x2="400" y2="168" />
        </g>
        <g stroke="#1a1a25" strokeWidth="3" strokeLinecap="round">
          <line x1="50" y1="0" x2="50" y2="280" /><line x1="140" y1="0" x2="140" y2="280" /><line x1="240" y1="0" x2="240" y2="280" />
          <line x1="0" y1="44" x2="400" y2="44" /><line x1="0" y1="128" x2="400" y2="128" /><line x1="0" y1="210" x2="400" y2="210" />
        </g>
        {/* a diagonal avenue */}
        <line x1="0" y1="250" x2="320" y2="20" stroke="#26212f" strokeWidth="6" strokeLinecap="round" />
        <rect width="400" height="280" fill="url(#mapglow)" />

        {/* walking route */}
        {walk && <path d="M70 224 C110 200 120 150 178 120 C220 98 250 96 286 70" fill="none"
          stroke={accent} strokeWidth="3.5" strokeDasharray="2 8" strokeLinecap="round" opacity="0.95" />}

        {/* destination pin */}
        <g transform="translate(286,70)">
          <circle r="26" fill={accent} opacity="0.18" filter="url(#pinblur)" />
          <circle r="11" fill={accent} />
          <circle r="11" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1" />
          <circle r="4" fill="#fff" />
        </g>
        {/* user dot */}
        <g transform="translate(70,224)">
          <circle r="20" fill="#3aa0ff" opacity="0.16" filter="url(#pinblur)" />
          <circle r="7" fill="#3aa0ff" />
          <circle r="7" fill="none" stroke="#fff" strokeWidth="2" />
        </g>
      </svg>

      {(label || sub) && (
        <div style={{ position: 'absolute', left: 12, bottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="glass-chip">
            {walk && <span style={{ display: 'inline-flex', color: accent }}>{React.createElement(window.IconWalk, { size: 15 })}</span>}
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '0.02em' }}>{label}</span>
            {sub && <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>{sub}</span>}
          </div>
        </div>
      )}
      <button className="glass-chip map-expand" style={{ position: 'absolute', right: 12, top: 12 }}>
        {React.createElement(window.IconLayers, { size: 16 })}
      </button>
    </div>
  );
}

function Grabber() {
  return <div style={{ width: 38, height: 5, borderRadius: 99, background: 'var(--grab)', margin: '8px auto 4px' }} />;
}

// star rating row (filmic)
function Stars({ value = 4.6, size = 13 }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text-dim)', fontFamily: 'var(--mono)', fontSize: 12 }}>
      <span style={{ color: '#e8b24a' }}>{'\u2605'}</span>{value.toFixed(1)}
    </span>
  );
}

Object.assign(window, { StreetMap, Grabber, Stars });
