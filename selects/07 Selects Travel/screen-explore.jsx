// screen-explore.jsx — Explore home: Globe / Flat map / Feed + search + sheet
const { useState: useXS, useRef: useXR, useMemo: useXM } = React;

// ---- Flat stylized world map (equirectangular) with poster pins ----
function projX(lng) { return lng + 180; }    // 0..360
function projY(lat) { return 90 - lat; }      // 0..180

function FlatMap({ pins, accent, focus, onSelectPin }) {
  // focus → zoom/translate transform on the map group
  const z = focus ? 4.2 : 1.15;
  const fx = focus ? projX(focus.lng) : 150;
  const fy = focus ? projY(focus.lat) : 64;
  const tx = 180 - fx * z;
  const ty = 90 - fy * z;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#0b0b12' }}>
      <svg viewBox="0 0 360 180" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <radialGradient id="fmglow" cx="50%" cy="38%" r="60%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.12" /><stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="360" height="180" fill="#0b0b12" />
        <rect width="360" height="180" fill="url(#fmglow)" />
        <g style={{ transform: `translate(${tx}px,${ty}px) scale(${z})`, transition: 'transform 900ms cubic-bezier(.22,1,.36,1)' }}>
          {/* graticule */}
          <g stroke="rgba(255,255,255,0.04)" strokeWidth="0.4">
            {[20, 60, 100, 140, 180, 220, 260, 300, 340].map((x) => <line key={x} x1={x} y1="0" x2={x} y2="180" />)}
            {[20, 50, 80, 110, 140].map((y) => <line key={y} x1="0" y1={y} x2="360" y2={y} />)}
          </g>
          {/* abstract landmasses */}
          <g fill="#22222e" stroke="rgba(155,140,255,0.22)" strokeWidth="0.5">
            {/* N America */}
            <path d="M30 34 C58 26 96 30 104 44 C112 58 96 70 100 84 C84 96 70 86 58 92 C44 84 40 64 34 56 C28 48 24 40 30 34 Z" />
            {/* S America */}
            <path d="M96 96 C108 92 116 104 112 120 C108 138 98 150 90 144 C84 132 88 116 90 108 C92 102 92 98 96 96 Z" />
            {/* Europe */}
            <path d="M168 32 C186 28 200 34 200 44 C198 54 186 56 180 52 C172 56 166 46 168 38 Z" />
            {/* Africa */}
            <path d="M172 60 C190 56 204 66 200 86 C196 108 184 122 176 116 C170 102 170 84 172 72 Z" />
            {/* Asia */}
            <path d="M206 30 C250 22 300 30 312 46 C320 60 300 70 286 66 C262 74 232 64 214 56 C204 50 200 38 206 30 Z" />
            {/* Australia */}
            <path d="M292 108 C312 102 326 112 322 124 C316 134 300 132 294 124 C288 120 286 112 292 108 Z" />
          </g>
        </g>
      </svg>
      {/* poster pins (HTML, projected with same transform) */}
      <div style={{ position: 'absolute', inset: 0 }}>
        {pins.map((p) => {
          const c = window.filmColor(p.filmId);
          const px = (projX(p.lng) * z + tx) / 360 * 100;
          const py = (projY(p.lat) * z + ty) / 180 * 100;
          if (px < -5 || px > 105 || py < -5 || py > 105) return null;
          return (
            <button key={p.id} className="fm-pin" onClick={() => onSelectPin(p)}
              style={{ left: px + '%', top: py + '%', transition: 'left 900ms cubic-bezier(.22,1,.36,1), top 900ms cubic-bezier(.22,1,.36,1)' }}>
              <span className="globe-pin-poster" style={{ background: `linear-gradient(150deg, ${c.a}, ${c.b})` }}>{c.mono}</span>
              <span className="globe-pin-stem" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- Feed mode ----
function Feed({ pins, accent, onOpenLoc, cityName }) {
  return (
    <div className="feed-scroll">
      <div style={{ height: 150 }} />
      <div className="feed-head">
        <div className="kicker" style={{ color: accent }}>
          <span className="dot-live" /> AROUND YOU {cityName ? '\u00B7 ' + cityName.toUpperCase() : ''}
        </div>
        <h1 className="feed-title">Nearby scenes</h1>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 16px 130px' }}>
        {pins.map((p) => {
          const c = window.filmColor(p.filmId);
          return (
            <button className="feed-card" key={p.id} onClick={() => onOpenLoc(p)}>
              <div className="feed-poster" style={{ background: `linear-gradient(155deg, ${c.a}, ${c.b})` }}>
                <span style={{ fontFamily: 'var(--display)', fontSize: 30, color: 'rgba(255,255,255,0.92)' }}>{c.mono}</span>
                <span className="feed-poster-play">{React.createElement(window.IconPlay, { size: 14 })}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div className="kicker" style={{ color: accent, marginBottom: 4 }}>{p.filmTitle.toUpperCase()}{' · '}{p.filmYear}</div>
                <div className="feed-scene">{p.scene}</div>
                <div className="feed-loc">{p.name}</div>
                <div className="feed-meta">
                  <span className="mini-dist" style={{ '--accent': accent }}>{p.distanceFt}{p.unit ? ' ' + p.unit : ' ft'}</span>
                  <span style={{ color: 'var(--text-faint)', fontSize: 12.5 }}>{p.city}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ExploreHome({ mode, onSetMode, accent, theme, onOpenLoc }) {
  const [focus, setFocus] = useXS(null);
  const [city, setCity] = useXS(null);
  const [sel, setSel] = useXS(null);          // selected pin preview
  const [searchOpen, setSearchOpen] = useXS(false);
  const [q, setQ] = useXS('');

  const pins = useXM(() => {
    if (!city) return window.ALL_PINS;
    return window.ALL_PINS.filter((p) => p.city === city.name);
  }, [city]);

  // globe shows one poster per film (world scale can't separate locations within a city)
  const globePins = useXM(() => window.FILMS.map((f) => {
    const loc = f.locations.find((l) => l.hero) || f.locations[0];
    return { ...loc, filmId: f.id, filmTitle: f.title, filmYear: f.year, director: f.director, city: f.city, region: f.region };
  }), []);

  function pickCity(ct) {
    setCity(ct); setFocus({ lat: ct.lat, lng: ct.lng }); setSearchOpen(false); setQ(''); setSel(null);
  }
  function clearCity() { setCity(null); setFocus(null); setSel(null); }

  const cityResults = window.CITIES.filter((c) =>
    !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.region.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="screen explore" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div className="leak leak-explore" style={{ '--leak': accent }} />

      {/* canvas / map / feed */}
      {mode === 'globe' && <window.GlobeView pins={globePins} onSelectPin={setSel} focus={focus} theme={theme} accent={accent} />}
      {mode === 'map' && <FlatMap pins={pins} accent={accent} focus={focus} onSelectPin={setSel} />}
      {mode === 'feed' && <Feed pins={pins} accent={accent} onOpenLoc={onOpenLoc} cityName={city && city.name} />}

      {/* top: title + search */}
      <div className="explore-top">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="kicker" style={{ color: accent }}>SELECTS</div>
            <div className="explore-h">{city ? city.name : 'Explore'}</div>
          </div>
          <div className="mode-seg">
            {[['globe', window.IconCompass], ['map', window.IconPin], ['feed', window.IconGrid]].map(([m, Ic]) => (
              <button key={m} className={'seg-btn ' + (mode === m ? 'seg-on' : '')} onClick={() => onSetMode(m)}
                style={mode === m ? { '--accent': accent } : {}}>
                {React.createElement(Ic, { size: 17 })}
              </button>
            ))}
          </div>
        </div>
        <button className="search-bar" onClick={() => setSearchOpen(true)}>
          <span style={{ display: 'inline-flex', color: 'var(--text-faint)' }}>{React.createElement(window.IconSearch, { size: 18 })}</span>
          <span style={{ color: city ? 'var(--text)' : 'var(--text-faint)' }}>{city ? city.name + ', ' + city.region : 'Search a city, film or scene'}</span>
          {city && <span className="clear-x" onClick={(e) => { e.stopPropagation(); clearCity(); }}>{React.createElement(window.IconClose, { size: 14 })}</span>}
        </button>
      </div>

      {/* hint for globe/map */}
      {(mode === 'globe' || mode === 'map') && !sel && (
        <div className="globe-hint">{mode === 'globe' ? 'Drag to spin \u00B7 tap a poster' : (city ? 'Tap a poster pin' : 'Search a city to zoom in')}</div>
      )}

      {/* selected pin preview card */}
      {sel && (mode === 'globe' || mode === 'map') && (
        <div className="sel-card" key={sel.id}>
          <button className="sel-close" onClick={() => setSel(null)}>{React.createElement(window.IconClose, { size: 15 })}</button>
          <button className="sel-main" onClick={() => onOpenLoc(sel)}>
            <div className="sel-poster" style={{ background: `linear-gradient(155deg, ${window.filmColor(sel.filmId).a}, ${window.filmColor(sel.filmId).b})` }}>
              <span style={{ fontFamily: 'var(--display)', fontSize: 26, color: '#fff' }}>{window.filmColor(sel.filmId).mono}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <div className="kicker" style={{ color: accent }}>{sel.filmTitle.toUpperCase()}{' · '}{sel.filmYear}</div>
              <div className="sel-scene">{sel.scene}</div>
              <div className="sel-loc">{sel.name}{' · '}{sel.city}</div>
            </div>
            <div className="sel-go" style={{ '--accent': accent }}>{React.createElement(window.IconChevR, { size: 18 })}</div>
          </button>
        </div>
      )}

      {/* bottom sheet for globe/map: nearby rail */}
      {(mode === 'globe' || mode === 'map') && (
        <div className="sheet">
          <window.Grabber />
          <div className="sheet-head">
            <div style={{ fontWeight: 650, fontSize: 16 }}>{city ? `${pins.length} scenes in ${city.name}` : `${pins.length} scenes worldwide`}</div>
            <div style={{ fontSize: 13, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>{window.FILMS.length} films</div>
          </div>
          <div className="poster-rail">
            {pins.map((p) => {
              const c = window.filmColor(p.filmId);
              return (
                <button className="rail-card" key={p.id} onClick={() => onOpenLoc(p)}>
                  <div className="rail-poster" style={{ background: `linear-gradient(155deg, ${c.a}, ${c.b})` }}>
                    <span style={{ fontFamily: 'var(--display)', fontSize: 26, color: 'rgba(255,255,255,0.92)' }}>{c.mono}</span>
                    <span className="rail-play">{React.createElement(window.IconPlay, { size: 12 })}</span>
                  </div>
                  <div className="rail-scene">{p.scene}</div>
                  <div className="rail-loc">{p.name}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* search overlay */}
      {searchOpen && (
        <div className="search-overlay">
          <div className="search-overlay-bar">
            <span style={{ display: 'inline-flex', color: 'var(--text-faint)' }}>{React.createElement(window.IconSearch, { size: 18 })}</span>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="City, film or scene" className="search-input" />
            <button className="search-cancel" onClick={() => { setSearchOpen(false); setQ(''); }}>Cancel</button>
          </div>
          <div className="search-results">
            <div className="search-sec">CITIES</div>
            {cityResults.map((ct) => (
              <button className="city-row" key={ct.id} onClick={() => pickCity(ct)}>
                <span style={{ display: 'inline-flex', color: accent }}>{React.createElement(window.IconPin, { size: 18 })}</span>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontWeight: 550, fontSize: 16 }}>{ct.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>{ct.region}</div>
                </div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)' }}>{ct.count} scenes</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { ExploreHome, FlatMap, Feed });
