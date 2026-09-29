/* OrbMaster trailer — scenes. Reads atoms from window.OM_ATOMS.
   Each scene is a component taking {W,H,port}; it lives inside a <Sprite>
   so useSprite() gives localTime within the scene's window. */
(function () {
  const T = window.OM_ATOMS;
  const { C, SANS, MONO, PIXEL, A, orbSrc, lerp, popIn, fadeIn, Orb, Peg, Caption, Backdrop, useSprite, Easing, clamp } = T;

  // ===================================================================
  // HERO — the deduction board (place orbs → pegs → crack the code)
  // ===================================================================
  function GuessRow({ orbs, reds, whites, x, y, os, og, lt, orbAt, orbStagger, pegAt, active }) {
    const cells = orbs.length;
    const pegBox = os * 0.92;
    // peg cluster sits right of the orbs
    const pegX = x + cells * (os + og) + os * 0.35;
    const pegS = os * 0.30, pegGap = pegS * 1.35;
    const pegs = [];
    for (let i = 0; i < 4; i++) {
      const kind = i < reds ? 'red' : i < reds + whites ? 'white' : 'empty';
      pegs.push(kind);
    }
    return (
      <div>
        {/* row plate */}
        <div style={{ position: 'absolute', left: x - os * 0.4, top: y - os * 0.62, width: cells * (os + og) + pegBox + os * 0.5, height: os * 1.24, borderRadius: os * 0.32,
          background: active ? 'rgba(88,28,220,0.28)' : 'rgba(30,10,74,0.55)', border: `2px solid ${active ? C.amethyst : 'rgba(124,58,237,0.5)'}`,
          boxShadow: active ? `0 0 26px rgba(168,85,247,0.45)` : 'none' }} />
        {orbs.map((c, i) => {
          const at = orbAt + i * orbStagger;
          const s = orbAt >= 0 ? popIn(lt, at, 0.42) : 1;
          const drop = orbAt >= 0 ? (1 - clamp((lt - at) / 0.42, 0, 1)) * -os * 0.9 : 0;
          if (s <= 0) return null;
          return <Orb key={i} c={c} size={os} x={x + i * (os + og) + os / 2} y={y + drop} scale={s} glow />;
        })}
        {pegs.map((k, i) => {
          const col = i % 2, rw = Math.floor(i / 2);
          const ps = popIn(lt, pegAt + i * 0.08, 0.3);
          return <Peg key={i} kind={k} size={pegS} x={pegX + col * pegGap} y={y - pegGap / 2 + rw * pegGap} scale={k === 'empty' ? 1 : ps} />;
        })}
      </div>
    );
  }

  function DeductionScene({ W, H, port }) {
    const { localTime } = useSprite();
    const lt = localTime;
    const os = port ? 104 : 92, og = port ? 20 : 18;
    const cells = 4;
    const boardW = cells * (os + og) + os * 1.9;
    const bx = W / 2 - boardW / 2 + os * 0.4;
    const topY = port ? 600 : 300;
    const rowH = os * 1.5;
    const boardTop = port ? 510 : 250;
    const boardH = port ? 1090 : 640;

    // header (boss strip)
    const headO = fadeIn(lt, 0.1, 0.5);
    // prior rows
    const prior = [
      { orbs: ['red', 'blue', 'green', 'yellow'], reds: 1, whites: 1 },
      { orbs: ['orange', 'purple', 'blue', 'green'], reds: 1, whites: 2 },
      { orbs: ['orange', 'blue', 'green', 'purple'], reds: 2, whites: 1 },
    ];
    const solve = ['orange', 'blue', 'purple', 'green'];
    const solved = lt > 3.5;
    const winGlow = clamp((lt - 3.4) / 0.5, 0, 1);

    return (
      <div style={{ position: 'absolute', inset: 0 }}>
        <Backdrop src={A + 'backgrounds/bg-1.png'} scrim={0.72} />
        {/* phone frame */}
        <div style={{ position: 'absolute', left: W / 2, top: boardTop + boardH / 2, transform: 'translate(-50%,-50%)',
          width: boardW + os * 1.1, height: boardH, borderRadius: 64, border: '3px solid rgba(124,58,237,0.5)',
          background: 'linear-gradient(180deg, rgba(26,10,46,0.6), rgba(13,0,32,0.75))', boxShadow: '0 0 0 12px rgba(10,5,25,0.6), 0 40px 120px rgba(0,0,0,0.7)', opacity: headO }} />

        {/* boss banner — 16:9 thumbnail above the board */}
        <div style={{ position: 'absolute', left: W / 2, top: port ? 250 : 64, transform: 'translateX(-50%)', textAlign: 'center', opacity: headO }}>
          <img src={A + 'bosses/06-pretty-pea.png'} alt="" style={{ width: port ? 380 : 232, borderRadius: 18, border: '2px solid rgba(124,58,237,0.6)', boxShadow: '0 0 24px rgba(168,85,247,0.4)' }} />
          <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: port ? 40 : 28, color: C.lav, marginTop: 6 }}>Pretty Pea&nbsp;&nbsp;<span style={{ fontFamily: MONO, fontWeight: 700, fontSize: port ? 24 : 19, color: solved ? C.win : C.orange, letterSpacing: '0.08em' }}>{solved ? '· CRACKED' : '· 3 LEFT'}</span></div>
        </div>

        {prior.map((r, i) => (
          <GuessRow key={i} {...r} x={bx} y={topY + i * rowH} os={os} og={og} lt={lt}
            orbAt={0.2 + i * 0.12} orbStagger={0.05} pegAt={0.5 + i * 0.12} />
        ))}
        {/* active solve row */}
        <GuessRow orbs={solve} reds={4} whites={0} x={bx} y={topY + 3 * rowH} os={os} og={og} lt={lt}
          orbAt={1.5} orbStagger={0.28} pegAt={3.0} active={!solved} />

        {/* SOLVED burst */}
        {winGlow > 0 && (
          <div style={{ position: 'absolute', left: W / 2, top: topY + 3 * rowH, transform: `translate(-50%,-50%) scale(${0.6 + winGlow * 0.4})`, opacity: winGlow }}>
            <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: port ? 96 : 78, color: C.win, textShadow: `0 0 40px ${C.win}`, letterSpacing: '0.04em' }}>SOLVED</div>
          </div>
        )}

        <Caption W={W} H={H} port={port} at={0.6} kicker="The deduction duel"
          lines={port ? ['Read the pegs.', 'Crack the code.'] : ['Read the pegs. Crack the code.']}
          y={port ? H - 250 : H - 170} accent={C.amethyst} />
      </div>
    );
  }

  // ===================================================================
  // BOSS ROSTER montage → MindBreaker
  // ===================================================================
  function BossScene({ W, H, port }) {
    const { localTime, duration } = useSprite();
    const lt = localTime;
    const ALL = ['01-lemons','02-templefrist','03-bigginsly','04-nanomic','05-natty-d','06-pretty-pea','07-sir-louie','08-queen-asabeth','09-elkgore','10-mad-martin'];
    // gentle full-scene drift on the whole grid
    const drift = lerp(1.0, 1.06, clamp(lt / duration, 0, 1));

    return (
      <div style={{ position: 'absolute', inset: 0 }}>
        <Backdrop src={A + 'backgrounds/stone-wall.png'} scrim={0.74} />

        {/* all ten bosses — staggered pop-in, then hold */}
        <div style={{ position: 'absolute', left: W / 2, top: port ? H / 2 - 180 : H / 2 - 70, transform: `translate(-50%,-50%) scale(${drift})`, display: 'grid', gridTemplateColumns: port ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: port ? 28 : 26, width: port ? 900 : 1480 }}>
          {ALL.map((f, i) => {
            const s = popIn(lt, 0.15 + i * 0.07, 0.45);
            return <div key={f} style={{ transform: `scale(${clamp(s, 0, 1.12)})`, opacity: clamp(s, 0, 1) }}><img src={`${A}bosses/${f}.png`} alt="" style={{ width: '100%', borderRadius: 16, border: '2px solid rgba(124,58,237,0.45)', filter: 'drop-shadow(0 0 18px rgba(168,85,247,0.4))' }} /></div>;
          })}
        </div>

        <Caption W={W} H={H} port={port} at={1.1} kicker="The campaign"
          lines={port ? ['Ten minds.', 'One you.'] : ['Ten minds. One you.']}
          accent={C.amethyst}
          y={port ? H - 320 : H - 160} />
      </div>
    );
  }

  // ===================================================================
  // DAILY + STREAK + LEADERBOARD
  // ===================================================================
  function DailyScene({ W, H, port }) {
    const { localTime } = useSprite();
    const lt = localTime;
    const cardO = popIn(lt, 0.2, 0.5);
    const streakN = Math.round(interpFlame(lt));
    function interpFlame(t) { return clamp((t - 0.8) / 1.0, 0, 1) * 12; }
    const rows = [
      ['cipher_kate', '3 · 0:41', false, '🦊'],
      ['orbwizard', '3 · 0:58', false, '🧙'],
      ['You', '4 · 0:52', true, '🔮'],
      ['deductodon', '4 · 1:10', false, '🦕'],
    ];
    const lbAt = 1.6;
    const cardW = port ? 760 : 560;

    return (
      <div style={{ position: 'absolute', inset: 0 }}>
        <Backdrop src={A + 'backgrounds/bg-4.png'} scrim={0.74} tint={`radial-gradient(circle at 50% 40%, rgba(13,80,74,0.30), rgba(7,3,15,0.82) 75%)`} />

        {/* Daily card */}
        <div style={{ position: 'absolute', left: port ? W / 2 : W * 0.30, top: port ? 300 : H / 2, transform: `translate(-50%,${port ? '0' : '-50%'}) scale(${cardO})`, width: cardW,
          background: 'linear-gradient(160deg, rgba(45,27,105,0.62), rgba(15,5,40,0.7))', border: `2px solid ${C.teal}`, borderRadius: 36, padding: port ? 40 : 30, textAlign: 'center', boxShadow: '0 0 40px rgba(13,148,136,0.4)' }}>
          <img src={A + 'bosses/mindbreaker.png'} alt="" style={{ width: '74%', filter: 'drop-shadow(0 0 22px rgba(13,148,136,0.7))' }} />
          <div style={{ display: 'inline-block', fontFamily: SANS, fontWeight: 800, fontSize: port ? 26 : 22, color: C.teal3, border: `2px solid ${C.teal3}`, borderRadius: 999, padding: '6px 22px', margin: '6px 0' }}>DAILY · HARD</div>
          <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: port ? 40 : 32, color: C.orange, marginTop: 10 }}>🔥 {streakN} DAY STREAK</div>
        </div>

        {/* Leaderboard rows */}
        <div style={{ position: 'absolute', left: port ? W / 2 : W * 0.72, top: port ? 1140 : H / 2, transform: `translate(-50%,${port ? '0' : '-50%'})`, width: port ? 800 : 620, display: 'flex', flexDirection: 'column', gap: port ? 14 : 12 }}>
          {rows.map((r, i) => {
            const s = popIn(lt - lbAt, i * 0.12, 0.42);
            const slide = (1 - clamp((lt - lbAt - i * 0.12) / 0.42, 0, 1)) * 60;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: port ? '16px 22px' : '12px 18px', borderRadius: 18, opacity: clamp(s, 0, 1), transform: `translateX(${slide}px)`,
                background: r[2] ? 'rgba(13,148,136,0.22)' : 'rgba(45,27,105,0.5)', border: `2px solid ${r[2] ? C.teal3 : 'rgba(124,58,237,0.35)'}` }}>
                <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: port ? 30 : 24, color: C.gold, width: 36 }}>{i + 1}</div>
                <div style={{ width: port ? 52 : 44, height: port ? 52 : 44, borderRadius: '50%', background: 'rgba(13,0,32,0.6)', border: `2px solid ${C.violet}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: port ? 28 : 22 }}>{r[3]}</div>
                <div style={{ flex: 1, fontFamily: SANS, fontWeight: 700, fontSize: port ? 32 : 26, color: C.lav }}>{r[0]}{r[2] && <span style={{ fontFamily: MONO, fontSize: port ? 18 : 15, background: C.teal, color: '#fff', borderRadius: 8, padding: '2px 10px', marginLeft: 12 }}>YOU</span>}</div>
                <div style={{ fontFamily: MONO, fontSize: port ? 24 : 20, color: C.lav3 }}>{r[1]}</div>
              </div>
            );
          })}
        </div>

        <Caption W={W} H={H} port={port} at={lbAt + 0.4} kicker="Compete worldwide"
          lines={port ? ['A new code', 'every day.'] : ['A new code every day.']} accent={C.teal3}
          y={port ? H - 300 : H - 150} />
      </div>
    );
  }

  // ===================================================================
  // LOGO STING
  // ===================================================================
  function LogoScene({ W, H, port }) {
    const { localTime, duration } = useSprite();
    const lt = localTime;
    const logoS = Easing.easeOutBack(clamp(lt / 0.8, 0, 1));
    const glow = 0.4 + 0.6 * Math.abs(Math.sin(lt * 1.6));
    const tagO = fadeIn(lt, 0.9, 0.6);
    const iconO = popIn(lt, 1.4, 0.6);
    return (
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 42%, #2a0f4e 0%, ${C.abyss} 60%, ${C.void} 100%)` }}>
        {/* drifting orb sparks */}
        {['purple','teal','pink','gold','red','blue'].map((c, i) => {
          const ang = (i / 6) * Math.PI * 2 + lt * 0.4;
          const rad = (port ? 360 : 320) + Math.sin(lt + i) * 24;
          return <Orb key={c} c={c} size={port ? 70 : 60} x={W / 2 + Math.cos(ang) * rad} y={(port ? H / 2 - 120 : H / 2 - 40) + Math.sin(ang) * rad * 0.6} glow scale={0.8} dim />;
        })}
        <img src={A + 'logos/title.png'} alt="OrbMaster" style={{ position: 'absolute', left: W / 2, top: port ? H / 2 - 140 : H / 2 - 60, transform: `translate(-50%,-50%) scale(${logoS})`, width: port ? 860 : 760, filter: `drop-shadow(0 0 ${30 * glow}px rgba(168,85,247,0.9))` }} />
        <div style={{ position: 'absolute', left: W / 2, top: port ? H / 2 + 180 : H / 2 + 200, transform: 'translateX(-50%)', textAlign: 'center', opacity: tagO }}>
          <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: port ? 52 : 46, color: '#fff', letterSpacing: '0.01em', textShadow: '0 2px 18px rgba(0,0,0,0.7)' }}>Crack the code. Master the Orbs.</div>
          <div style={{ marginTop: port ? 40 : 28, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, opacity: iconO }}>
            <img src={A + 'logos/app-icon.png'} alt="" style={{ width: port ? 110 : 92, borderRadius: 24, boxShadow: '0 0 30px rgba(168,85,247,0.6)' }} />
          </div>
        </div>
      </div>
    );
  }

  // ===================================================================
  // HOOKS (0–5.5s) — three openings
  // ===================================================================
  function HookMindbreaker({ W, H, port }) {
    const { localTime } = useSprite();
    const lt = localTime;
    const zoom = lerp(1.18, 1.0, Easing.easeOutCubic(clamp(lt / 3.2, 0, 1)));
    const reveal = fadeIn(lt, 0.3, 1.0);
    const line1 = fadeIn(lt, 1.2, 0.5);
    const line2 = fadeIn(lt, 2.7, 0.5);
    const flick = 0.86 + 0.14 * Math.abs(Math.sin(lt * 9));
    return (
      <div style={{ position: 'absolute', inset: 0, background: C.void }}>
        <img src={A + 'bosses/mindbreaker.png'} alt="" style={{ position: 'absolute', left: W / 2, top: port ? H * 0.40 : H / 2, transform: `translate(-50%,-50%) scale(${zoom})`, width: port ? 1340 : 1500, opacity: reveal * flick, filter: 'drop-shadow(0 0 70px rgba(232,121,249,0.6))' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 45%, transparent 30%, rgba(7,3,15,0.85) 78%)' }} />
        {/* scanlines */}
        <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, rgba(232,121,249,0.05) 0 2px, transparent 2px 5px)', mixBlendMode: 'screen', opacity: 0.6 }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: port ? H - 620 : H - 250, textAlign: 'center', padding: '0 8%' }}>
          <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: port ? 30 : 26, letterSpacing: '0.3em', color: C.magenta, opacity: line1, textShadow: `0 0 18px ${C.magenta}` }}>I HID THE CODE.</div>
          <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: port ? 92 : 78, color: '#fff', marginTop: 18, opacity: line2, textShadow: '0 4px 24px rgba(0,0,0,0.8)' }}>Think you can crack it?</div>
        </div>
      </div>
    );
  }

  function HookCrack({ W, H, port }) {
    const { localTime } = useSprite();
    const lt = localTime;
    const os = port ? 150 : 130;
    const seq = ['orange', 'blue', 'purple', 'green'];
    const cx = W / 2, cy = port ? H / 2 - 120 : H / 2 - 40;
    const totalW = seq.length * os + (seq.length - 1) * 28;
    const startX = cx - totalW / 2 + os / 2;
    const pegAt = 2.2;
    const flash = clamp((lt - 2.5) / 0.18, 0, 1) * clamp(1 - (lt - 2.7) / 0.4, 0, 1);
    const headO = fadeIn(lt, 3.0, 0.5);
    return (
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 42%, #240b44, ${C.void} 75%)` }}>
        {seq.map((c, i) => {
          const at = 0.4 + i * 0.32;
          const s = popIn(lt, at, 0.4);
          const drop = (1 - clamp((lt - at) / 0.4, 0, 1)) * -260;
          if (s <= 0) return null;
          return <Orb key={i} c={c} size={os} x={startX + i * (os + 28)} y={cy + drop} scale={s} glow />;
        })}
        {/* pegs */}
        {[0,1,2,3].map((i) => {
          const s = popIn(lt, pegAt + i * 0.1, 0.3);
          return <Peg key={i} kind={i < 3 ? 'red' : 'white'} size={os * 0.34} x={cx - os * 0.55 + (i % 2) * os * 0.7} y={cy + os * 0.95 + Math.floor(i / 2) * os * 0.7} scale={s} />;
        })}
        <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: flash * 0.5 }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: port ? H - 520 : H - 250, textAlign: 'center', opacity: headO }}>
          <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: port ? 28 : 24, letterSpacing: '0.34em', color: C.amethyst }}>RED. WHITE. REPEAT.</div>
          <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: port ? 104 : 86, color: '#fff', marginTop: 16, textShadow: '0 4px 24px rgba(0,0,0,0.8)' }}>CRACK THE CODE</div>
        </div>
      </div>
    );
  }

  function HookClimb({ W, H, port }) {
    const { localTime } = useSprite();
    const lt = localTime;
    const tiers = ['Novice', 'Cipher', 'Adept', 'Savant', 'MindBreaker', 'OrbMaster'];
    const ti = Math.min(tiers.length - 1, Math.floor(lt / 0.5));
    const frames = ['novice','cipher','adept','savant','mindbreaker','orbmaster'];
    const headO = fadeIn(lt, 3.2, 0.5);
    const crestS = popIn(lt, 0.2, 0.5);
    return (
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 40%, #102a3e, ${C.void} 76%)` }}>
        {/* climbing crest */}
        <div style={{ position: 'absolute', left: W / 2, top: port ? H / 2 - 180 : H / 2 - 70, transform: `translate(-50%,-50%) scale(${crestS})`, textAlign: 'center' }}>
          <img src={`${A}frames/${frames[ti]}.png`} alt="" style={{ width: port ? 380 : 320, filter: 'drop-shadow(0 0 30px rgba(168,85,247,0.6))' }} />
          <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: port ? 54 : 44, color: ti >= 4 ? C.gold : C.lav, marginTop: 8, textShadow: ti >= 4 ? `0 0 24px ${C.gold}` : 'none' }}>{tiers[ti]}</div>
        </div>
        {/* rising bar */}
        <div style={{ position: 'absolute', left: W / 2, top: port ? H / 2 + 120 : H / 2 + 140, transform: 'translateX(-50%)', width: port ? 620 : 540, height: 16, borderRadius: 999, background: 'rgba(13,0,32,0.6)', overflow: 'hidden', border: '2px solid rgba(124,58,237,0.4)' }}>
          <div style={{ width: `${clamp(lt / 3.0, 0, 1) * 100}%`, height: '100%', background: `linear-gradient(90deg, ${C.violet}, ${C.cyan})` }} />
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: port ? H - 520 : H - 250, textAlign: 'center', opacity: headO }}>
          <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: port ? 28 : 24, letterSpacing: '0.3em', color: C.cyan }}>SIX RANKS. ONE THRONE.</div>
          <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: port ? 100 : 84, color: '#fff', marginTop: 16, textShadow: '0 4px 24px rgba(0,0,0,0.8)' }}>OUTRANK THEM ALL</div>
        </div>
      </div>
    );
  }

  const { interpolate } = T;
  window.OM_SCENES = { DeductionScene, BossScene, DailyScene, LogoScene, HookMindbreaker, HookCrack, HookClimb };
})();
