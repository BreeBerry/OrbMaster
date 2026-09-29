/* OrbMaster trailer — composition + audio. Reads window.OM_SCENES. */
(function () {
  const { Sprite, useTimeline } = window;
  const S = window.OM_SCENES;

  const HOOKS = { mindbreaker: S.HookMindbreaker, crack: S.HookCrack, climb: S.HookClimb };
  const DUR = 30;

  // Background music as an in-timeline <video> (an mp3 plays audio-only).
  // The data-om-exportable-video-play-* attrs make the exporter MIX its audio
  // into the rendered MP4. It is NOT muted, so it also plays in live preview.
  function MusicTrack({ src }) {
    const { time, playing } = useTimeline();
    const ref = React.useRef(null);
    const playingRef = React.useRef(playing);
    playingRef.current = playing;
    React.useEffect(() => {
      const v = ref.current;
      if (!v) return;
      if (playing) v.play().catch(() => {});
      else v.pause();
    }, [playing]);
    React.useEffect(() => {
      const v = ref.current;
      if (!v || !v.duration) return;
      const target = Math.min(time, v.duration - 0.05);
      if (Math.abs(v.currentTime - target) > 0.3) v.currentTime = target;
    }, [time]);
    // Browsers block unmuted autoplay without a gesture, and the Stage
    // autoplays. Start the track on the first user interaction (the play
    // button, space, or any click anywhere in the page all count).
    React.useEffect(() => {
      const kick = () => { const v = ref.current; if (v && playingRef.current) v.play().catch(() => {}); };
      window.addEventListener('pointerdown', kick);
      window.addEventListener('keydown', kick);
      return () => { window.removeEventListener('pointerdown', kick); window.removeEventListener('keydown', kick); };
    }, []);
    return (
      <video
        ref={ref}
        src={src}
        playsInline
        preload="auto"
        data-om-exportable-video-play-start={0}
        data-om-exportable-video-play-end={DUR}
        data-om-exportable-video-play-speed={1}
        style={{ position: 'absolute', left: 0, top: 0, width: 2, height: 2, opacity: 0, pointerEvents: 'none' }}
      />
    );
  }

  function Trailer({ variant = 'mindbreaker', W, H, port, audioSrc = '../assets/audio/mindbreaker-theme.mp3' }) {
    const Hook = HOOKS[variant] || S.HookMindbreaker;
    return (
      <>
        <MusicTrack src={audioSrc} />
        <Sprite start={0} end={5.5}><Hook W={W} H={H} port={port} /></Sprite>
        <Sprite start={5.5} end={13.5}><S.DeductionScene W={W} H={H} port={port} /></Sprite>
        <Sprite start={13.5} end={20.5}><S.BossScene W={W} H={H} port={port} /></Sprite>
        <Sprite start={20.5} end={26.0}><S.DailyScene W={W} H={H} port={port} /></Sprite>
        <Sprite start={26.0} end={30.0}><S.LogoScene W={W} H={H} port={port} /></Sprite>
      </>
    );
  }

  // Kept as a no-op for backward compatibility (audio now lives in MusicTrack).
  function AudioSync() { return null; }

  window.OM_TRAILER = { Trailer, AudioSync, MusicTrack };
})();
