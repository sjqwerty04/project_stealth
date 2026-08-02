// globe.jsx — dotted spinning 3D globe (canvas) with HTML poster pins overlaid.
// Drag to spin, momentum, idle auto-rotate, fly-to a target lat/lng.
const { useRef, useEffect } = React;

// Fibonacci sphere of unit vectors
function fibSphere(n) {
  const pts = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;       // -1..1
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    pts.push([Math.cos(theta) * r, y, Math.sin(theta) * r]);
  }
  return pts;
}

function latLngToVec(lat, lng) {
  const la = (lat * Math.PI) / 180, lo = (lng * Math.PI) / 180;
  return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
}

// rotate vec by rotY (around Y) then rotX (around X)
function rotate(v, rx, ry) {
  let [x, y, z] = v;
  const ca = Math.cos(ry), sa = Math.sin(ry);
  let x1 = x * ca + z * sa;
  let z1 = -x * sa + z * ca;
  const cb = Math.cos(rx), sb = Math.sin(rx);
  let y2 = y * cb - z1 * sb;
  let z2 = y * sb + z1 * cb;
  return [x1, y2, z2];
}

function GlobeView({ pins = [], onSelectPin, focus, theme, accent = '#9b8cff' }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const pinLayerRef = useRef(null);
  const pinEls = useRef({});           // id -> { el }
  const rot = useRef({ x: 0.52, y: 1.02 });
  const idleCenter = useRef({ x: 0.52, y: 1.02 });
  const idlePhase = useRef(0);
  const drag = useRef(null);
  const target = useRef(null);         // {x,y} fly-to
  const dots = useRef(fibSphere(1300));
  const sizeRef = useRef({ w: 360, h: 360, dpr: 1 });

  // fly-to when focus changes
  useEffect(() => {
    if (!focus) { idleCenter.current = { x: 0.52, y: 1.02 }; return; }
    const v = latLngToVec(focus.lat, focus.lng);
    const ry = -Math.atan2(v[0], v[2]);
    // positive X-tilt brings northern latitudes to the front-center
    const rx = Math.max(-1.0, Math.min(1.0, Math.asin(Math.max(-1, Math.min(1, v[1]))) * 0.85));
    target.current = { x: rx, y: ry };
    idleCenter.current = { x: rx, y: ry };
  }, [focus]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf;

    function resize() {
      const r = wrapRef.current.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      sizeRef.current = { w: r.width, h: r.height, dpr };
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      canvas.style.width = r.width + 'px';
      canvas.style.height = r.height + 'px';
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrapRef.current);

    const isLight = theme === 'light';

    function draw() {
      const { w, h, dpr } = sizeRef.current;
      const cx = (w / 2) * dpr, cy = (h / 2) * dpr;
      const R = Math.min(w, h) * 0.42 * dpr;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // physics
      if (drag.current) {
        // handled in pointermove
      } else if (target.current) {
        const t = target.current;
        rot.current.y += (t.y - rot.current.y) * 0.08;
        rot.current.x += (t.x - rot.current.x) * 0.08;
        if (Math.abs(t.y - rot.current.y) < 0.002 && Math.abs(t.x - rot.current.x) < 0.002) {
          target.current = null;
        }
      } else {
        // gentle sway that keeps the populated hemisphere in view
        idlePhase.current += 0.0045;
        const it = idleCenter.current.y + Math.sin(idlePhase.current) * 0.32;
        rot.current.y += (it - rot.current.y) * 0.012;
        rot.current.x += (idleCenter.current.x - rot.current.x) * 0.012;
      }
      const rx = rot.current.x, ry = rot.current.y;

      // atmosphere glow
      const glow = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, R * 1.5);
      glow.addColorStop(0, hexA(accent, isLight ? 0.10 : 0.16));
      glow.addColorStop(1, hexA(accent, 0));
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.5, 0, Math.PI * 2); ctx.fill();

      // sphere base disc (subtle)
      const disc = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R * 1.05);
      disc.addColorStop(0, isLight ? 'rgba(255,255,255,0.9)' : 'rgba(40,38,60,0.55)');
      disc.addColorStop(1, isLight ? 'rgba(228,228,238,0.7)' : 'rgba(10,10,16,0.0)');
      ctx.fillStyle = disc;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

      // light direction for shading
      const L = [-0.5, 0.55, 0.7];
      const Llen = Math.hypot(...L); const Ln = L.map((c) => c / Llen);

      // dots
      const dd = dots.current;
      for (let i = 0; i < dd.length; i++) {
        const v = rotate(dd[i], rx, ry);
        if (v[2] < -0.12) continue;
        const sx = cx + v[0] * R, sy = cy - v[1] * R;
        const shade = Math.max(0, v[0] * Ln[0] + v[1] * Ln[1] + v[2] * Ln[2]);
        const front = (v[2] + 1) / 2;          // 0..1
        const a = (isLight ? 0.18 : 0.10) + shade * (isLight ? 0.5 : 0.62) * front;
        const rad = (0.6 + 0.9 * front) * dpr;
        // tint a fraction of dots toward accent
        const useAccent = (i % 11 === 0);
        ctx.fillStyle = useAccent ? hexA(accent, a * 0.95) : (isLight ? `rgba(60,60,80,${a})` : `rgba(232,230,245,${a})`);
        ctx.beginPath(); ctx.arc(sx, sy, rad, 0, Math.PI * 2); ctx.fill();
      }

      // limb darkening ring
      ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(155,140,255,0.12)';
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();

      // pins -> position HTML chips
      for (let i = 0; i < pins.length; i++) {
        const p = pins[i];
        const rec = pinEls.current[p.id];
        if (!rec) continue;
        const v = rotate(latLngToVec(p.lat, p.lng), rx, ry);
        const front = v[2] > -0.05;
        const sx = (cx + v[0] * R) / dpr, sy = (cy - v[1] * R) / dpr;
        const sc = 0.7 + 0.5 * ((v[2] + 1) / 2);
        const el = rec.el;
        if (!front) { el.style.opacity = '0'; el.style.pointerEvents = 'none'; }
        else {
          el.style.opacity = String(Math.max(0, Math.min(1, 0.5 + 0.7 * v[2])));
          el.style.pointerEvents = v[2] > 0.1 ? 'auto' : 'none';
        }
        el.style.transform = `translate(-50%,-100%) translate(${sx}px, ${sy}px) scale(${sc.toFixed(3)})`;
        el.style.zIndex = String(1000 + Math.round(v[2] * 1000));
      }

      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

    // drag handlers
    const wrap = wrapRef.current;
    function down(e) {
      const pt = e.touches ? e.touches[0] : e;
      drag.current = { px: pt.clientX, py: pt.clientY, moved: 0 };
      target.current = null;
    }
    function move(e) {
      if (!drag.current) return;
      const pt = e.touches ? e.touches[0] : e;
      const dx = pt.clientX - drag.current.px;
      const dy = pt.clientY - drag.current.py;
      drag.current.moved += Math.abs(dx) + Math.abs(dy);
      rot.current.y += dx * 0.006;
      rot.current.x = Math.max(-1.1, Math.min(1.1, rot.current.x - dy * 0.006));
      drag.current.px = pt.clientX; drag.current.py = pt.clientY;
      if (e.cancelable) e.preventDefault();
    }
    function up() { drag.current = null; }
    wrap.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    wrap.addEventListener('touchstart', down, { passive: true });
    wrap.addEventListener('touchmove', move, { passive: false });
    wrap.addEventListener('touchend', up);

    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      wrap.removeEventListener('mousedown', down);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      wrap.removeEventListener('touchstart', down);
      wrap.removeEventListener('touchmove', move);
      wrap.removeEventListener('touchend', up);
    };
  }, [pins, theme, accent]);

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0, cursor: 'grab', touchAction: 'none' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
      <div ref={pinLayerRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
        {pins.map((p) => {
          const c = window.filmColor(p.filmId);
          return (
            <button
              key={p.id}
              ref={(el) => { if (el) pinEls.current[p.id] = { el }; }}
              onClick={() => onSelectPin && onSelectPin(p)}
              className="globe-pin"
              style={{ position: 'absolute', left: 0, top: 0, opacity: 0 }}
            >
              <span className="globe-pin-poster" style={{ background: `linear-gradient(150deg, ${c.a}, ${c.b})` }}>
                {c.mono}
              </span>
              <span className="globe-pin-stem" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

Object.assign(window, { GlobeView, hexA });
