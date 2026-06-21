import { useEffect, useRef, useState } from 'react';
import type { Route } from '../App';
import { CHORDS, type Chord, unlockAudio, chordOn, chordOff, allOff } from '../audio/engine';
import { chordReducer, initialChordState, type ChordState, type Source } from '../audio/chordReducer';
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
import { initHandTracking, startCamera, stopCamera, detect } from '../audio/gesture';

// Phase 0~3 통합 스튜디오: 터치/제스처 입력(세그먼트, 동시 바인딩 금지) + 메트로놈 + 카운트인 +
// tick clock + 이벤트 녹음/재생 + 로컬 저장. 제스처는 검증 스파이크 로직을 라이트 셸에 이식.
type Phase = 'idle' | 'countin' | 'recording';
type Input = 'touch' | 'gesture';

export function Studio({ go, loaded }: { go: (r: Route) => void; loaded: Song | null }) {
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState<Chord | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [metroOn, setMetroOn] = useState(false);
  const [beat, setBeat] = useState(-1);
  const [hasTake, setHasTake] = useState(false);
  const [toast, setToast] = useState('');
  const [input, setInput] = useState<Input>('touch');
  const [camMsg, setCamMsg] = useState('');

  const stateRef = useRef<ChordState>(initialChordState);
  const recordStartRef = useRef(0);
  const phaseRef = useRef<Phase>('idle');
  phaseRef.current = phase;
  const soundingRef = useRef<Chord | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    onBeat((beatInBar, bar) => {
      setBeat(beatInBar);
      if (phaseRef.current === 'countin' && bar >= 1) {
        stateRef.current = initialChordState;
        recordStartRef.current = transportSeconds();
        setPhase('recording');
      }
    });
    return () => {
      stopMetronome();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stopCamera(streamRef.current);
    };
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

  // 오디오를 reducer의 activeChord에 동기화 — 같은 코드 재트리거 방지(제스처 매 프레임 호출 대비).
  function applyChord(next: Chord | null) {
    if (soundingRef.current === next) return;
    if (soundingRef.current) chordOff(soundingRef.current);
    if (next) chordOn(next);
    soundingRef.current = next;
  }

  function downChord(chord: Chord, source: Source) {
    stateRef.current = chordReducer(stateRef.current, {
      type: 'down',
      chord,
      source,
      tick: curTick(),
      nowMs: performance.now(),
    });
    const a = stateRef.current.activeChord as Chord | null;
    applyChord(a);
    setActive(a);
  }

  function upChord(source: Source) {
    stateRef.current = chordReducer(stateRef.current, {
      type: 'up',
      source,
      tick: curTick(),
      nowMs: performance.now(),
    });
    const a = stateRef.current.activeChord as Chord | null;
    applyChord(a);
    setActive(a);
  }

  // 제스처 인식 루프(편 손=지속, 주먹/없음=멈춤). 같은 코드면 reducer가 무시.
  function loop() {
    const v = videoRef.current;
    if (v && v.readyState >= 2) {
      const f = detect(v, performance.now());
      if (f.present && f.open && f.zone !== null) downChord(CHORDS[f.zone], 'gesture');
      else upChord('gesture');
    }
    rafRef.current = requestAnimationFrame(loop);
  }

  function stopGestureLoop() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    stopCamera(streamRef.current);
    streamRef.current = null;
  }

  async function selectGesture() {
    if (input === 'gesture') return;
    setCamMsg('카메라 준비 중…');
    try {
      await ensureAudio();
      await initHandTracking();
      const v = videoRef.current;
      if (!v) throw new Error('no video');
      streamRef.current = await startCamera(v);
      setInput('gesture');
      setCamMsg('');
      rafRef.current = requestAnimationFrame(loop);
    } catch {
      stopGestureLoop();
      setInput('touch');
      setCamMsg('카메라를 쓸 수 없어 터치로 연주해요.');
    }
  }

  function selectTouch() {
    stopGestureLoop();
    upChord('gesture');
    setInput('touch');
    setCamMsg('');
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
      allOff();
      soundingRef.current = null;
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
    allOff();
    soundingRef.current = null;
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

  const segBtn = (on: boolean) => ({
    flex: 1,
    border: 0,
    borderRadius: 12,
    padding: '10px 0',
    fontWeight: 700,
    fontSize: 15,
    background: on ? 'var(--blue)' : 'transparent',
    color: on ? '#fff' : 'var(--sub)',
  });

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
        {/* 입력 세그먼트(현재 입력 상태 — 동시 바인딩 금지) */}
        <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg)', borderRadius: 14 }}>
          <button style={segBtn(input === 'touch')} onClick={selectTouch}>👆 터치</button>
          <button style={segBtn(input === 'gesture')} onClick={selectGesture}>👋 제스처</button>
        </div>

        {/* 상태/박자 표시 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 28, marginTop: 12 }}>
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
            {camMsg
              ? camMsg
              : countin
                ? `카운트인 ${countdown}`
                : recording
                  ? '녹음 중'
                  : !ready
                    ? '코드를 누르면 소리가 켜져요'
                    : '준비됨'}
          </span>
        </div>

        {/* 제스처 카메라 (항상 마운트 — 터치 모드선 숨김, ref 유지) */}
        <div
          style={{
            display: input === 'gesture' ? 'block' : 'none',
            position: 'relative',
            marginTop: 12,
            borderRadius: 20,
            overflow: 'hidden',
            background: '#000',
            aspectRatio: '4 / 3',
          }}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
          />
          <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
            {CHORDS.map((c, i) => (
              <div
                key={c}
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  paddingBottom: 14,
                  borderRight: i < 3 ? '1px solid rgba(255,255,255,.25)' : 'none',
                  background: active === c ? 'rgba(49,130,246,.4)' : 'transparent',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 24,
                  textShadow: '0 1px 3px rgba(0,0,0,.6)',
                }}
              >
                {c}
              </div>
            ))}
          </div>
        </div>

        {/* 터치 4코드 패드 */}
        {input === 'touch' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            {CHORDS.map((c) => (
              <button
                key={c}
                onPointerDown={() => void ensureAudio().then(() => downChord(c, 'touch'))}
                onPointerUp={() => upChord('touch')}
                onPointerLeave={() => active === c && upChord('touch')}
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
        )}

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
