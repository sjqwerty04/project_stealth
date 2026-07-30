// screen-detail.jsx — scene detail: video / map+BTS / stories
const { useState: useDS, useEffect: useDE, useRef: useDR } = React;

function ScenePlayer({ loc, film, accent }) {
  const [playing, setPlaying] = useDS(false);
  const [t, setT] = useDS(28); // seconds into a fake 198s clip
  const total = 198;
  useDE(() => {
    if (!playing) return;
    const iv = setInterval(() => setT((x) => (x >= total ? 0 : x + 1)), 1000);
    return () => clearInterval(iv);
  }, [playing]);
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const c = window.filmColor(film.id);

  return (
    <div className="player">
      <image-slot id={`still-${loc.id}`} shape="rect" fit="cover"
        placeholder="Drop the scene still / clip frame"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}></image-slot>
      <div className="player-grain" />
      <div style={{ position: 'absolute', inset: 0, background:
        'linear-gradient(180deg, rgba(6,6,10,0.45) 0%, rgba(6,6,10,0) 30%, rgba(6,6,10,0) 55%, rgba(6,6,10,0.82) 100%)' }} />
      {/* letterbox */}
      <div className="bar-top-letter" /><div className="bar-bot-letter" />

      {/* now playing tag */}
      <div className="np-tag">
        <span className="np-rec" />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.06em' }}>
          {playing ? 'NOW PLAYING' : 'SCENE CLIP'}{' · '}{loc.sceneNo}
        </span>
      </div>

      {/* center play */}
      <button className="play-btn" onClick={() => setPlaying((p) => !p)} style={{ '--accent': accent }}>
        {playing
          ? <span style={{ display: 'flex', gap: 5 }}><span className="pause-bar" /><span className="pause-bar" /></span>
          : React.createElement(window.IconPlay, { size: 30, style: { marginLeft: 3 } })}
      </button>

      {/* scrubber */}
      <div className="scrub">
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#fff' }}>{fmt(t)}</span>
        <div className="scrub-track">
          <div className="scrub-fill" style={{ width: `${(t / total) * 100}%`, background: accent }} />
          <div className="scrub-knob" style={{ left: `${(t / total) * 100}%`, background: accent }} />
        </div>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>-{fmt(total - t)}</span>
      </div>
    </div>
  );
}

function ActionBtn({ icon, label, onClick, active, accent }) {
  return (
    <button className={'act ' + (active ? 'act-on' : '')} onClick={onClick} style={active ? { '--accent': accent } : {}}>
      <span style={{ display: 'inline-flex' }}>{React.createElement(icon, { size: 19 })}</span>
      <span>{label}</span>
    </button>
  );
}

function SceneDetail({ loc, film, accent, onBack, onSelectLoc, saved, onToggleSave }) {
  const scRef = useDR(null);
  const [scrolled, setScrolled] = useDS(false);
  useDE(() => {
    const el = scRef.current; if (!el) return;
    const h = () => setScrolled(el.scrollTop > 220);
    el.addEventListener('scroll', h); return () => el.removeEventListener('scroll', h);
  }, []);
  const others = film.locations.filter((l) => l.id !== loc.id);
  const distLabel = `${loc.distanceFt}${loc.unit ? ' ' + loc.unit : ' ft'}`;
  const walkMin = loc.unit === 'mi' ? `${Math.round(loc.distanceFt * 18)} min drive` : `${Math.max(1, Math.round(loc.distanceFt / 250))} min walk`;
  const c = window.filmColor(film.id);

  return (
    <div className="screen detail" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* floating top bar */}
      <div className={'detail-top ' + (scrolled ? 'detail-top-solid' : '')}>
        <button className="round-glass" onClick={onBack}>{React.createElement(window.IconChevL, { size: 20 })}</button>
        <div className={'detail-top-title ' + (scrolled ? 'show' : '')}>{loc.name}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="round-glass" onClick={onToggleSave} style={saved ? { color: accent } : {}}>
            {React.createElement(saved ? window.IconBookmarkF : window.IconBookmark, { size: 18 })}
          </button>
          <button className="round-glass">{React.createElement(window.IconShare, { size: 18 })}</button>
        </div>
      </div>

      <div ref={scRef} className="detail-scroll">
        <ScenePlayer loc={loc} film={film} accent={accent} />

        <div className="detail-body">
          {/* title block */}
          <div className="kicker" style={{ color: accent }}>
            <span style={{ display: 'inline-flex' }}>{React.createElement(window.IconFilm, { size: 14 })}</span>
            {film.title.toUpperCase()}{' · '}{film.year}
          </div>
          <h1 className="scene-title">{loc.scene}</h1>
          <div className="scene-sub">
            {film.director}{' · '}{film.runtime}{' · '}{loc.timecode}
          </div>

          {/* place + distance */}
          <div className="place-row">
            <div className="place-pin" style={{ background: `linear-gradient(150deg, ${c.a}, ${c.b})` }}>
              {React.createElement(window.IconPin, { size: 18 })}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="place-name">{loc.name}</div>
              <div className="place-addr">{loc.address}</div>
            </div>
            <div className="dist-chip" style={{ '--accent': accent }}>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{distLabel}</span>
              <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{walkMin}</span>
            </div>
          </div>

          {/* actions */}
          <div className="act-row">
            <ActionBtn icon={window.IconNav} label="Directions" accent={accent} active />
            <ActionBtn icon={saved ? window.IconBookmarkF : window.IconBookmark} label={saved ? 'Saved' : 'Save'} onClick={onToggleSave} active={saved} accent={accent} />
            <ActionBtn icon={window.IconShare} label="Share" accent={accent} />
          </div>

          <p className="blurb">{loc.blurb}</p>

          {/* MAP */}
          <SectionLabel n="01" t="Where you are" accent={accent} />
          <window.StreetMap accent={accent} label={distLabel} sub={'\u00B7 ' + walkMin} height={236} />
          <button className="big-btn" style={{ '--accent': accent }}>
            <span style={{ display: 'inline-flex' }}>{React.createElement(window.IconNav, { size: 18 })}</span>
            Walk me there
          </button>

          {/* BTS */}
          <SectionLabel n="02" t="On location" accent={accent} sub="Behind the scenes" />
          <div className="bts-rail">
            {['The exterior', 'The corner booth', 'On set, ' + film.year, 'Today'].map((cap, i) => (
              <div className="bts-card" key={i}>
                <image-slot id={`bts-${loc.id}-${i}`} shape="rect" fit="cover"
                  placeholder="Drop photo"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}></image-slot>
                <div className="bts-cap">{cap}</div>
              </div>
            ))}
          </div>

          {/* STORIES */}
          {loc.stories && loc.stories.length > 0 && (
            <React.Fragment>
              <SectionLabel n="03" t="The story" accent={accent} sub={`${loc.stories.length} notes`} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {loc.stories.map((s, i) => (
                  <div className="story" key={i}>
                    <div className="story-q" style={{ color: accent }}>{'\u201C'}</div>
                    <div>
                      <div className="story-t">{s.t}</div>
                      <div className="story-b">{s.b}</div>
                    </div>
                  </div>
                ))}
              </div>
            </React.Fragment>
          )}

          {/* MORE FROM FILM */}
          {others.length > 0 && (
            <React.Fragment>
              <SectionLabel n="04" t={`More of ${film.title}`} accent={accent} sub={`${film.locations.length} spots in ${film.city}`} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {others.map((o) => (
                  <button className="more-row" key={o.id} onClick={() => onSelectLoc(o)}>
                    <div className="more-thumb" style={{ background: `linear-gradient(150deg, ${c.a}, ${c.b})` }}>
                      {React.createElement(window.IconFilm, { size: 18 })}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div className="more-scene">{o.scene}</div>
                      <div className="more-name">{o.name}</div>
                    </div>
                    <span className="more-dist">{o.distanceFt}{o.unit ? ' ' + o.unit : ' ft'}</span>
                    <span style={{ display: 'inline-flex', color: 'var(--text-faint)' }}>{React.createElement(window.IconChevR, { size: 16 })}</span>
                  </button>
                ))}
              </div>
            </React.Fragment>
          )}

          <div style={{ height: 40 }} />
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ n, t, sub, accent }) {
  return (
    <div className="sec-label">
      <span className="sec-n" style={{ color: accent }}>{n}</span>
      <span className="sec-t">{t}</span>
      {sub && <span className="sec-sub">{sub}</span>}
    </div>
  );
}

Object.assign(window, { SceneDetail });
