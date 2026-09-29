/* OrbMaster trailer — scene library.
   Reads the timeline globals from window (animations.jsx loads first).
   Orientation-aware: every scene takes {W, H, port}. Brand colors are
   hardcoded hex (CSS custom props don't survive the SVG video export). */
(function () {
  const { Sprite, useSprite, useTime, Easing, interpolate, animate, clamp } = window;

  // ── brand palette ──
  const C = {
    night: '#1a0a2e', abyss: '#0d0020', void: '#07030f',
    violet: '#7c3aed', amethyst: '#a855f7', indigo: '#4f46e5',
    lav: '#e9d5ff', lav2: '#c4b5fd', lav3: '#a78bfa', cream: '#f0e6d3',
    magenta: '#e879f9', pink: '#f9a8d4',
    gold: '#fbbf24', amber: '#f59e0b', orange: '#fb923c',
    teal: '#0d9488', teal3: '#5eead4', cyan: '#22d3ee',
    win: '#34d399', lose: '#f87171', red: '#dc2626', white: '#f0f0f0',
  };
  const SANS = '"Segoe UI", system-ui, -apple-system, Roboto, sans-serif';
  const MONO = '"Roboto Mono", ui-monospace, monospace';
  const PIXEL = '"Press Start 2P", monospace';
  const A = '../assets/';
  const orbSrc = (c) => A + 'orbs/' + c + '.png';

  // ── small helpers ──
  const lerp = (a, b, t) => a + (b - a) * t;
  // pop-in 0→1 with overshoot, gated to appear at `at`
  function popIn(lt, at, dur = 0.45) {
    if (lt < at) return 0;
    return Easing.easeOutBack(clamp((lt - at) / dur, 0, 1));
  }
  function fadeIn(lt, at, dur = 0.4) {
    return clamp((lt - at) / dur, 0, 1);
  }

  // =====================================================================
  // Shared atoms
  // =====================================================================

  function Backdrop({ src, scrim = 0.62, scale0 = 1.06, scale1 = 1.16, tint }) {
    const { localTime, duration } = useSprite();
    const p = clamp(localTime / Math.max(0.01, duration), 0, 1);
    const s = lerp(scale0, scale1, p);
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: C.void }}>
        {src && <img src={src} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${s})`, transformOrigin: 'center' }} />}
        <div style={{ position: 'absolute', inset: 0, background: tint || `radial-gradient(circle at 50% 42%, rgba(40,12,80,0.25), rgba(7,3,15,${scrim}) 78%)` }} />
        <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 240px rgba(0,0,0,0.85)' }} />
      </div>
    );
  }

  // Big marketing caption — kicker + headline, centered.
  function Caption({ W, H, port, at = 0, kicker, lines, color = '#fff', y, accent = C.amethyst }) {
    const { localTime } = useSprite();
    const o = fadeIn(localTime, at, 0.45);
    const rise = (1 - Easing.easeOutCubic(clamp((localTime - at) / 0.6, 0, 1))) * 26;
    const big = port ? 88 : 76;
    const cy = y != null ? y : (port ? H - 360 : H - 230);
    return (
      <div style={{ position: 'absolute', left: 0, right: 0, top: cy, textAlign: 'center', opacity: o, transform: `translateY(${rise}px)`, padding: '0 8%' }}>
        {kicker && (
          <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: port ? 26 : 24, letterSpacing: '0.42em', textTransform: 'uppercase', color: accent, marginBottom: 18, textShadow: `0 0 16px ${accent}` }}>{kicker}</div>
        )}
        {lines.map((ln, i) => (
          <div key={i} style={{ fontFamily: SANS, fontWeight: 800, fontSize: big, lineHeight: 1.04, color, letterSpacing: '-0.01em', textShadow: '0 4px 24px rgba(0,0,0,0.8)' }}>{ln}</div>
        ))}
      </div>
    );
  }

  function Orb({ c, size, x, y, scale = 1, glow = true, dim = false }) {
    return (
      <div style={{ position: 'absolute', left: x, top: y, width: size, height: size, transform: `translate(-50%,-50%) scale(${scale})`, filter: glow ? `drop-shadow(0 0 ${size * 0.22}px ${({red:C.red,blue:C.indigo,green:C.win,yellow:C.gold,orange:C.orange,purple:C.amethyst,pink:C.pink,teal:C.teal3}[c]) || C.amethyst})` : 'none', opacity: dim ? 0.5 : 1 }}>
        <img src={orbSrc(c)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
    );
  }

  function Peg({ kind, size, x, y, scale = 1 }) {
    const bg = kind === 'red' ? C.red : kind === 'white' ? C.white : 'rgba(255,255,255,0.10)';
    const glow = kind === 'red' ? `0 0 ${size * 0.5}px ${C.red}` : kind === 'white' ? `0 0 ${size * 0.5}px rgba(255,255,255,0.7)` : 'none';
    return <div style={{ position: 'absolute', left: x, top: y, width: size, height: size, borderRadius: '50%', background: bg, boxShadow: glow, transform: `translate(-50%,-50%) scale(${scale})`, border: kind === 'empty' ? '1px solid rgba(255,255,255,0.15)' : 'none' }} />;
  }

  window.OM_ATOMS = { C, SANS, MONO, PIXEL, A, orbSrc, lerp, popIn, fadeIn, Backdrop, Caption, Orb, Peg, Sprite, useSprite, useTime, Easing, interpolate, animate, clamp };
})();
