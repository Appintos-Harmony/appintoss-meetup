import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Route } from '../App';
import {
  CHORDS,
  type Chord,
  type Timbre,
  unlockAudio,
  chordOn,
  chordOff,
  allOff,
  setTimbre as engineSetTimbre,
  getTimbre,
  createVoice,
  TIMBRES,
  type Voice,
} from '../audio/engine';
import { chordReducer, initialChordState, type ChordState, type Source } from '../audio/chordReducer';
import { isChordName } from '../audio/tuning';
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
import {
  createSession,
  getSession,
  addTrack,
  copyText,
  readClipboardCode,
  PRELOAD,
  type Session,
  type SessionTrack,
} from '../lib/share';
import { getNickname } from '../lib/identity';

type Phase = 'idle' | 'countin' | 'recording';
type Input = 'touch' | 'gesture';
type PlayMode = 'chord' | 'melody';
type Sheet = 'timbre' | 'receive' | null;

const ACCENT: Record<Chord, [string, string]> = {
  C: ['#3182f6', '#1b64da'],
  Am: ['#8b5cf6', '#7c3aed'],
  F: ['#15c47e', '#0fa968'],
  G: ['#ff6b6b', '#ee5253'],
};
const ROMAN: Record<Chord, string> = { C: 'I', Am: 'vi', F: 'IV', G: 'V' };
const SIG = ['#3182f6', '#ff6b6b', '#15c47e', '#8b5cf6', '#ff9f1c'];
// 멜로디 피아노 건반: 흰/검은 건반 + 계이름. ▲▼ 옥타브 이동으로 음역 선택(기본 2옥타브).
const WHITE_PC = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const SOLFA: Record<string, string> = { C: '도', D: '레', E: '미', F: '파', G: '솔', A: '라', B: '시' };
// 검은건반(반음): pitch class + 바로 왼쪽 흰건반 인덱스(0~6). E·B 뒤에는 검은건반 없음.
const BLACK_PC: { pc: string; label: string; afterWhite: number }[] = [
  { pc: 'C#', label: '도#', afterWhite: 0 },
  { pc: 'D#', label: '레#', afterWhite: 1 },
  { pc: 'F#', label: '파#', afterWhite: 3 },
  { pc: 'G#', label: '솔#', afterWhite: 4 },
  { pc: 'A#', label: '라#', afterWhite: 5 },
];
const VISIBLE_OCTAVES = 2;
const OCTAVE_MIN = 1;
// 상한 5 → 보이는 최고 음 B6. 옥타브7 음(C7 등)이 7th 코드 이름과 충돌하는 것을 차단.
const OCTAVE_MAX = 5;

interface PianoKey {
  note: string;
  label: string;
}
interface BlackKey {
  note: string;
  label: string;
  leftPct: number;
}
// base 옥타브부터 VISIBLE_OCTAVES만큼의 흰/검은 건반을 만든다.
function buildKeys(base: number): { whites: PianoKey[]; blacks: BlackKey[] } {
  const whites: PianoKey[] = [];
  const blacks: BlackKey[] = [];
  const totalWhite = WHITE_PC.length * VISIBLE_OCTAVES;
  for (let oi = 0; oi < VISIBLE_OCTAVES; oi++) {
    const oct = base + oi;
    WHITE_PC.forEach((pc) => whites.push({ note: `${pc}${oct}`, label: SOLFA[pc] }));
    BLACK_PC.forEach((b) => {
      const whiteGlobal = oi * WHITE_PC.length + b.afterWhite;
      blacks.push({ note: `${b.pc}${oct}`, label: b.label, leftPct: ((whiteGlobal + 1) / totalWhite) * 100 });
    });
  }
  return { whites, blacks };
}
const TIMBRE_LABEL: Record<Timbre, string> = { acoustic: '어쿠스틱 피아노', electric: '전자 피아노' };
const TIMBRE_EMOJI: Record<Timbre, string> = { acoustic: '🎹', electric: '🎛️' };

export function Studio({ go, loaded }: { go: (r: Route) => void; loaded: Song | null }) {
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [playMode, setPlayMode] = useState<PlayMode>('chord');
  const [metroOn, setMetroOn] = useState(false);
  const [beat, setBeat] = useState(-1);
  const [hasTake, setHasTake] = useState(false);
  const [toast, setToast] = useState('');
  const [input, setInput] = useState<Input>('touch');
  const [camMsg, setCamMsg] = useState('');
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [baseOwner, setBaseOwner] = useState('');
  const [trackCount, setTrackCount] = useState(0);
  const [sessionTracks, setSessionTracks] = useState<SessionTrack[]>([]);
  const [jamming, setJamming] = useState(false);
  const [timbre, setTimbreState] = useState<Timbre>(() => getTimbre());
  const [sheet, setSheet] = useState<Sheet>(null);
  const [pending, setPending] = useState<Session | null>(null);
  const [octave, setOctave] = useState(4); // 멜로디 키보드 base 옥타브(C{octave}~B{octave+1})
  const [heldNotes, setHeldNotes] = useState<Set<string>>(new Set()); // 멜로디 하이라이트(동시)

  const stateRef = useRef<ChordState>(initialChordState);
  const recordStartRef = useRef(0);
  const phaseRef = useRef<Phase>('idle');
  phaseRef.current = phase;
  const soundingRef = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const voicesRef = useRef<Voice[]>([]);
  const heldRef = useRef<Set<string>>(new Set()); // 현재 울리는 멜로디 음(정리용)
  const pointerNoteRef = useRef<Map<number, string>>(new Map()); // pointerId → note(멀티터치)
  const playTimersRef = useRef<number[]>([]); // 재생 예약 타이머(중복 재생 취소용)

  useEffect(() => {
    onBeat((beatInBar, bar) => {
      setBeat(beatInBar);
      if (phaseRef.current === 'countin' && bar >= 1) {
        // 새 녹음 시작: 상태 초기화. 지금 누르고 있는 멜로디 음은 tick 0의 on으로 재등록(ref와 desync 방지).
        let st: ChordState = { ...initialChordState };
        for (const note of heldRef.current) {
          st = chordReducer(st, { type: 'down', chord: note, source: 'touch', tick: 0, nowMs: performance.now(), poly: true });
        }
        stateRef.current = st;
        recordStartRef.current = transportSeconds();
        setPhase('recording');
      }
    });
    return () => {
      stopMetronome();
      stopPlayback();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stopCamera(streamRef.current);
    };
  }, []);

  useEffect(() => {
    if (loaded) {
      stateRef.current = { ...initialChordState, events: loaded.events };
      setHasTake(loaded.events.length > 0);
    }
  }, [loaded]);

  useEffect(() => {
    if (!sessionCode) return;
    let alive = true;
    const tick = async () => {
      try {
        const s = await getSession(sessionCode);
        if (alive) {
          setTrackCount(s.tracks.length);
          setSessionTracks(s.tracks);
        }
      } catch {
        // 오프라인/프리로드 세션은 폴링 무시
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 1500);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [sessionCode]);

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

  function applyChord(next: string | null) {
    if (soundingRef.current === next) return;
    if (soundingRef.current) chordOff(soundingRef.current);
    if (next) chordOn(next);
    soundingRef.current = next;
  }

  function downChord(value: string, source: Source) {
    stateRef.current = chordReducer(stateRef.current, { type: 'down', chord: value, source, tick: curTick(), nowMs: performance.now() });
    const a = stateRef.current.activeChord;
    applyChord(a);
    setActive(a);
  }

  function upChord(source: Source) {
    stateRef.current = chordReducer(stateRef.current, { type: 'up', source, tick: curTick(), nowMs: performance.now() });
    const a = stateRef.current.activeChord;
    applyChord(a);
    setActive(a);
  }

  // 멜로디(폴리포니): 음별 독립 on/off + 멀티터치(pointerId별 추적). 코드/제스처 경로와 분리.
  function melodyDown(note: string, pointerId: number, el: Element) {
    // 캡처·포인터 매핑·tick은 이벤트 시점에 동기 처리(타이밍 안정), 발음은 오디오 언락 후.
    try {
      el.setPointerCapture(pointerId);
    } catch {
      /* 포인터 캡처 미지원 무시 */
    }
    pointerNoteRef.current.set(pointerId, note);
    const tick = curTick(); // 언락 지연으로 tick이 밀리지 않도록 누른 순간에 캡처
    const nowMs = performance.now();
    void ensureAudio().then(() => {
      // 누르고 있는 동안에만 발음(빠른 탭 후 이미 뗐으면 스킵).
      if (pointerNoteRef.current.get(pointerId) !== note) return;
      stateRef.current = chordReducer(stateRef.current, { type: 'down', chord: note, source: 'touch', tick, nowMs, poly: true });
      if (!heldRef.current.has(note)) {
        heldRef.current.add(note);
        chordOn(note);
        setHeldNotes(new Set(heldRef.current));
      }
    });
  }

  function melodyUp(pointerId: number) {
    const note = pointerNoteRef.current.get(pointerId);
    if (note === undefined) return;
    pointerNoteRef.current.delete(pointerId);
    // 같은 음을 누른 다른 손가락이 남아 있으면 끄지 않는다.
    if (Array.from(pointerNoteRef.current.values()).includes(note)) return;
    stateRef.current = chordReducer(stateRef.current, { type: 'up', chord: note, source: 'touch', tick: curTick(), nowMs: performance.now(), poly: true });
    heldRef.current.delete(note);
    chordOff(note);
    setHeldNotes(new Set(heldRef.current));
  }

  // 멜로디 정리: 보유 음을 reducer에도 off로 닫아 events/activeNotes와 ref를 한 트랜잭션에서 동기화한다.
  // (이걸 안 하면 activeNotes 잔류 → 같은 음 재입력 막힘·짝 없는 off·재생 무한 지속음)
  function clearMelody() {
    const now = performance.now();
    const tick = curTick();
    let st = stateRef.current;
    for (const note of Object.keys(st.activeNotes)) {
      st = chordReducer(st, { type: 'up', chord: note, source: 'touch', tick, nowMs: now, poly: true });
    }
    stateRef.current = st;
    heldRef.current.forEach((n) => chordOff(n));
    heldRef.current.clear();
    pointerNoteRef.current.clear();
    setHeldNotes(new Set());
  }

  function stopPlayback() {
    playTimersRef.current.forEach((id) => window.clearTimeout(id));
    playTimersRef.current = [];
  }

  function shiftOctave(d: number) {
    clearMelody(); // 건반 언마운트로 인한 stuck note 방지
    setOctave((o) => Math.min(OCTAVE_MAX, Math.max(OCTAVE_MIN, o + d)));
  }

  function switchMode(m: PlayMode) {
    if (m === playMode) return;
    allOff();
    soundingRef.current = null;
    setActive(null);
    clearMelody();
    if (m === 'melody') selectTouch();
    setPlayMode(m);
  }

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
      setCamMsg('카메라를 쓸 수 없어 터치로 연주해요');
    }
  }

  function selectTouch() {
    stopGestureLoop();
    upChord('gesture');
    setInput('touch');
    setCamMsg('');
  }

  function chooseTimbre(t: Timbre) {
    void ensureAudio().then(() => {
      engineSetTimbre(t);
      setTimbreState(t);
      chordOn('C');
      window.setTimeout(() => chordOff('C'), 600);
      setSheet(null);
    });
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
    stopPlayback();
    if (phase === 'idle') {
      setPhase('countin');
      startMetronome();
    } else {
      allOff();
      soundingRef.current = null;
      clearMelody();
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
    stopPlayback(); // 이전 재생 타이머 취소(중복 재생 겹침/stuck 방지)
    stopJam(); // 이전 재생 보이스 정리
    allOff();
    soundingRef.current = null;
    clearMelody();
    // 코드 이벤트와 멜로디 이벤트를 독립 보이스로 분리 → 같은 freq(예: 코드의 E4 vs 멜로디 E4) 충돌 방지.
    const chordVoice = createVoice(getTimbre());
    const melodyVoice = createVoice(getTimbre());
    voicesRef.current = [chordVoice, melodyVoice];
    let maxMs = 0;
    for (const ev of stateRef.current.events) {
      const ms = tickToMs(ev.tick);
      if (ms > maxMs) maxMs = ms;
      const voice = isChordName(ev.chord) ? chordVoice : melodyVoice;
      const id = window.setTimeout(() => {
        if (ev.phase === 'on') voice.on(ev.chord);
        else voice.off(ev.chord);
      }, ms);
      playTimersRef.current.push(id);
    }
    const endId = window.setTimeout(() => stopJam(), maxMs + 1500);
    playTimersRef.current.push(endId);
  }

  function stopJam() {
    voicesRef.current.forEach((v) => v.dispose());
    voicesRef.current = [];
    setJamming(false);
  }

  function playSession() {
    void ensureAudio().then(() => {
      stopJam();
      const tracks = sessionTracks.length ? sessionTracks : [{ owner: '나', events: stateRef.current.events, createdAt: 0 }];
      const voices = tracks.map((_, i) => createVoice(TIMBRES[i % TIMBRES.length]));
      voicesRef.current = voices;
      let maxMs = 0;
      tracks.forEach((t, i) => {
        for (const ev of t.events) {
          const ms = tickToMs(ev.tick);
          if (ms > maxMs) maxMs = ms;
          window.setTimeout(() => {
            if (ev.phase === 'on') voices[i].on(ev.chord);
            else voices[i].off(ev.chord);
          }, ms);
        }
      });
      setJamming(true);
      window.setTimeout(() => stopJam(), maxMs + 1500);
    });
  }

  function saveCurrent() {
    const events = stateRef.current.events;
    if (!events.length) return;
    const name = `내 곡 ${listSongs().length + 1}`;
    saveSong({ id: newSongId(), name, bpm: BPM, events, createdAt: Date.now() });
    flashToast(`'${name}' 저장됨`);
  }

  function flashToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2000);
  }

  async function share() {
    if (!stateRef.current.events.length) return;
    try {
      const code = await createSession({ name: '하모니 합주', bpm: BPM, owner: getNickname() || '익명', events: stateRef.current.events });
      setSessionCode(code);
      setSessionTracks([{ owner: getNickname() || '익명', events: stateRef.current.events, createdAt: Date.now() }]);
      const ok = await copyText(code);
      flashToast(ok ? `공유 코드 복사됨 · ${code}` : `공유 코드 · ${code}`);
    } catch {
      flashToast('공유 실패 — 네트워크 확인');
    }
  }

  async function receive() {
    let sess: Session;
    try {
      const code = await readClipboardCode();
      sess = code ? await getSession(code) : PRELOAD;
    } catch {
      sess = PRELOAD;
    }
    if (!sess.tracks[0]) {
      flashToast('받을 트랙이 없어요');
      return;
    }
    setPending(sess);
    setSheet('receive');
  }

  function confirmReceive() {
    if (!pending) return;
    const base = pending.tracks[0];
    stateRef.current = { ...initialChordState, events: base.events };
    setHasTake(true);
    setSessionCode(pending.code);
    setBaseOwner(base.owner);
    setTrackCount(pending.tracks.length);
    setSessionTracks(pending.tracks);
    setSheet(null);
    setPending(null);
    flashToast(`${base.owner}님 트랙을 얹을 준비 완료`);
  }

  async function overdub() {
    if (!sessionCode || !stateRef.current.events.length) return;
    try {
      await addTrack(sessionCode, getNickname() || '익명', stateRef.current.events);
      flashToast('얹기 완료! 🎶');
    } catch {
      flashToast('얹기 실패 — 네트워크 확인');
    }
  }

  const busy = phase !== 'idle';
  const recording = phase === 'recording';
  const countin = phase === 'countin';
  const countdown = BEATS_PER_BAR - (beat < 0 ? 0 : beat);
  const statusText = camMsg || (countin ? `카운트인 ${countdown}` : recording ? '녹음 중' : !ready ? '눌러서 소리 켜기' : '준비됐어요');

  const ctrlBtn = (bg: string, color: string, shadow = 'var(--e2)'): CSSProperties => ({ flex: 1, background: bg, color, boxShadow: shadow });

  return (
    <>
      <div className="appbar">
        스튜디오
        <span className="c-sub" style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 500 }} onClick={() => go('home')}>
          홈
        </span>
      </div>

      <div className="content">
        {/* 연주법 세그먼트 */}
        <div className="segment">
          <button className="seg" data-on={playMode === 'chord'} onClick={() => switchMode('chord')}>🎸 코드</button>
          <button className="seg" data-on={playMode === 'melody'} onClick={() => switchMode('melody')}>🎹 멜로디</button>
        </div>

        {/* 입력 세그먼트 (코드 모드만) */}
        {playMode === 'chord' && (
          <div className="segment" style={{ marginTop: 8 }}>
            <button className="seg" data-on={input === 'touch'} onClick={selectTouch}>👆 터치</button>
            <button className="seg" data-on={input === 'gesture'} onClick={selectGesture}>👋 제스처</button>
          </div>
        )}

        {/* 상태 + 박자 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 24, marginTop: 14 }}>
          <div style={{ display: 'flex', gap: 7 }}>
            {Array.from({ length: BEATS_PER_BAR }).map((_, i) => (
              <span key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: beat === i ? 'var(--blue)' : 'var(--line-2)', transform: beat === i ? 'scale(1.3)' : 'none', transition: 'all .08s var(--ease)' }} />
            ))}
          </div>
          <span className="t-cap c-sub" style={{ fontWeight: recording ? 700 : 400, color: recording ? 'var(--coral)' : undefined }}>{statusText}</span>
        </div>

        {/* 음색 칩 */}
        <button className="chip" style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => setSheet('timbre')}>
          {TIMBRE_EMOJI[timbre]} {TIMBRE_LABEL[timbre]} ▾
        </button>

        {/* 코드 모드 — 제스처 카메라(항상 마운트) */}
        <div style={{ display: playMode === 'chord' && input === 'gesture' ? 'block' : 'none', position: 'relative', marginTop: 14, borderRadius: 'var(--r-xl)', overflow: 'hidden', background: '#0b0d10', aspectRatio: '4 / 3', boxShadow: 'var(--e3)' }}>
          <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
            {CHORDS.map((c, i) => (
              <div key={c} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 16, borderRight: i < 3 ? '1px solid rgba(255,255,255,.18)' : 'none', background: active === c ? `${ACCENT[c][0]}66` : 'transparent', color: '#fff', transition: 'background .1s' }}>
                <span style={{ fontSize: 11, opacity: 0.7, fontWeight: 700 }}>{ROMAN[c]}</span>
                <span style={{ fontSize: 26, fontWeight: 800, textShadow: '0 1px 4px rgba(0,0,0,.6)' }}>{c}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 코드 모드 — 터치 패드 */}
        {playMode === 'chord' && input === 'touch' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
            {CHORDS.map((c) => (
              <button
                key={c}
                className="pad"
                data-on={active === c}
                style={{ ['--accent' as string]: ACCENT[c][0], ['--accent-d' as string]: ACCENT[c][1] } as CSSProperties}
                onPointerDown={() => void ensureAudio().then(() => downChord(c, 'touch'))}
                onPointerUp={() => upChord('touch')}
                onPointerLeave={() => active === c && upChord('touch')}
              >
                <span className="pad-sub">{ROMAN[c]}</span>
                {c}
              </button>
            ))}
          </div>
        )}

        {/* 멜로디 모드 — 피아노 건반(흰/검은, 폴리포니, 옥타브 이동) */}
        {playMode === 'melody' && (() => {
          const { whites, blacks } = buildKeys(octave);
          const blackW = (100 / (WHITE_PC.length * VISIBLE_OCTAVES)) * 0.62;
          return (
            <div style={{ marginTop: 14 }}>
              {/* 옥타브 이동 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <button className="chip" style={{ opacity: octave <= OCTAVE_MIN ? 0.4 : 1 }} disabled={octave <= OCTAVE_MIN} onClick={() => shiftOctave(-1)}>▼ 옥타브</button>
                <span className="t-cap c-sub" style={{ flex: 1, textAlign: 'center', fontWeight: 700 }}>C{octave} ~ B{octave + 1}</span>
                <button className="chip" style={{ opacity: octave >= OCTAVE_MAX ? 0.4 : 1 }} disabled={octave >= OCTAVE_MAX} onClick={() => shiftOctave(1)}>옥타브 ▲</button>
              </div>
              {/* 건반(흰 건반 행 + 검은 건반 오버레이) */}
              <div style={{ position: 'relative', height: 200, userSelect: 'none', touchAction: 'none' }}>
                <div style={{ display: 'flex', gap: 0, height: '100%' }}>
                  {whites.map((k) => (
                    <button
                      key={k.note}
                      onPointerDown={(e) => melodyDown(k.note, e.pointerId, e.currentTarget)}
                      onPointerUp={(e) => melodyUp(e.pointerId)}
                      onPointerCancel={(e) => melodyUp(e.pointerId)}
                      style={{
                        flex: 1,
                        border: 0,
                        borderLeft: '1px solid rgba(0,0,0,0.07)',
                        boxSizing: 'border-box',
                        borderRadius: '4px 4px 10px 10px',
                        background: heldNotes.has(k.note) ? 'linear-gradient(180deg,#3182f6,#1b64da)' : 'linear-gradient(180deg,#ffffff,#eef1f4)',
                        color: heldNotes.has(k.note) ? '#fff' : 'var(--key-dark)',
                        boxShadow: heldNotes.has(k.note) ? 'var(--e-inset)' : 'var(--e2)',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        paddingBottom: 10,
                        fontWeight: 800,
                        fontSize: 12,
                        touchAction: 'none',
                      }}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
                {blacks.map((b) => (
                  <button
                    key={b.note}
                    onPointerDown={(e) => melodyDown(b.note, e.pointerId, e.currentTarget)}
                    onPointerUp={(e) => melodyUp(e.pointerId)}
                    onPointerCancel={(e) => melodyUp(e.pointerId)}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: `${b.leftPct}%`,
                      transform: 'translateX(-50%)',
                      width: `${blackW}%`,
                      height: '62%',
                      border: 0,
                      borderRadius: '3px 3px 7px 7px',
                      background: heldNotes.has(b.note) ? 'linear-gradient(180deg,#3182f6,#1b64da)' : 'linear-gradient(180deg,#2a2f36,#0b0d10)',
                      boxShadow: 'var(--e2)',
                      zIndex: 2,
                      touchAction: 'none',
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                      paddingBottom: 6,
                      color: '#fff',
                      fontSize: 9,
                      fontWeight: 700,
                    }}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* 트랜스포트 */}
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button className="btn" style={ctrlBtn(metroOn ? 'var(--blue)' : 'var(--surface)', metroOn ? '#fff' : 'var(--text)', metroOn ? 'var(--e-inset)' : 'var(--e2)')} onClick={toggleMetro}>
            🥁 메트로놈
          </button>
          <button className="btn" style={ctrlBtn(busy ? 'var(--coral)' : 'var(--blue)', '#fff')} onClick={toggleRec}>
            {busy ? '■ 정지' : '● 녹음'}
          </button>
          <button className="btn" style={ctrlBtn('var(--surface)', hasTake ? 'var(--text)' : 'var(--sub)')} disabled={!hasTake || busy} onClick={play}>
            ▶ 재생
          </button>
        </div>

        {hasTake && !busy && (
          <button className="btn" style={{ marginTop: 10, background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--e2)' }} onClick={saveCurrent}>
            💾 이 연주 저장
          </button>
        )}

        {/* 합주 세션 */}
        {sessionCode && (
          <div className="card" style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div className="t-body" style={{ fontWeight: 700 }}>🎵 {baseOwner ? `${baseOwner}님과 합주` : '합주 세션'}</div>
                <div className="t-cap c-sub">코드 {sessionCode} · 트랙 {Math.max(trackCount, sessionTracks.length)}개</div>
              </div>
              {hasTake && !busy && <button className="chip" onClick={overdub}>⬆ 얹기</button>}
            </div>
            {sessionTracks.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {sessionTracks.map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span className="track-av" data-playing={jamming} style={{ background: SIG[i % SIG.length], animationDelay: `${i * 0.12}s` }}>
                      {(t.owner || '?').slice(0, 1)}
                    </span>
                    <span className="t-cap c-sub2">{t.owner}</span>
                  </div>
                ))}
              </div>
            )}
            <button className="btn" style={{ background: jamming ? 'var(--coral)' : 'var(--blue)' }} disabled={busy} onClick={jamming ? stopJam : playSession}>
              {jamming ? '■ 합주 정지' : `🎶 합주 듣기 (트랙 ${sessionTracks.length})`}
            </button>
          </div>
        )}

        {/* 합주 받기 / 공유 */}
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button className="btn" style={{ flex: 1, background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--e2)' }} onClick={receive}>
            📥 합주 받기
          </button>
          {hasTake && !busy && (
            <button className="btn" style={{ flex: 1, background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--e2)' }} onClick={share}>
              📤 공유
            </button>
          )}
        </div>

        {toast && <div style={{ marginTop: 14, textAlign: 'center', color: 'var(--blue)', fontWeight: 700, fontSize: 14 }}>{toast}</div>}
      </div>

      {/* 음색 바텀시트 */}
      {sheet === 'timbre' && (
        <>
          <div className="backdrop" onClick={() => setSheet(null)} />
          <div className="sheet">
            <div className="sheet-grip" />
            <div className="t-title" style={{ padding: '4px 6px 8px' }}>음색 고르기</div>
            {TIMBRES.map((t) => (
              <button key={t} className="sheet-row" data-on={timbre === t} onClick={() => chooseTimbre(t)}>
                <span style={{ fontSize: 26 }}>{TIMBRE_EMOJI[t]}</span>
                <span className="t-body" style={{ flex: 1, fontWeight: 600 }}>{TIMBRE_LABEL[t]}</span>
                {timbre === t && <span style={{ color: 'var(--blue)', fontWeight: 800 }}>✓</span>}
              </button>
            ))}
          </div>
        </>
      )}

      {/* 합주 받기 바텀시트 */}
      {sheet === 'receive' && pending && (
        <>
          <div className="backdrop" onClick={() => { setSheet(null); setPending(null); }} />
          <div className="sheet">
            <div className="sheet-grip" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 6px 16px' }}>
              <span className="track-av" style={{ background: SIG[0], width: 48, height: 48, fontSize: 18 }}>
                {(pending.tracks[0]?.owner || '?').slice(0, 1)}
              </span>
              <div>
                <div className="t-title">{pending.tracks[0]?.owner}님 트랙을 복사했어요</div>
                <div className="t-cap c-sub" style={{ marginTop: 2 }}>코드 {pending.code} · 트랙 {pending.tracks.length}개</div>
              </div>
            </div>
            <button className="btn" onClick={confirmReceive}>내 연주에 얹기</button>
            <button className="btn" style={{ marginTop: 8, background: 'var(--bg)', color: 'var(--text-2)' }} onClick={() => { setSheet(null); setPending(null); }}>
              닫기
            </button>
          </div>
        </>
      )}
    </>
  );
}
