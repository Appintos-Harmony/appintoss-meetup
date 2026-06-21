import { useRef, useState } from 'react';
import type { Route } from '../App';
import { CHORDS, type Chord, unlockAudio, chordOn, chordOff } from '../audio/engine';
import { chordReducer, initialChordState, type ChordState } from '../audio/chordReducer';

// Phase 1: 터치 4코드 + 첫 소리(AudioContext unlock) + activeChord reducer 기록/재생.
// (메트로놈·카운트인·제스처 이식은 Phase 2/3)
const TICKS_PER_BEAT = 4;
const BPM = 100;
const msToTick = (ms: number) => Math.round((ms / 1000) * (BPM / 60) * TICKS_PER_BEAT);
const tickToMs = (tick: number) => (tick / TICKS_PER_BEAT) * (60 / BPM) * 1000;

export function Studio({ go }: { go: (r: Route) => void }) {
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState<Chord | null>(null);
  const [recording, setRecording] = useState(false);
  const stateRef = useRef<ChordState>(initialChordState);
  const startRef = useRef(0);

  async function ensureAudio() {
    if (!ready) {
      await unlockAudio();
      setReady(true);
    }
  }

  function down(chord: Chord) {
    void ensureAudio().then(() => {
      const now = performance.now();
      const tick = recording ? msToTick(now - startRef.current) : 0;
      const prev = stateRef.current.activeChord as Chord | null;
      stateRef.current = chordReducer(stateRef.current, { type: 'down', chord, source: 'touch', tick, nowMs: now });
      if (prev && prev !== chord) chordOff(prev);
      chordOn(chord);
      setActive(chord);
    });
  }

  function up(chord: Chord) {
    const now = performance.now();
    const tick = recording ? msToTick(now - startRef.current) : 0;
    stateRef.current = chordReducer(stateRef.current, { type: 'up', source: 'touch', tick, nowMs: now });
    chordOff(chord);
    setActive(null);
  }

  function toggleRec() {
    if (!recording) {
      stateRef.current = initialChordState;
      startRef.current = performance.now();
      setRecording(true);
    } else {
      setRecording(false);
    }
  }

  async function play() {
    await ensureAudio();
    for (const ev of stateRef.current.events) {
      const ms = tickToMs(ev.tick);
      window.setTimeout(() => {
        if (ev.phase === 'on') chordOn(ev.chord as Chord);
        else chordOff(ev.chord as Chord);
      }, ms);
    }
  }

  return (
    <>
      <div className="appbar">
        스튜디오
        <span className="c-sub" style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 400 }} onClick={() => go('home')}>
          홈
        </span>
      </div>
      <div className="content">
        {!ready && <p className="t-cap c-sub">코드를 누르면 소리가 켜져요.</p>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
          {CHORDS.map((c) => (
            <button
              key={c}
              onPointerDown={() => down(c)}
              onPointerUp={() => up(c)}
              onPointerLeave={() => active === c && up(c)}
              style={{
                aspectRatio: '1',
                border: 0,
                borderRadius: 20,
                fontSize: 34,
                fontWeight: 800,
                background: active === c ? 'var(--blue)' : 'var(--surface)',
                color: active === c ? '#fff' : 'var(--key-dark)',
                boxShadow: active === c ? 'var(--shadow-press)' : 'var(--shadow)',
                transition: 'transform .06s, background .06s',
                transform: active === c ? 'scale(.97)' : 'none',
              }}
            >
              {c}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button className="btn" style={{ background: recording ? 'var(--t-coral)' : 'var(--blue)' }} onClick={toggleRec}>
            {recording ? '■ 정지' : '● 녹음'}
          </button>
          <button
            className="btn"
            style={{ background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--shadow)' }}
            onClick={play}
          >
            ▶ 재생
          </button>
        </div>
      </div>
    </>
  );
}
