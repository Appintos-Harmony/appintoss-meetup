import { useEffect, useRef, useState } from 'react';
import type { Route } from '../App';
import { CHORDS, type Chord, unlockAudio, chordOn, chordOff, allOff } from '../audio/engine';
import { chordReducer, initialChordState, type ChordState } from '../audio/chordReducer';
import {
  BEATS_PER_BAR,
  BPM,
  msToTick,
  tickToMs,
  onBeat,
  startMetronome,
  stopMetronome,
  transportSeconds,
} from '../audio/transport';
import { saveSong, newSongId, listSongs, type Song } from '../lib/storage';

// Phase 2: 메트로놈 + 1마디 카운트인 + Transport tick clock + 이벤트 녹음/재생.
type Phase = 'idle' | 'countin' | 'recording';

export function Studio({ go, loaded }: { go: (r: Route) => void; loaded: Song | null }) {
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState<Chord | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [metroOn, setMetroOn] = useState(false);
  const [beat, setBeat] = useState(-1);
  const [hasTake, setHasTake] = useState(false);
  const [toast, setToast] = useState('');

  const stateRef = useRef<ChordState>(initialChordState);
  const recordStartRef = useRef(0);
  const phaseRef = useRef<Phase>('idle');
  phaseRef.current = phase;

  useEffect(() => {
    onBeat((beatInBar, bar) => {
      setBeat(beatInBar);
      // 카운트인(0번 마디) 끝나고 1번 마디 진입 시 실제 녹음 시작.
      if (phaseRef.current === 'countin' && bar >= 1) {
        stateRef.current = initialChordState;
        recordStartRef.current = transportSeconds();
        setPhase('recording');
      }
    });
    return () => stopMetronome();
  }, []);

  // 홈에서 곡 열기 → 이벤트 복구.
  useEffect(() => {
    if (loaded) {
      stateRef.current = { ...initialChordState, events: loaded.events };
      setHasTake(loaded.events.length > 0);
    }
  }, [loaded]);

  async function ensureAudio() {
    if (!ready) {
      await unlockAudio();
      setReady(true);
    }
  }

  function curTick(): number {
    if (phaseRef.current !== 'recording') return 0;
    return msToTick((transportSeconds() - recordStartRef.current) * 1000);
  }

  function down(chord: Chord) {
    void ensureAudio().then(() => {
      const prev = stateRef.current.activeChord as Chord | null;
      stateRef.current = chordReducer(stateRef.current, {
        type: 'down',
        chord,
        source: 'touch',
        tick: curTick(),
        nowMs: performance.now(),
      });
      if (prev && prev !== chord) chordOff(prev);
      chordOn(chord);
      setActive(chord);
    });
  }

  function up(chord: Chord) {
    stateRef.current = chordReducer(stateRef.current, {
      type: 'up',
      source: 'touch',
      tick: curTick(),
      nowMs: performance.now(),
    });
    chordOff(chord);
    setActive(null);
  }

  async function toggleMetro() {
    await ensureAudio();
    if (metroOn) {
      setMetroOn(false);
      if (phase === 'idle') {
        stopMetronome();
        setBeat(-1);
      }
    } else {
      setMetroOn(true);
      startMetronome();
    }
  }

  async function toggleRec() {
    await ensureAudio();
    if (phase === 'idle') {
      setPhase('countin');
      startMetronome();
    } else {
      // 정지
      allOff();
      if (phase === 'recording') setHasTake(stateRef.current.events.length > 0);
      setPhase('idle');
      if (!metroOn) {
        stopMetronome();
        setBeat(-1);
      }
    }
  }

  async function play() {
    await ensureAudio();
    for (const ev of stateRef.current.events) {
      window.setTimeout(() => {
        if (ev.phase === 'on') chordOn(ev.chord as Chord);
        else chordOff(ev.chord as Chord);
      }, tickToMs(ev.tick));
    }
  }

  function saveCurrent() {
    const events = stateRef.current.events;
    if (!events.length) return;
    const name = `내 곡 ${listSongs().length + 1}`;
    saveSong({ id: newSongId(), name, bpm: BPM, events, createdAt: Date.now() });
    setToast(`'${name}' 저장됨`);
    window.setTimeout(() => setToast(''), 1800);
  }

  const recording = phase === 'recording';
  const countin = phase === 'countin';
  const countdown = BEATS_PER_BAR - (beat < 0 ? 0 : beat);

  return (
    <>
      <div className="appbar">
        스튜디오
        <span
          className="c-sub"
          style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 400 }}
          onClick={() => go('home')}
        >
          홈
        </span>
      </div>
      <div className="content">
        {/* 상태/박자 표시 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 28 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {Array.from({ length: BEATS_PER_BAR }).map((_, i) => (
              <span
                key={i}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: beat === i ? 'var(--blue)' : 'var(--line)',
                  transition: 'background .05s',
                }}
              />
            ))}
          </div>
          <span className="t-cap c-sub">
            {countin ? `카운트인 ${countdown}` : recording ? '녹음 중' : !ready ? '코드를 누르면 소리가 켜져요' : '준비됨'}
          </span>
        </div>

        {/* 4코드 패드 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
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

        {/* 컨트롤 */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button
            className="btn"
            style={{
              flex: 1,
              background: metroOn ? 'var(--blue)' : 'var(--surface)',
              color: metroOn ? '#fff' : 'var(--text)',
              boxShadow: metroOn ? 'var(--shadow-press)' : 'var(--shadow)',
            }}
            onClick={toggleMetro}
          >
            🥁 메트로놈
          </button>
          <button
            className="btn"
            style={{ flex: 1, background: phase !== 'idle' ? 'var(--t-coral)' : 'var(--blue)' }}
            onClick={toggleRec}
          >
            {phase !== 'idle' ? '■ 정지' : '● 녹음'}
          </button>
          <button
            className="btn"
            style={{
              flex: 1,
              background: 'var(--surface)',
              color: hasTake ? 'var(--text)' : 'var(--sub)',
              boxShadow: 'var(--shadow)',
            }}
            disabled={!hasTake || phase !== 'idle'}
            onClick={play}
          >
            ▶ 재생
          </button>
        </div>

        {hasTake && phase === 'idle' && (
          <button className="btn" style={{ marginTop: 10 }} onClick={saveCurrent}>
            💾 이 연주 저장
          </button>
        )}
        {toast && (
          <div style={{ marginTop: 12, textAlign: 'center', color: 'var(--blue)', fontWeight: 700, fontSize: 14 }}>
            {toast}
          </div>
        )}
      </div>
    </>
  );
}
