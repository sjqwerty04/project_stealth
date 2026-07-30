// app.jsx — Root: device, navigation, tweaks
const { useState: useAS, useEffect: useAE, useRef: useAR } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "accent": "#9b8cff",
  "homeMode": "globe",
  "notifFilm": "heat",
  "leak": 0.85
}/*EDITMODE-END*/;

// notification copy per film
const NOTIFS = {
  heat:       { locId: 'heat-katemantilini', distanceFt: 350, unit: null, headline: 'the booth where Pacino and De Niro filmed Heat\u2019s only scene together', sub: 'Kate Mantilini \u00b7 Beverly Hills' },
  fast:       { locId: 'fast-bobs',          distanceFt: 420, unit: null, headline: 'Toretto\u2019s Market from The Fast and the Furious', sub: 'Bob\u2019s Market \u00b7 Angelino Heights' },
  darkknight: { locId: 'dk-lasalle',         distanceFt: 800, unit: null, headline: 'the canyon where Nolan flipped a truck in The Dark Knight', sub: 'LaSalle St \u00b7 Chicago' },
  skyfall:    { locId: 'sky-gallery',        distanceFt: 120, unit: null, headline: 'the bench where Bond meets Q in Skyfall', sub: 'Room 34 \u00b7 The National Gallery' },
  taken:      { locId: 'taken-birhakeim',    distanceFt: 240, unit: null, headline: 'the bridge from Taken\u2019s Paris chase', sub: 'Pont de Bir-Hakeim \u00b7 Paris' },
};

function buildNotif(filmId) {
  const n = NOTIFS[filmId] || NOTIFS.heat;
  return { ...n, filmId };
}

function Root() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const accent = t.accent || '#9b8cff';
  const theme = t.theme || 'dark';

  // nav — always land on the lock screen (the hero entry) each load
  const [screen, setScreen] = useAS('lock');
  const [locId, setLocId] = useAS('heat-katemantilini');
  const [mode, setMode] = useAS(t.homeMode || 'globe');
  const [saved, setSaved] = useAS(() => {
    try { return new Set(JSON.parse(localStorage.getItem('selects:saved') || '[]')); } catch (e) { return new Set(); }
  });

  // keep home mode synced with tweak
  useAE(() => { if (t.homeMode && t.homeMode !== mode) setMode(t.homeMode); }, [t.homeMode]);
  useAE(() => { localStorage.setItem('selects:saved', JSON.stringify([...saved])); }, [saved]);

  // theme vars on the device
  useAE(() => {
    document.documentElement.style.setProperty('--accent', accent);
    document.documentElement.style.setProperty('--leak-op', String(t.leak));
  }, [accent, t.leak]);

  const loc = window.getLocation(locId) || window.ALL_PINS[0];
  const film = window.getFilm(loc.filmId);
  const notif = buildNotif(t.notifFilm || 'heat');

  function openLoc(p) { setLocId(p.id); setScreen('detail'); }
  function toggleSave(id) {
    setSaved((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  // device scaling
  const stageRef = useAR(null);
  const [scale, setScale] = useAS(1);
  useAE(() => {
    function fit() {
      const W = 402, H = 874;
      const vw = window.innerWidth, vh = window.innerHeight;
      setScale(Math.min((vw - 24) / W, (vh - 24) / H, 1.15));
    }
    fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit);
  }, []);

  return (
    <div ref={stageRef} className={'stage ' + (theme === 'light' ? 'th-light' : 'th-dark')}>
      <div className="stage-leak" style={{ '--leak': accent }} />
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>
        <IOSDevice dark={theme === 'dark'}>
          <div className={'app-root ' + (theme === 'light' ? 'light' : '')} style={{ position: 'absolute', inset: 0 }}>
            {screen === 'lock' && (
              <div className="scr-anim" key="lock">
                <LockScreen notif={notif} accent={accent} theme={theme}
                  onOpen={() => openLoc({ id: notif.locId })} onOpenApp={() => setScreen('explore')} />
              </div>
            )}
            {screen === 'explore' && (
              <div className="scr-anim" key="explore">
                <ExploreHome mode={mode} onSetMode={(m) => { setMode(m); setTweak('homeMode', m); }}
                  accent={accent} theme={theme} onOpenLoc={openLoc} />
              </div>
            )}
            {screen === 'detail' && (
              <div className="scr-anim scr-up" key={'detail-' + locId}>
                <SceneDetail loc={loc} film={film} accent={accent}
                  onBack={() => setScreen('explore')}
                  onSelectLoc={(o) => setLocId(o.id)}
                  saved={saved.has(loc.id)} onToggleSave={() => toggleSave(loc.id)} />
              </div>
            )}
          </div>
        </IOSDevice>
      </div>

      <TweaksPanel>
        <TweakSection label="World" />
        <TweakRadio label="Home view" value={mode}
          options={[{ value: 'globe', label: 'Globe' }, { value: 'map', label: 'Map' }, { value: 'feed', label: 'Feed' }]}
          onChange={(v) => { setMode(v); setTweak('homeMode', v); if (screen === 'lock') setScreen('explore'); }} />
        <TweakColor label="Accent" value={accent}
          options={['#9b8cff', '#ff6a5b', '#4da3ff', '#3fd0c9', '#e8b24a']}
          onChange={(v) => setTweak('accent', v)} />
        <TweakSlider label="Light-leak glow" value={t.leak} min={0} max={1} step={0.05}
          onChange={(v) => setTweak('leak', v)} />
        <TweakToggle label="Dark mode" value={theme === 'dark'}
          onChange={(v) => setTweak('theme', v ? 'dark' : 'light')} />

        <TweakSection label="The notification" />
        <TweakSelect label="Triggered by" value={t.notifFilm}
          options={window.FILMS.map((f) => ({ value: f.id, label: `${f.title} (${f.year})` }))}
          onChange={(v) => setTweak('notifFilm', v)} />
        <TweakButton label="Replay lock-screen alert" onClick={() => setScreen('lock')} />
        <TweakButton label="Open the app" onClick={() => setScreen('explore')} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
