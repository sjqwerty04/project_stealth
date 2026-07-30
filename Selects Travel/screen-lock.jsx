// screen-lock.jsx — iOS lock screen + proximity notification (the hero entry)
function LockScreen({ notif, accent, onOpen, onOpenApp, theme }) {
  const c = window.filmColor(notif.filmId);

  return (
    <div className="screen lock" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* wallpaper */}
      <image-slot id="lock-wall" shape="rect" fit="cover"
        placeholder="Drop a film still"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}></image-slot>
      <div style={{ position: 'absolute', inset: 0, background:
        'linear-gradient(180deg, rgba(8,8,12,0.55) 0%, rgba(8,8,12,0.12) 26%, rgba(8,8,12,0.20) 60%, rgba(8,8,12,0.85) 100%)' }} />
      {/* light leak */}
      <div className="leak leak-lock" style={{ '--leak': accent }} />

      {/* top cluster */}
      <div style={{ position: 'absolute', top: 64, left: 0, right: 0, textAlign: 'center', color: '#fff', zIndex: 3 }}>
        <div className="loc-active">
          <span className="dot-live" />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.08em' }}>LOCATION ACTIVE</span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 500, opacity: 0.9, marginTop: 26, letterSpacing: '0.01em' }}>Thursday, June 11</div>
        <div style={{ fontSize: 86, fontWeight: 300, lineHeight: 1, letterSpacing: '-0.02em', marginTop: 2,
          textShadow: '0 2px 30px rgba(0,0,0,0.4)' }}>9:41</div>
      </div>

      {/* notification */}
      <div style={{ position: 'absolute', left: 12, right: 12, bottom: 96, zIndex: 4 }}>
        <button onClick={onOpen} className="notif">
          <div className="notif-icon" style={{ background: `linear-gradient(150deg, ${c.a}, ${c.b})` }}>
            <span style={{ fontFamily: 'var(--display)', fontSize: 22, color: '#fff', lineHeight: 1 }}>S</span>
          </div>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em' }}>SELECTS</span>
              <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>now</span>
              <span className="notif-dist">{notif.distanceFt}{notif.unit ? ' ' + notif.unit : ' ft'}</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 3, lineHeight: 1.28, color: '#fff' }}>
              {"You’re "}{notif.distanceFt}{notif.unit ? ' ' + notif.unit : ' feet'}{" from "}{notif.headline}
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--text-dim)', marginTop: 3, lineHeight: 1.3 }}>
              {notif.sub}{" · Tap to step into the scene"}
            </div>
          </div>
        </button>
      </div>

      {/* bottom hint */}
      <button onClick={onOpenApp} style={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.62)',
        fontSize: 13, zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '8px 14px' }}>
        <span style={{ display: 'inline-flex' }}>{React.createElement(window.IconCompass, { size: 16 })}</span>
        Swipe up to open SELECTS
      </button>
    </div>
  );
}

Object.assign(window, { LockScreen });
