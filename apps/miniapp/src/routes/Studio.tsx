import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode, PointerEvent as ReactPointerEvent } from 'react';
import type { Route } from '../App';
import {
  unlockAudio,
  chordOn,
  chordOff,
  allOff,
  setVoice,
  getVoice,
  downNote,
  upNote,
  triggerHit,
  createVoice,
  audioNow,
  type Voice,
} from '../audio/engine';
import { chordReducer, initialChordState, type ChordState, type Source, type ChordEvent } from '../audio/chordReducer';
import { drumKey, normalizeEvents, type Instrument, type DrumPiece } from '../audio/events';
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
import { saveSong, newSongId, listSongs, songTracks, type Song } from '../lib/storage';
import { loopEvents } from '../lib/loop';
import { initHandTracking, initFaceDetection, detectFace, startCamera, stopCamera, detect, type GestureMode, type Pt } from '../audio/gesture';
import { detectFx, playFx, resetFx, type FxHit, type FxResult } from '../audio/gestureFx';
import { getFxOn, setFxOn } from '../lib/settings';
import {
  createSession,
  getSession,
  addTrack,
  publishSession,
  copyText,
  readClipboardCode,
  ping,
  PRELOAD,
  type Session,
  type SessionTrack,
} from '../lib/share';
import { getNickname, getUserKey } from '../lib/identity';
import { InstrumentCombo } from '../components/studio/InstrumentCombo';
import { GestureFretboard } from '../components/studio/GestureFretboard';
import { ChordMatrix } from '../components/studio/ChordMatrix';
import { NotePadGrid } from '../components/studio/NotePadGrid';
import { DrumPad } from '../components/studio/DrumPad';
import { DevOverlay } from '../components/studio/DevOverlay';
import { NoteEditor } from '../components/studio/NoteEditor';
import { ROMAN, chordColor, PRESET_POP, MAX_CHORDS, GESTURE_ZONES, GESTURE_ZONES_FULL, FRETS_NORMAL, FRETS_FULL, DRUM_KIT_LAYOUT, nearestDrumPiece, STYLE_OPTIONS, INSTRUMENTS } from '../components/studio/chords';

type Phase = 'idle' | 'countin' | 'recording';
type Input = 'touch' | 'gesture';
type PlayMode = 'chord' | 'melody';
type Facing = 'user' | 'environment';

const SIG = ['#3182f6', '#ff6b6b', '#15c47e', '#8b5cf6', '#ff9f1c'];

const WHITE_PC = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const SOLFA: Record<string, string> = { C: '도', D: '레', E: '미', F: '파', G: '솔', A: '라', B: '시' };
const BLACK_PC: { pc: string; label: string; afterWhite: number }[] = [
  { pc: 'C#', label: '도#', afterWhite: 0 },
  { pc: 'D#', label: '레#', afterWhite: 1 },
  { pc: 'F#', label: '파#', afterWhite: 3 },
  { pc: 'G#', label: '솔#', afterWhite: 4 },
  { pc: 'A#', label: '라#', afterWhite: 5 },
];
const VISIBLE_OCTAVES = 2;
const OCTAVE_MIN = 1;
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

function inferInstrument(events: SessionTrack['events']): Instrument {
  const norm = normalizeEvents(events);
  return norm.length > 0 && norm.every((e) => e.kind === 'drum') ? 'drum' : 'piano';
}

export function Studio({ go, loaded, forked, devMode }: { go: (r: Route) => void; loaded: Song | null; forked: Session | null; devMode: boolean }) {
  const initVoice = getVoice();
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [playMode, setPlayMode] = useState<PlayMode>('chord');
  const [metroOn, setMetroOn] = useState(false);
  const [beat, setBeat] = useState(-1);
  const [hasTake, setHasTake] = useState(false);
  const [playing, setPlaying] = useState(false); // take 재생 중(재생바)
  const [playMs, setPlayMs] = useState(0); // 재생바 현재 위치(ms)
  const [takeMs, setTakeMs] = useState(0); // take 총 길이(ms)
  const [toast, setToast] = useState('');
  const [input, setInput] = useState<Input>('touch');
  const [camMsg, setCamMsg] = useState('');
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [baseOwner, setBaseOwner] = useState('');
  const [, setTrackCount] = useState(0); // 세션 폴링 갱신 트리거(표시는 sessionTracks.length 사용)
  const [sessionTracks, setSessionTracks] = useState<SessionTrack[]>([]);
  const [jamming, setJamming] = useState(false);
  const [instrument, setInstrument] = useState<Instrument>(initVoice.instrument);
  const [style, setStyle] = useState<string>(initVoice.style);
  const [showReceive, setShowReceive] = useState(false);
  const [pending, setPending] = useState<Session | null>(null);
  const [octave, setOctave] = useState(4);
  const [heldNotes, setHeldNotes] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string[]>([...PRESET_POP]);
  const [editing, setEditing] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [landscape, setLandscape] = useState(false);
  const [gestureMode, setGestureMode] = useState<GestureMode>('palm');
  const [facing, setFacing] = useState<Facing>('user');
  const [camZoom, setCamZoom] = useState(1);
  const [fps, setFps] = useState(0);
  const [latency, setLatency] = useState<number | null>(null);
  const [landmarks, setLandmarks] = useState<Pt[] | null>(null);
  const [sparkles, setSparkles] = useState<{ id: number; x: number; y: number; kind: FxHit['kind'] }[]>([]); // 효과 스파클(손/머리 주변)
  const [effectsOn, setEffectsOnState] = useState<boolean>(() => getFxOn()); // 제스처 효과음 on/off
  const [flashPiece, setFlashPiece] = useState<DrumPiece | null>(null); // 드럼 타격 시 모양/패드 깜빡임
  const [hands, setHands] = useState<1 | 2>(1); // 제스처 한 손/양손
  const [gestureChords, setGestureChords] = useState<string[]>([]); // 제스처로 현재 울리는 코드(존 하이라이트)
  const [showMore, setShowMore] = useState(false); // 하단 '더보기' 시트(부차 액션 모음)
  const [brightness, setBrightness] = useState(1); // 개발자 모드 오버레이 창 자체의 밝기/투명도
  const [modeSheet, setModeSheet] = useState(false); // 연주법(코드/멜로디) 시트
  const [inputSheet, setInputSheet] = useState(false); // 입력 방식(터치/제스처) 시트
  const [loopSheet, setLoopSheet] = useState(false); // 구간 반복 시트
  const [loopBars, setLoopBars] = useState(1); // 반복 단위(마디)
  const [loopCount, setLoopCount] = useState(4); // 반복 횟수
  const [looped, setLooped] = useState(false); // 반복 적용 여부

  const stateRef = useRef<ChordState>(initialChordState);
  const recordStartRef = useRef(0);
  const phaseRef = useRef<Phase>('idle');
  phaseRef.current = phase;
  const soundingRef = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const voicesRef = useRef<Voice[]>([]);
  const heldRef = useRef<Set<string>>(new Set());
  const pointerNoteRef = useRef<Map<number, string>>(new Map());
  const playTimersRef = useRef<number[]>([]);
  const takeVoiceRef = useRef<{ instrument: Instrument; style: string }>({ instrument: initVoice.instrument, style: initVoice.style }); // 이 take를 녹음한 악기(재생·저장 기준)
  const playVoiceRef = useRef<Voice | null>(null); // 단일 take 재생용 보이스(녹음 악기로 생성)
  const playRafRef = useRef(0); // 재생바 진행 rAF
  const playStartPerfRef = useRef(0); // 재생 시작 시각(performance.now)
  const playFromMsRef = useRef(0); // 재생 시작 위치(ms)
  const barRef = useRef<HTMLDivElement>(null); // 재생바 트랙(스크럽 좌표 기준)
  const barDragRef = useRef(false);
  const wasPlayingRef = useRef(false); // 스크럽 시작 시 재생 중이었나(놓으면 재개)
  const seekMsRef = useRef(0); // 드래그 중 목표 위치
  const monitorRef = useRef<{ voices: Voice[]; timers: number[] }>({ voices: [], timers: [] }); // 녹음 중 기존 레이어 모니터링
  const loopOriginalRef = useRef<ChordEvent[] | null>(null); // 구간 반복 적용 전 원본(해제용)
  const selectedRef = useRef<string[]>(selected);
  selectedRef.current = selected;
  const gestureModeRef = useRef(gestureMode);
  gestureModeRef.current = gestureMode;
  const facingRef = useRef<Facing>(facing);
  facingRef.current = facing;
  const fullscreenRef = useRef(fullscreen);
  fullscreenRef.current = fullscreen;
  const drumModeRef = useRef(instrument === 'drum');
  drumModeRef.current = instrument === 'drum';
  const devRef = useRef(devMode);
  devRef.current = devMode;
  const handsRef = useRef<1 | 2>(1);
  handsRef.current = hands;
  const drumPrevRef = useRef<{ active: boolean; piece: DrumPiece | null }[]>([
    { active: false, piece: null },
    { active: false, piece: null },
  ]);
  const twoHandRef = useRef<(string | null)[]>([null, null]); // 양손 코드: 손별 현재 코드
  const flashTimerRef = useRef(0);
  const faceRef = useRef<Pt | null>(null); // 헤드뱅잉용 캐시된 얼굴 중심
  const fxFrameRef = useRef(0); // 효과 루프 프레임 카운터(얼굴 검출 3프레임마다)
  const sparkleIdRef = useRef(0);
  const effectsOnRef = useRef(effectsOn);
  effectsOnRef.current = effectsOn;
  const chordPointerRef = useRef<Set<number>>(new Set()); // 터치 코드 패드: 눌린 포인터 추적(지연-down 레이스·취소 방지)

  useEffect(() => {
    onBeat((beatInBar, bar) => {
      setBeat(beatInBar);
      if (phaseRef.current === 'countin' && bar >= 1) {
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
      stopJam(); // 합주 재생 보이스도 언마운트 시 정리(잔류음·노드 누수 방지)
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stopCamera(streamRef.current);
      allOff(); // 라우트 이탈/언마운트 시 보유 코드·멜로디 잔류음 해제(stuck 방지)
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const tks = songTracks(loaded);
    if (tks.length > 1) {
      // 멀티트랙 곡: 전부 레이어로 올리고 새 take는 비움(이어서 추가·합주)
      setSessionTracks(tks);
      setTrackCount(tks.length);
      setBaseOwner('');
      stateRef.current = { ...initialChordState };
      setHasTake(false);
      const last = tks[tks.length - 1];
      const li = last.instrument ?? inferInstrument(last.events);
      takeVoiceRef.current = { instrument: li, style: last.style ?? STYLE_OPTIONS[li][0].key };
    } else {
      const t = tks[0];
      const evs = t?.events ?? [];
      stateRef.current = { ...initialChordState, events: evs };
      setHasTake(evs.length > 0);
      const inst = t?.instrument ?? inferInstrument(evs);
      takeVoiceRef.current = { instrument: inst, style: t?.style ?? STYLE_OPTIONS[inst][0].key };
    }
  }, [loaded]);

  useEffect(() => {
    if (!forked) return;
    const base = forked.tracks[0];
    if (!base) return;
    clearMelody();
    // 받은 트랙은 sessionTracks 레이어로만 둔다. take는 비워 내 연주를 새로 녹음 → 얹기.
    // (take에도 base를 넣으면 합주 듣기에서 base가 두 번 재생됨 — R34-001)
    stateRef.current = { ...initialChordState };
    setHasTake(false);
    setSessionCode(forked.code.startsWith('LOCAL') ? null : forked.code);
    setBaseOwner(base.owner);
    setTrackCount(forked.tracks.length);
    setSessionTracks(forked.tracks);
    const binst = inferInstrument(base.events);
    takeVoiceRef.current = { instrument: binst, style: STYLE_OPTIONS[binst][0].key };
    flashToast(`${base.owner}님 트랙을 얹을 준비 완료`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forked]);

  // take 길이 갱신(재생바 총 길이). 녹음 종료(phase)·편집·반복·레이어 변경 시 재계산.
  useEffect(() => {
    const evs = stateRef.current.events;
    setTakeMs(evs.length ? tickToMs(evs.reduce((m, e) => Math.max(m, e.tick), 0)) : 0);
    setPlayMs(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, hasTake, looped, editing, sessionTracks]);

  // 녹음(recording) 진입 시 기존 레이어 모니터링 재생, 종료 시 정리.
  useEffect(() => {
    if (phase === 'recording' && sessionTracks.length > 0) startMonitor();
    else stopMonitor();
    return () => stopMonitor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

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
        /* 오프라인/프리로드 세션은 폴링 무시 */
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 1500);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [sessionCode]);

  // 개발자 모드: FPS 측정 + 백엔드 핑.
  useEffect(() => {
    if (!devMode) {
      setLandmarks(null);
      return;
    }
    let raf = 0;
    let n = 0;
    let t = performance.now();
    const tickFps = () => {
      n++;
      const now = performance.now();
      if (now - t >= 500) {
        setFps(Math.round((n * 1000) / (now - t)));
        t = now;
        n = 0;
      }
      raf = requestAnimationFrame(tickFps);
    };
    raf = requestAnimationFrame(tickFps);
    let alive = true;
    const runPing = async () => {
      const ms = await ping();
      if (alive) setLatency(ms);
    };
    void runPing();
    const id = window.setInterval(() => void runPing(), 4000);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.clearInterval(id);
    };
  }, [devMode]);

  async function ensureAudio() {
    if (!ready) {
      await unlockAudio();
      setVoice(instrument, style);
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

  function melodyDown(note: string, pointerId: number, el: Element) {
    try {
      el.setPointerCapture(pointerId);
    } catch {
      /* 포인터 캡처 미지원 무시 */
    }
    pointerNoteRef.current.set(pointerId, note);
    const tick = curTick();
    const nowMs = performance.now();
    void ensureAudio().then(() => {
      if (pointerNoteRef.current.get(pointerId) !== note) return;
      stateRef.current = chordReducer(stateRef.current, { type: 'down', chord: note, source: 'touch', tick, nowMs, poly: true });
      if (!heldRef.current.has(note)) {
        heldRef.current.add(note);
        downNote(note);
        setHeldNotes(new Set(heldRef.current));
      }
    });
  }

  function melodyUp(pointerId: number) {
    const note = pointerNoteRef.current.get(pointerId);
    if (note === undefined) return;
    pointerNoteRef.current.delete(pointerId);
    if (Array.from(pointerNoteRef.current.values()).includes(note)) return;
    stateRef.current = chordReducer(stateRef.current, { type: 'up', chord: note, source: 'touch', tick: curTick(), nowMs: performance.now(), poly: true });
    heldRef.current.delete(note);
    upNote(note);
    setHeldNotes(new Set(heldRef.current));
  }

  function clearMelody() {
    const now = performance.now();
    const tick = curTick();
    let st = stateRef.current;
    for (const note of Object.keys(st.activeNotes)) {
      st = chordReducer(st, { type: 'up', chord: note, source: 'touch', tick, nowMs: now, poly: true });
    }
    stateRef.current = st;
    heldRef.current.forEach((n) => upNote(n));
    heldRef.current.clear();
    pointerNoteRef.current.clear();
    setHeldNotes(new Set());
  }

  function hitDrum(piece: DrumPiece, source: Source = 'touch') {
    const tick = curTick();
    setFlashPiece(piece); // 어디를 쳤는지 색 표시(터치·제스처 공통)
    window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlashPiece(null), 140);
    void ensureAudio().then(() => {
      triggerHit(piece);
      stateRef.current = chordReducer(stateRef.current, { type: 'hit', chord: drumKey(piece), source, tick });
      if (phaseRef.current === 'recording') setHasTake(true);
    });
  }

  function stopPlayback() {
    playTimersRef.current.forEach((id) => window.clearTimeout(id));
    playTimersRef.current = [];
    if (playVoiceRef.current) {
      playVoiceRef.current.dispose();
      playVoiceRef.current = null;
    }
    if (playRafRef.current) {
      cancelAnimationFrame(playRafRef.current);
      playRafRef.current = 0;
    }
    setPlaying(false); // 재생바 정지(위치 playMs는 유지 = 일시정지)
  }

  // 녹음 중 기존 레이어를 함께 들려줌(같이 연주하도록). 녹음 시작 시점 기준으로 스케줄.
  function stopMonitor() {
    monitorRef.current.timers.forEach((id) => window.clearTimeout(id));
    monitorRef.current.voices.forEach((v) => v.dispose());
    monitorRef.current = { voices: [], timers: [] };
  }
  function startMonitor() {
    stopMonitor();
    const voices: Voice[] = [];
    const timers: number[] = [];
    const t0 = audioNow(); // 모니터도 오디오 클럭 — 메트로놈과 샘플정확으로 그루브 락(내 연주와 싱크)
    for (const t of sessionTracks) {
      const inst = t.instrument ?? inferInstrument(t.events);
      const v = createVoice(inst, t.style ?? (inst === 'drum' ? 'analog' : 'grand'));
      voices.push(v);
      for (const ev of normalizeEvents(t.events)) {
        const at = t0 + tickToMs(ev.tick) / 1000;
        if (ev.kind === 'drum') v.hit(ev.piece, at);
        else if (ev.kind === 'melody') {
          if (ev.phase === 'on') v.on(ev.note, at);
          else v.off(ev.note, at);
        } else {
          if (ev.phase === 'on') v.on(ev.chord, at);
          else v.off(ev.chord, at);
        }
      }
    }
    monitorRef.current = { voices, timers };
  }

  function shiftOctave(d: number) {
    clearMelody();
    setOctave((o) => Math.min(OCTAVE_MAX, Math.max(OCTAVE_MIN, o + d)));
  }

  function switchMode(m: PlayMode) {
    if (m === playMode || instrument === 'drum') return;
    allOff();
    releaseTwoHand();
    soundingRef.current = null;
    setActive(null);
    clearMelody();
    if (m === 'melody') selectTouch();
    setPlayMode(m);
  }

  function chooseVoice(nextInstrument: Instrument, nextStyle: string) {
    if (phaseRef.current !== 'idle') {
      flashToast('녹음 중에는 악기를 바꿀 수 없어요');
      return;
    }
    allOff();
    releaseTwoHand();
    soundingRef.current = null;
    setActive(null);
    clearMelody();
    if (nextInstrument !== 'drum') selectTouch();
    setInstrument(nextInstrument);
    setStyle(nextStyle);
    void ensureAudio().then(() => {
      setVoice(nextInstrument, nextStyle);
      if (nextInstrument === 'drum') triggerHit('kick');
      else {
        chordOn('C');
        window.setTimeout(() => chordOff('C'), 500);
      }
    });
  }

  function toggleChord(name: string) {
    const has = selected.includes(name);
    if (!has && selected.length >= MAX_CHORDS) {
      flashToast('코드는 최대 6개까지 선택할 수 있어요');
      return;
    }
    setSelected((cur) => (cur.includes(name) ? cur.filter((c) => c !== name) : [...cur, name]));
  }

  // 현재 제스처로 울리는 코드 집합(존 하이라이트). 변할 때만 setState.
  function updateGestureChords(next: string[]) {
    const a = Array.from(new Set(next)).sort();
    setGestureChords((prev) => (prev.length === a.length && prev.every((x, i) => x === a[i]) ? prev : a));
  }
  // 양손 코드: mono reducer로는 2코드 동시 불가 → 손별 직접 발음 + (녹음 중) 이벤트 적재.
  function recordRaw(chord: string, phase: 'on' | 'off') {
    if (phaseRef.current !== 'recording') return;
    stateRef.current = { ...stateRef.current, events: stateRef.current.events.concat({ tick: curTick(), phase, chord, source: 'gesture' }) };
    setHasTake(true);
  }

  // 효과 스파클 1개 띄움(자동 소멸). 동시 최대 ~9개.
  function spawnSparkle(h: FxHit) {
    const id = ++sparkleIdRef.current;
    setSparkles((s) => [...s.slice(-8), { id, x: h.x, y: h.y, kind: h.kind }]);
    window.setTimeout(() => setSparkles((s) => s.filter((p) => p.id !== id)), 650);
  }

  function toggleEffects() {
    setEffectsOnState((on) => {
      const next = !on;
      setFxOn(next);
      if (!next) {
        resetFx();
        faceRef.current = null;
        setSparkles([]);
      }
      return next;
    });
  }

  // 양손(직접 발음) 코드 잔류음 해제. 모든 정리 길목에서 호출(경로별 비대칭 누락 방지).
  // 양손 코드는 reducer를 우회해 chordOn으로 직접 울리므로 upChord('gesture')로는 안 꺼짐 → 직접 chordOff 필요.
  function releaseTwoHand() {
    twoHandRef.current.forEach((c) => c && chordOff(c));
    twoHandRef.current = [null, null];
  }

  // 제스처 루프: 코드(지속음) / 드럼(상승엣지 타격) + 효과(흔들기/박수/헤드뱅잉, 모든 모드 공통).
  function loop() {
    const v = videoRef.current;
    if (v && v.readyState >= 2) {
      const mirror = facingRef.current === 'user';
      const maxHands = handsRef.current;
      const now = performance.now();
      const drumOn = drumModeRef.current;
      const zones = drumOn ? [] : selectedRef.current.slice(0, fullscreenRef.current ? GESTURE_ZONES_FULL : GESTURE_ZONES);
      const zoneCount = drumOn ? 1 : Math.max(1, zones.length);
      const frames = detect(v, now, { zoneCount, mode: gestureModeRef.current, mirror }).slice(0, maxHands);
      if (devRef.current) setLandmarks(frames.flatMap((f) => f.landmarks ?? []));

      // ---- 효과 감지(토글 ON일 때만). handWaving = '팔랑팔랑 흔드는 중' → 1명 모드 연주 억제 판단. ----
      const solo = maxHands === 1; // 한손 = 1명, 양손 = 2명+
      fxFrameRef.current = (fxFrameRef.current + 1) % 3;
      let fx: FxResult | null = null;
      if (effectsOnRef.current) {
        if (fxFrameRef.current === 0) faceRef.current = detectFace(v, now); // 얼굴은 3프레임마다(부하 절감)
        fx = detectFx(frames, faceRef.current, now);
      } else {
        faceRef.current = null;
      }
      const waving0 = fx?.handWaving[0] ?? false;
      const waving1 = fx?.handWaving[1] ?? false;

      // ---- 음악: 드럼(타격) / 코드(지속). 1명 모드는 흔드는 중이면 연주 억제(효과와 안 겹치게). ----
      if (drumOn) {
        for (let i = 0; i < 2; i++) {
          const f = frames[i];
          let piece: DrumPiece | null = null;
          const suppress = solo && (i === 0 ? waving0 : waving1);
          if (!suppress && f && f.active && f.pos) {
            const hx = mirror ? 1 - f.pos.x : f.pos.x;
            piece = nearestDrumPiece(hx, f.pos.y);
          }
          const prev = drumPrevRef.current[i];
          if (piece !== null && (!prev.active || prev.piece !== piece)) hitDrum(piece, 'gesture');
          drumPrevRef.current[i] = { active: piece !== null, piece };
        }
      } else if (solo) {
        const f = frames[0];
        if (!waving0 && f && f.active && f.zone !== null && f.zone < zones.length) downChord(zones[f.zone], 'gesture');
        else upChord('gesture'); // 흔드는 중이거나 비활성 → 연주 억제
        const a = stateRef.current.activeChord;
        updateGestureChords(a ? [a] : []);
        twoHandRef.current = [null, null];
      } else {
        for (let i = 0; i < 2; i++) {
          const f = frames[i];
          const target = f && f.active && f.zone !== null && f.zone < zones.length ? zones[f.zone] : null;
          const cur = twoHandRef.current[i];
          if (target !== cur) {
            if (cur) {
              chordOff(cur);
              recordRaw(cur, 'off');
            }
            if (target) {
              chordOn(target);
              recordRaw(target, 'on');
            }
            twoHandRef.current[i] = target;
          }
        }
        updateGestureChords(twoHandRef.current.filter((c): c is string => !!c));
      }

      // ---- 효과 발음/스파클 ----
      // 2명+(양손): 연주와 겹쳐도 OK. 1명(한손): 안 겹치게 — 탬버린은 흔들 때(연주 이미 억제됨)만,
      // 헤드뱅잉은 코드 안 울릴 때만, 박수는 양손 전용이라 1명선 발생 안 함.
      if (fx) {
        const chordActive = stateRef.current.activeChord !== null;
        for (const h of fx.hits) {
          if (!solo || h.kind === 'tambourine' || (h.kind === 'cute' && !chordActive)) {
            playFx(h.kind);
            spawnSparkle(h);
          }
        }
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  }

  function stopGestureLoop() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    stopCamera(streamRef.current);
    streamRef.current = null;
    setLandmarks(null);
    resetFx();
    faceRef.current = null;
    setSparkles([]);
    drumPrevRef.current = [
      { active: false, piece: null },
      { active: false, piece: null },
    ];
    releaseTwoHand(); // 양손 보유 코드 잔류음 정리(selectTouch·제스처/카메라 실패 폴백 전부 이 길목 통과)
    setGestureChords([]);
  }

  async function selectGesture() {
    if (input === 'gesture') return;
    setCamMsg('카메라 준비 중…');
    upChord('touch'); // 진입 전 touch 코드 잔류 해제(gesture up은 source 불일치로 못 끔 → stuck 방지)
    try {
      await ensureAudio();
      await initHandTracking();
      void initFaceDetection(); // 헤드뱅잉용(베스트에포트 — 실패해도 손 효과·연주는 진행)
      const v = videoRef.current;
      if (!v) throw new Error('no video');
      streamRef.current = await startCamera(v, facing);
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
    setFullscreen(false);
    setLandscape(false);
  }

  async function switchCamera() {
    const next: Facing = facing === 'user' ? 'environment' : 'user';
    setFacing(next);
    if (input !== 'gesture') return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    stopCamera(streamRef.current);
    streamRef.current = null;
    setCamMsg('카메라 전환 중…');
    try {
      const v = videoRef.current;
      if (!v) throw new Error('no video');
      streamRef.current = await startCamera(v, next);
      setCamMsg('');
      rafRef.current = requestAnimationFrame(loop);
    } catch {
      stopGestureLoop();
      setInput('touch');
      setCamMsg('카메라를 쓸 수 없어 터치로 연주해요');
    }
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
      takeVoiceRef.current = { instrument, style }; // 이 take의 악기 고정(이후 전환해도 재생은 녹음 악기로)
      loopOriginalRef.current = null; // 새 녹음 = 반복 초기화
      setLooped(false);
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

  function scheduleEvents(events: SessionTrack['events'], voices: { chord: Voice; melody: Voice; drum: Voice }, fromMs = 0): number {
    let maxMs = 0;
    const t0 = audioNow(); // 오디오 클럭 기준 — 샘플정확(setTimeout 지터 제거 → 레이어 싱크 타이트)
    for (const ev of normalizeEvents(events)) {
      const ms = tickToMs(ev.tick);
      if (ms > maxMs) maxMs = ms;
      if (ms < fromMs - 1) continue; // 스크럽: 이미 지난 구간 스킵(현재 위치부터)
      const at = t0 + (ms - fromMs) / 1000;
      if (ev.kind === 'drum') voices.drum.hit(ev.piece, at);
      else if (ev.kind === 'melody') {
        if (ev.phase === 'on') voices.melody.on(ev.note, at);
        else voices.melody.off(ev.note, at);
      } else {
        if (ev.phase === 'on') voices.chord.on(ev.chord, at);
        else voices.chord.off(ev.chord, at);
      }
    }
    return maxMs;
  }

  // 현재 take 길이(ms). 재생바 총 길이.
  function takeDurationMs(): number {
    const evs = stateRef.current.events;
    if (!evs.length) return 0;
    return tickToMs(evs.reduce((m, e) => Math.max(m, e.tick), 0));
  }

  // take를 fromMs 위치부터 '녹음한 악기'로 재생 + 빨간 재생바 진행(rAF).
  async function playFrom(fromMs: number) {
    await ensureAudio();
    stopPlayback();
    stopJam();
    allOff();
    soundingRef.current = null;
    clearMelody();
    const total = takeDurationMs();
    setTakeMs(total);
    if (total <= 0) return;
    const start = Math.max(0, Math.min(fromMs, total));
    const voice = createVoice(takeVoiceRef.current.instrument, takeVoiceRef.current.style);
    playVoiceRef.current = voice;
    scheduleEvents(stateRef.current.events, { chord: voice, melody: voice, drum: voice }, start);
    playTimersRef.current.push(
      window.setTimeout(() => {
        voice.dispose();
        if (playVoiceRef.current === voice) playVoiceRef.current = null;
      }, total - start + 400),
    );
    playFromMsRef.current = start;
    playStartPerfRef.current = performance.now();
    setPlaying(true);
    setPlayMs(start);
    const tick = () => {
      const t = playFromMsRef.current + (performance.now() - playStartPerfRef.current);
      if (t >= total) {
        setPlayMs(total); // 끝에서 멈춤(다음 재생 시 처음부터)
        setPlaying(false);
        if (playRafRef.current) {
          cancelAnimationFrame(playRafRef.current);
          playRafRef.current = 0;
        }
        return;
      }
      setPlayMs(t);
      playRafRef.current = requestAnimationFrame(tick);
    };
    playRafRef.current = requestAnimationFrame(tick);
  }

  function togglePlay() {
    if (playing) {
      stopPlayback(); // 일시정지(위치 유지)
      return;
    }
    void playFrom(playMs >= takeMs ? 0 : playMs); // 끝까지 갔으면 처음부터
  }

  // 재생바 스크럽(탭/드래그로 위치 이동).
  function posFromX(clientX: number): number {
    const el = barRef.current;
    if (!el || takeMs <= 0) return 0;
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * takeMs;
  }
  function onBarDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (takeMs <= 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 캡처 미지원 무시 */
    }
    barDragRef.current = true;
    wasPlayingRef.current = playing;
    if (playing) stopPlayback(); // 드래그 중 오디오 멈춤
    const ms = posFromX(e.clientX);
    seekMsRef.current = ms;
    setPlayMs(ms);
  }
  function onBarMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!barDragRef.current) return;
    const ms = posFromX(e.clientX);
    seekMsRef.current = ms;
    setPlayMs(ms);
  }
  function onBarUp() {
    if (!barDragRef.current) return;
    barDragRef.current = false;
    if (wasPlayingRef.current) void playFrom(seekMsRef.current); // 재생 중이었으면 새 위치부터 재개
  }

  function stopJam() {
    voicesRef.current.forEach((v) => v.dispose());
    voicesRef.current = [];
    setJamming(false);
  }

  // 전체 합주 재생: 모든 레이어 + 현재 take를 각자의 녹음 악기로 동시 재생.
  function playSession() {
    void ensureAudio().then(() => {
      stopJam();
      stopPlayback();
      const layered = [...sessionTracks];
      if (stateRef.current.events.length) {
        layered.push({ owner: getNickname() || '나', events: stateRef.current.events, createdAt: Date.now(), instrument: takeVoiceRef.current.instrument, style: takeVoiceRef.current.style });
      }
      if (!layered.length) return;
      const all: Voice[] = [];
      let maxMs = 0;
      layered.forEach((t) => {
        const inst = t.instrument ?? inferInstrument(t.events);
        const tStyle = t.style ?? (inst === 'drum' ? 'analog' : 'grand');
        const voice = createVoice(inst, tStyle);
        all.push(voice);
        const m = scheduleEvents(t.events, { chord: voice, melody: voice, drum: voice });
        if (m > maxMs) maxMs = m;
      });
      voicesRef.current = all;
      setJamming(true);
      playTimersRef.current.push(window.setTimeout(() => stopJam(), maxMs + 1500));
    });
  }

  // 현재 프로젝트(모든 레이어 + 현재 take)를 멀티트랙 곡으로 저장.
  function saveCurrent() {
    const layered = [...sessionTracks];
    if (stateRef.current.events.length) {
      layered.push({ owner: getNickname() || '나', events: stateRef.current.events, createdAt: Date.now(), instrument: takeVoiceRef.current.instrument, style: takeVoiceRef.current.style });
    }
    if (!layered.length) return;
    const name = `내 곡 ${listSongs().length + 1}`;
    saveSong({ id: newSongId(), name, bpm: BPM, createdAt: Date.now(), tracks: layered });
    flashToast(`'${name}' 저장됨 (트랙 ${layered.length})`);
  }

  // 구간 반복: 녹음 앞부분(loopBars 마디)을 잘라 loopCount회 이어붙인다. 이벤트 복제 방식(저장/공유/재생 일관).
  function applyLoop() {
    const base = loopOriginalRef.current ?? stateRef.current.events;
    if (!base.length) return;
    const barMs = (60000 / BPM) * BEATS_PER_BAR;
    const loopTicks = Math.max(1, Math.round(msToTick(barMs * loopBars)));
    if (!base.some((e) => e.tick < loopTicks)) {
      flashToast('반복할 구간에 연주가 없어요');
      return;
    }
    const tiled = loopEvents(base, loopTicks, loopCount);
    loopOriginalRef.current = base;
    stateRef.current = { ...stateRef.current, events: tiled };
    setHasTake(tiled.length > 0);
    setLooped(true);
    flashToast(`${loopBars}마디 × ${loopCount}회 반복 적용`);
  }
  function clearLoop() {
    if (!loopOriginalRef.current) return;
    stateRef.current = { ...stateRef.current, events: loopOriginalRef.current };
    setHasTake(stateRef.current.events.length > 0);
    loopOriginalRef.current = null;
    setLooped(false);
    flashToast('반복 해제');
  }

  function flashToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2000);
  }

  // 공유: 모든 레이어 + 현재 take를 세션으로 업로드(첫 트랙=createSession, 나머지=addTrack).
  async function share() {
    const layered = [...sessionTracks];
    if (stateRef.current.events.length) {
      layered.push({ owner: getNickname() || '나', events: stateRef.current.events, createdAt: Date.now(), instrument: takeVoiceRef.current.instrument, style: takeVoiceRef.current.style });
    }
    if (!layered.length) return;
    try {
      const first = layered[0];
      const code = await createSession({ name: '하모니 합주', bpm: BPM, owner: first.owner, events: first.events, instrument: first.instrument, style: first.style });
      for (let i = 1; i < layered.length; i++) {
        const t = layered[i];
        await addTrack(code, t.owner, t.events, t.instrument, t.style);
      }
      setSessionCode(code);
      setSessionTracks(layered);
      setTrackCount(layered.length);
      const ok = await copyText(code);
      flashToast(ok ? `공유 코드 복사됨 · ${code}` : `공유 코드 · ${code}`);
    } catch {
      flashToast('공유 실패 — 네트워크 확인');
    }
  }

  // 커뮤니티에 올리기(파생): 모든 레이어 + 현재 take를 published 세션으로 공개. 가져온 곡 위면 출처(origin_code) 강제 기록.
  async function publishDerivative() {
    const layered = [...sessionTracks];
    if (stateRef.current.events.length) {
      layered.push({ owner: getNickname() || '나', events: stateRef.current.events, createdAt: Date.now(), instrument: takeVoiceRef.current.instrument, style: takeVoiceRef.current.style });
    }
    if (!layered.length) { flashToast('올릴 연주가 없어요'); return; }
    // 가져온 곡(서버 code) 위에 쌓는 경우 그 code가 출처. 로컬 재료(LOCAL-…)면 출처 없음.
    const origin = forked && !forked.code.startsWith('LOCAL') ? forked.code : undefined;
    try {
      const key = await getUserKey();
      const nick = getNickname() || '익명';
      const first = layered[0];
      const name = origin && forked ? `${forked.name} 위에 쌓음` : '내 합주';
      const code = await publishSession({
        name, bpm: BPM, owner: first.owner, author: nick, authorKey: key,
        events: first.events, instrument: first.instrument, style: first.style,
        originCode: origin, idempotencyToken: crypto.randomUUID(),
      });
      for (let i = 1; i < layered.length; i++) {
        const t = layered[i];
        await addTrack(code, t.owner, t.events, t.instrument, t.style);
      }
      flashToast(origin ? '커뮤니티에 올렸어요 — 출처가 함께 남아요' : '커뮤니티에 올렸어요');
    } catch {
      flashToast('올리기 실패 — 네트워크 확인');
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
    setShowReceive(true);
  }

  function confirmReceive() {
    if (!pending) return;
    const base = pending.tracks[0];
    clearMelody();
    // 받은 트랙=레이어(sessionTracks)로만. take는 비움 → 내 악기로 새로 녹음해 얹는다(R34-001 이중재생 방지).
    stateRef.current = { ...initialChordState };
    setHasTake(false);
    setSessionCode(pending.code);
    setBaseOwner(base.owner);
    setTrackCount(pending.tracks.length);
    setSessionTracks(pending.tracks);
    setShowReceive(false);
    setPending(null);
    flashToast(`${base.owner}님 트랙 받았어요 — 내 악기로 녹음해 얹어보세요`);
  }

  // 레이어 추가(솔로/세션 공통): 현재 take를 트랙으로 쌓고 take를 비워 다음 악기 녹음 준비. 세션이면 백엔드에도 업로드.
  function addLayer() {
    if (!stateRef.current.events.length || busy) return;
    const { instrument: ti, style: ts } = takeVoiceRef.current;
    const who = getNickname() || '나';
    const track: SessionTrack = { owner: who, events: stateRef.current.events, createdAt: Date.now(), instrument: ti, style: ts };
    setSessionTracks((prev) => [...prev, track]);
    setTrackCount((c) => c + 1);
    if (sessionCode) void addTrack(sessionCode, who, stateRef.current.events, ti, ts).catch(() => {});
    stopPlayback();
    allOff();
    soundingRef.current = null;
    clearMelody();
    stateRef.current = { ...initialChordState };
    setHasTake(false);
    setActive(null);
    loopOriginalRef.current = null; // 레이어로 넘긴 take의 반복 상태 초기화
    setLooped(false);
    flashToast('레이어 추가됨 🎶 다른 악기로 다음 트랙을 녹음하세요');
  }

  function deleteTrack(idx: number) {
    if (sessionCode) return; // 네트워크 세션 트랙은 삭제 불가(로컬 레이어만)
    setSessionTracks((prev) => prev.filter((_, i) => i !== idx));
    setTrackCount((c) => Math.max(0, c - 1));
  }

  const busy = phase !== 'idle';
  const playPct = takeMs > 0 ? Math.min(100, (playMs / takeMs) * 100) : 0; // 재생바 진행률
  const fmtMs = (ms: number) => {
    const s = Math.max(0, Math.round(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const recording = phase === 'recording';
  const countin = phase === 'countin';
  const drumMode = instrument === 'drum';
  const fretInstrument: 'guitar' | 'bass' | null = instrument === 'guitar' || instrument === 'bass' ? instrument : null;
  const countdown = BEATS_PER_BAR - (beat < 0 ? 0 : beat);
  const statusText = camMsg || (countin ? `카운트인 ${countdown}` : recording ? '녹음 중' : !ready ? '눌러서 소리 켜기' : '준비됐어요');
  const mirror = facing === 'user';
  const camMountable = drumMode || playMode === 'chord'; // 제스처 가능한 모드 → video 항상 마운트(ref 확보)
  const showCamera = input === 'gesture' && camMountable;
  const camFull = fullscreen && showCamera;
  const melodyFull = fullscreen && !drumMode && playMode === 'melody';
  const drumTouchFull = fullscreen && drumMode && input !== 'gesture';
  const zoneN = Math.min(selected.length, fullscreen ? GESTURE_ZONES_FULL : GESTURE_ZONES);

  // 전체화면 가로 회전(CSS 90°). iOS WebView에서 Fullscreen/Orientation API보다 안정적.
  const landscapeBox: CSSProperties = { position: 'fixed', top: 0, left: '100vw', width: '100vh', height: '100vw', transformOrigin: 'top left', transform: 'rotate(90deg)', zIndex: 70, overflow: 'hidden' };

  const surfaceWrap = (children: ReactNode): ReactNode => (
    <div style={landscape ? { ...landscapeBox, background: 'var(--bg)', padding: '14px 18px', display: 'flex', flexDirection: 'column' } : { position: 'fixed', inset: 0, zIndex: 70, background: 'var(--bg)', padding: 'calc(12px + env(safe-area-inset-top)) 16px 16px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button className="chip" onClick={() => { setFullscreen(false); setLandscape(false); }}>‹ 나가기</button>
        <button className="chip chip-ghost" onClick={() => setLandscape((l) => !l)}>⟳ {landscape ? '세로' : '가로'}</button>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>{children}</div>
    </div>
  );

  const ctlChip: CSSProperties = { background: 'rgba(255,255,255,.92)', color: 'var(--text)', fontSize: 13, padding: '8px 12px' };
  const switchHands = () => {
    const next: 1 | 2 = hands === 1 ? 2 : 1;
    handsRef.current = next; // 다음 루프 틱부터 새 모드로 동작(이전 분기 stale 재공격 방지)
    setHands(next);
    releaseTwoHand();
    upChord('gesture'); // 1손 reducer 경로 해제
    setGestureChords([]);
  };
  const gestureControls = (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'flex-start', padding: 'calc(8px + env(safe-area-inset-top)) 12px 12px', zIndex: 75, background: 'linear-gradient(180deg, rgba(0,0,0,.55), transparent)' }}>
      <button className="btn" style={{ width: 'auto', padding: '9px 15px', fontSize: 14, background: 'var(--blue)', color: '#fff', boxShadow: 'var(--e2)', flex: 'none' }} onClick={() => { if (camFull) { setFullscreen(false); setLandscape(false); } else setFullscreen(true); }}>
        {camFull ? '‹ 나가기' : '⛶ 전체화면'}
      </button>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {camFull && <button className="chip" style={ctlChip} onClick={() => setLandscape((l) => !l)}>⟳ {landscape ? '세로' : '가로'}</button>}
        <button className="chip" style={ctlChip} onClick={switchHands}>{hands === 2 ? '🙌 양손' : '🤚 한손'}</button>
        <button className="chip" style={ctlChip} onClick={() => setGestureMode((g) => (g === 'finger' ? 'palm' : 'finger'))}>{gestureMode === 'finger' ? '☝ 손가락' : '✋ 손바닥'}</button>
        <button className="chip" style={effectsOn ? { ...ctlChip, background: 'var(--blue)', color: '#fff' } : ctlChip} onClick={toggleEffects}>{effectsOn ? '✨ 효과 ON' : '✨ 효과 OFF'}</button>
        <button className="chip" style={ctlChip} onClick={() => setCamZoom((z) => Math.max(1, Math.round((z - 0.25) * 100) / 100))}>➖</button>
        <button className="chip" style={ctlChip} onClick={() => setCamZoom((z) => Math.min(3, Math.round((z + 0.25) * 100) / 100))}>➕</button>
        <button className="chip" style={ctlChip} onClick={() => void switchCamera()}>🔄</button>
      </div>
    </div>
  );

  const cameraBlock = camMountable ? (
    <div
      style={
        camFull
          ? landscape
            ? { ...landscapeBox, background: '#0b0d10' }
            : { position: 'fixed', inset: 0, zIndex: 70, background: '#0b0d10', overflow: 'hidden' }
          : showCamera
          ? { position: 'relative', marginTop: 14, borderRadius: 'var(--r-xl)', overflow: 'hidden', background: '#0b0d10', aspectRatio: '4 / 3', boxShadow: 'var(--e3)' }
          : { display: 'none' }
      }
    >
      <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scaleX(${mirror ? -1 : 1}) scale(${camZoom})`, transition: 'transform .15s var(--ease)' }} />
      {showCamera && (
        <>
      {drumMode ? (
        /* 드럼 키트 모양(2D). 손을 모양 위로 가져가 타격 → 해당 드럼 소리 */
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {DRUM_KIT_LAYOUT.map((s) => {
            const on = flashPiece === s.key;
            return (
              <div
                key={s.key}
                style={{
                  position: 'absolute',
                  left: `${s.x * 100}%`,
                  top: `${s.y * 100}%`,
                  transform: on ? 'translate(-50%,-50%) scale(1.14)' : 'translate(-50%,-50%)',
                  width: `${s.r * 200}%`,
                  aspectRatio: '1',
                  borderRadius: '50%',
                  border: `${on ? 4 : 2}px solid ${s.color}`,
                  background: on ? s.color : `${s.color}26`,
                  boxShadow: on ? `0 0 18px ${s.color}` : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: camFull ? 14 : 11,
                  textShadow: '0 1px 3px rgba(0,0,0,.7)',
                  transition: 'transform .07s, background .07s, box-shadow .07s',
                }}
              >
                {s.label}
              </div>
            );
          })}
        </div>
      ) : instrument === 'guitar' || instrument === 'bass' ? (
        /* 기타/베이스: 투명 실루엣 + 프렛 칸(C | F | Am | G) + 현 진동 */
        <GestureFretboard zoneCount={zoneN} selected={selected} active={gestureChords} instrument={instrument} camFull={camFull} />
      ) : (
        /* 코드 수평 존(피아노) */
        <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, zoneN)}, 1fr)` }}>
          {Array.from({ length: zoneN }).map((_, i) => {
            const label = selected[i] ?? null;
            const col = selected[i] ? chordColor(selected[i], i)[0] : '#ffffff';
            const isActive = label !== null && gestureChords.includes(label);
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 16, borderRight: i < zoneN - 1 ? '1px solid rgba(255,255,255,.18)' : 'none', borderTop: isActive ? `4px solid ${col}` : '4px solid transparent', background: isActive ? `${col}99` : 'transparent', transition: 'background .08s', color: '#fff' }}>
                {label && ROMAN[label] && <span style={{ fontSize: 11, opacity: 0.7, fontWeight: 700 }}>{ROMAN[label]}</span>}
                <span style={{ fontSize: camFull ? 34 : 24, fontWeight: 800, textShadow: '0 1px 4px rgba(0,0,0,.6)', transform: isActive ? 'scale(1.12)' : 'none', transition: 'transform .08s' }}>{label ?? '—'}</span>
              </div>
            );
          })}
        </div>
      )}
      {devMode && landmarks && (
        <div style={{ position: 'absolute', inset: 0, transform: `scaleX(${mirror ? -1 : 1}) scale(${camZoom})`, pointerEvents: 'none' }}>
          {landmarks.map((p, i) => (
            <span key={i} style={{ position: 'absolute', left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: 7, height: 7, marginLeft: -3.5, marginTop: -3.5, borderRadius: '50%', background: '#7CFC9B', boxShadow: '0 0 5px #7CFC9B' }} />
          ))}
        </div>
      )}
      {sparkles.length > 0 && (
        /* 효과 스파클: 손 흔들기/박수/헤드뱅잉 시 손·머리 주변에 튀는 이모지(영상과 동일 변환으로 정렬) */
        <div style={{ position: 'absolute', inset: 0, transform: `scaleX(${mirror ? -1 : 1}) scale(${camZoom})`, pointerEvents: 'none', zIndex: 5 }}>
          {sparkles.map((p) => (
            <span key={p.id} className="fx-pop" style={{ position: 'absolute', left: `${p.x * 100}%`, top: `${p.y * 100}%`, fontSize: 30, lineHeight: 1, whiteSpace: 'nowrap' }}>
              {p.kind === 'tambourine' ? '🔔✨' : p.kind === 'clap' ? '👏✨' : '💫✨'}
            </span>
          ))}
        </div>
      )}
          {gestureControls}
        </>
      )}
    </div>
  ) : null;

  return (
    <>
      {devMode && <DevOverlay fps={fps} latency={latency} brightness={brightness} onBrightness={setBrightness} />}

      <div className="appbar">
        스튜디오
        <span className="c-sub" style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 500 }} onClick={() => go('home')}>
          홈
        </span>
      </div>

      <div className="content" style={{ paddingBottom: 'calc(108px + env(safe-area-inset-bottom))' }}>
        {/* 설정 요약 칩바 — 연주법·악기·음색·입력을 한 줄로(탭하면 바텀시트, 현재값 라벨 표시) */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'stretch', marginTop: 4 }}>
          {!drumMode && (
            <button className="chip chip-ghost" style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '9px 6px', whiteSpace: 'nowrap' }} onClick={() => setModeSheet(true)}>
              {playMode === 'chord' ? '🎸 코드' : '🎹 멜로디'} <span aria-hidden style={{ opacity: 0.5 }}>▾</span>
            </button>
          )}
          <InstrumentCombo inline instrument={instrument} style={style} disabled={busy} onPick={chooseVoice} />
          {(drumMode || playMode === 'chord') && (
            <button className="chip chip-ghost" style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '9px 6px', whiteSpace: 'nowrap' }} onClick={() => setInputSheet(true)}>
              {input === 'touch' ? '👆 터치' : '👋 제스처'} <span aria-hidden style={{ opacity: 0.5 }}>▾</span>
            </button>
          )}
        </div>

        {/* 연주법 시트 */}
        {modeSheet && (
          <>
            <div className="backdrop" onClick={() => setModeSheet(false)} />
            <div className="sheet">
              <div className="sheet-grip" />
              <div className="t-title" style={{ padding: '4px 6px 8px' }}>연주법</div>
              <button className="sheet-row" data-on={playMode === 'chord'} onClick={() => { switchMode('chord'); setModeSheet(false); }}>
                <span style={{ fontSize: 24 }}>🎸</span>
                <span className="t-body" style={{ flex: 1, fontWeight: 600 }}>코드</span>
                {playMode === 'chord' && <span style={{ color: 'var(--blue)', fontWeight: 800 }}>✓</span>}
              </button>
              <button className="sheet-row" data-on={playMode === 'melody'} onClick={() => { switchMode('melody'); setModeSheet(false); }}>
                <span style={{ fontSize: 24 }}>🎹</span>
                <span className="t-body" style={{ flex: 1, fontWeight: 600 }}>멜로디</span>
                {playMode === 'melody' && <span style={{ color: 'var(--blue)', fontWeight: 800 }}>✓</span>}
              </button>
            </div>
          </>
        )}

        {/* 입력 방식 시트 */}
        {inputSheet && (
          <>
            <div className="backdrop" onClick={() => setInputSheet(false)} />
            <div className="sheet">
              <div className="sheet-grip" />
              <div className="t-title" style={{ padding: '4px 6px 8px' }}>입력 방식</div>
              <button className="sheet-row" data-on={input === 'touch'} onClick={() => { selectTouch(); setInputSheet(false); }}>
                <span style={{ fontSize: 24 }}>👆</span>
                <span className="t-body" style={{ flex: 1, fontWeight: 600 }}>터치</span>
                {input === 'touch' && <span style={{ color: 'var(--blue)', fontWeight: 800 }}>✓</span>}
              </button>
              <button className="sheet-row" data-on={input === 'gesture'} onClick={() => { void selectGesture(); setInputSheet(false); }}>
                <span style={{ fontSize: 24 }}>👋</span>
                <span className="t-body" style={{ flex: 1, fontWeight: 600 }}>제스처 (카메라)</span>
                {input === 'gesture' && <span style={{ color: 'var(--blue)', fontWeight: 800 }}>✓</span>}
              </button>
            </div>
          </>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 24, marginTop: 14 }}>
          <div style={{ display: 'flex', gap: 7 }}>
            {Array.from({ length: BEATS_PER_BAR }).map((_, i) => (
              <span key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: beat === i ? 'var(--blue)' : 'var(--line-2)', transform: beat === i ? 'scale(1.3)' : 'none', transition: 'all .08s var(--ease)' }} />
            ))}
          </div>
          <span className="t-cap c-sub" style={{ fontWeight: recording ? 700 : 400, color: recording ? 'var(--coral)' : undefined }}>{statusText}</span>
        </div>


        {/* 카메라(코드/드럼 제스처) — 본문 안, 전체화면 시 fixed로 덮음 */}
        {cameraBlock}

        {/* 코드 매트릭스(코드 모드) */}
        {!drumMode && playMode === 'chord' && (
          <ChordMatrix selected={selected} onToggle={toggleChord} onPreset={() => setSelected([...PRESET_POP])} disabled={busy} />
        )}

        {/* 코드 터치 패드 */}
        {!drumMode && playMode === 'chord' && input === 'touch' && (
          selected.length === 0 ? (
            <div className="t-cap c-sub" style={{ textAlign: 'center', padding: 20 }}>연주할 코드를 골라보세요</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
              {selected.map((c, idx) => {
                const [base, dark] = chordColor(c, idx);
                return (
                  <button
                    key={c}
                    className="pad"
                    data-on={active === c}
                    style={{ ['--accent' as string]: base, ['--accent-d' as string]: dark, touchAction: 'none' } as CSSProperties}
                    onPointerDown={(e) => {
                      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* 캡처 미지원 무시 */ }
                      chordPointerRef.current.add(e.pointerId);
                      // 지연-down 레이스: 떼는 게 먼저면(set에서 제거됨) chordOn을 아예 안 울림
                      void ensureAudio().then(() => { if (chordPointerRef.current.has(e.pointerId)) downChord(c, 'touch'); });
                    }}
                    onPointerUp={(e) => { if (chordPointerRef.current.delete(e.pointerId)) upChord('touch'); }}
                    onPointerCancel={(e) => { if (chordPointerRef.current.delete(e.pointerId)) upChord('touch'); }}
                    onPointerLeave={(e) => { if (chordPointerRef.current.delete(e.pointerId)) upChord('touch'); }}
                  >
                    {ROMAN[c] && <span className="pad-sub">{ROMAN[c]}</span>}
                    {c}
                  </button>
                );
              })}
            </div>
          )
        )}

        {/* 멜로디 — 피아노 건반(인라인) */}
        {!drumMode && playMode === 'melody' && instrument === 'piano' && !melodyFull && (
          <div style={{ marginTop: 14 }}>
            <button className="chip chip-ghost" style={{ marginBottom: 10 }} onClick={() => setFullscreen(true)}>⛶ 전체화면</button>
            {renderPiano(false)}
          </div>
        )}

        {/* 멜로디 — 기타/베이스 패드(인라인) */}
        {!drumMode && playMode === 'melody' && fretInstrument && !melodyFull && (
          <div style={{ marginTop: 14 }}>
            <button className="chip chip-ghost" style={{ marginBottom: 4 }} onClick={() => setFullscreen(true)}>⛶ 전체화면</button>
            <NotePadGrid instrument={fretInstrument} held={heldNotes} frets={FRETS_NORMAL} onDown={melodyDown} onUp={melodyUp} />
          </div>
        )}

        {/* 드럼 터치 패드(인라인) */}
        {drumMode && input !== 'gesture' && !drumTouchFull && (
          <>
            <button className="chip chip-ghost" style={{ marginTop: 14 }} onClick={() => setFullscreen(true)}>⛶ 전체화면</button>
            <DrumPad onHit={hitDrum} flash={flashPiece} />
          </>
        )}

        {(sessionTracks.length > 0 || sessionCode) && (
          <div className="card" style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div className="t-body" style={{ fontWeight: 700 }}>🎵 {baseOwner ? `${baseOwner}님과 합주` : '내 트랙'}</div>
                <div className="t-cap c-sub">{sessionCode ? `코드 ${sessionCode} · ` : ''}트랙 {sessionTracks.length}개{hasTake ? ' (+녹음중 1)' : ''}</div>
              </div>
            </div>
            {sessionTracks.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sessionTracks.map((t, i) => {
                  const meta = INSTRUMENTS.find((x) => x.key === t.instrument);
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="track-av" data-playing={jamming} style={{ background: SIG[i % SIG.length], animationDelay: `${i * 0.12}s` }}>
                        {(t.owner || '?').slice(0, 1)}
                      </span>
                      <div style={{ flex: 1, lineHeight: 1.3 }}>
                        <div className="t-cap c-sub2" style={{ fontWeight: 700 }}>{meta?.emoji ?? '🎵'} {meta?.label ?? '악기'}</div>
                        <div className="t-cap c-sub">{t.owner}</div>
                      </div>
                      {!sessionCode && !busy && (
                        <button className="chip chip-ghost" style={{ padding: '6px 11px' }} onClick={() => deleteTrack(i)}>✕</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              {hasTake && !busy && (
                <button className="btn" style={{ flex: 1, background: 'var(--blue-weak)', color: 'var(--blue)', boxShadow: 'var(--e2)' }} onClick={addLayer}>＋ 레이어 추가</button>
              )}
              <button className="btn" style={{ flex: 1, background: jamming ? 'var(--coral)' : 'var(--blue)', color: '#fff' }} disabled={busy} onClick={jamming ? stopJam : playSession}>
                {jamming ? '■ 정지' : '🎶 합주 듣기'}
              </button>
            </div>
          </div>
        )}

        {toast && <div style={{ marginTop: 14, textAlign: 'center', color: 'var(--blue)', fontWeight: 700, fontSize: 14 }}>{toast}</div>}
      </div>

      {/* 하단 고정 트랜스포트 바 — 연주 중 항상 닿는 메트로놈·녹음·재생·더보기 */}
      {!melodyFull && !drumTouchFull && !camFull && !editing && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, maxWidth: 480, margin: '0 auto', zIndex: 30, background: 'var(--surface)', boxShadow: '0 -3px 18px rgba(17,24,39,.10)', borderRadius: '18px 18px 0 0', padding: '10px 16px calc(10px + env(safe-area-inset-bottom))' }}>
          {/* 재생바: 녹음한 take 재생 위치(빨간 헤드) + 탭/드래그 스크럽 */}
          {hasTake && !busy && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
              <span className="t-cap c-sub" style={{ minWidth: 30, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtMs(playMs)}</span>
              <div
                ref={barRef}
                onPointerDown={onBarDown}
                onPointerMove={onBarMove}
                onPointerUp={onBarUp}
                onPointerCancel={onBarUp}
                style={{ flex: 1, height: 20, display: 'flex', alignItems: 'center', cursor: 'pointer', touchAction: 'none' }}
              >
                <div style={{ position: 'relative', width: '100%', height: 6, borderRadius: 999, background: 'var(--line-2)' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${playPct}%`, background: 'var(--blue)', borderRadius: 999 }} />
                  <span style={{ position: 'absolute', left: `${playPct}%`, top: '50%', transform: 'translate(-50%,-50%)', width: 15, height: 15, borderRadius: '50%', background: '#fff', border: '2.5px solid var(--blue)', boxShadow: 'var(--e1)' }} />
                </div>
              </div>
              <span className="t-cap c-sub" style={{ minWidth: 30, fontVariantNumeric: 'tabular-nums' }}>{fmtMs(takeMs)}</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={toggleMetro} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '9px 0', fontSize: 11, fontWeight: 700, background: metroOn ? 'var(--blue)' : 'var(--surface)', color: metroOn ? '#fff' : 'var(--text)', boxShadow: metroOn ? 'var(--e-inset)' : 'var(--e2)' }}>
              <span style={{ fontSize: 20 }}>🥁</span>메트로놈
            </button>
            <button className="btn" onClick={toggleRec} style={{ flex: 1.5, display: 'flex', flexDirection: 'column', gap: 2, padding: '9px 0', fontSize: 13, fontWeight: 800, background: busy ? 'var(--coral)' : 'var(--blue)', color: '#fff', boxShadow: 'var(--e3)' }}>
              <span style={{ fontSize: 22 }}>{busy ? '■' : '●'}</span>{busy ? '정지' : '녹음'}
            </button>
            <button className="btn" onClick={togglePlay} disabled={!hasTake || busy} title={!hasTake ? '녹음하면 재생할 수 있어요' : undefined} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '9px 0', fontSize: 11, fontWeight: 700, background: playing ? 'var(--blue)' : 'var(--surface)', color: playing ? '#fff' : hasTake && !busy ? 'var(--text)' : 'var(--sub)', boxShadow: 'var(--e2)' }}>
              <span style={{ fontSize: 20 }}>{playing ? '⏸' : '▶'}</span>{playing ? '일시정지' : '재생'}
            </button>
            <button className="btn" onClick={() => setShowMore(true)} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '9px 0', fontSize: 11, fontWeight: 700, background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--e2)' }}>
              <span style={{ fontSize: 20 }}>⋯</span>더보기
            </button>
          </div>
        </div>
      )}

      {/* 더보기 시트 — 공유·저장·음편집·가져오기·구경가기 */}
      {showMore && (
        <>
          <div className="backdrop" onClick={() => setShowMore(false)} />
          <div className="sheet">
            <div className="sheet-grip" />
            <button className="sheet-row" disabled={!hasTake || busy} style={{ opacity: hasTake && !busy ? 1 : 0.45 }} onClick={() => { setShowMore(false); addLayer(); }}>
              <span style={{ fontSize: 22 }}>➕</span>
              <span style={{ flex: 1, textAlign: 'left' }}>
                <span className="t-body" style={{ fontWeight: 700, display: 'block' }}>레이어 추가</span>
                <span className="t-cap c-sub">{hasTake ? '이 트랙을 쌓고 다른 악기로 녹음' : '녹음 후 사용 가능'}</span>
              </span>
            </button>
            <button className="sheet-row" disabled={!hasTake || busy} style={{ opacity: hasTake && !busy ? 1 : 0.45 }} onClick={() => { setShowMore(false); void share(); }}>
              <span style={{ fontSize: 22 }}>📤</span>
              <span style={{ flex: 1, textAlign: 'left' }}>
                <span className="t-body" style={{ fontWeight: 700, display: 'block' }}>공유</span>
                <span className="t-cap c-sub">{hasTake ? '합주 코드로 친구에게 공유' : '녹음 후 사용 가능'}</span>
              </span>
            </button>
            <button className="sheet-row" disabled={(!hasTake && sessionTracks.length === 0) || busy} style={{ opacity: (hasTake || sessionTracks.length > 0) && !busy ? 1 : 0.45 }} onClick={() => { setShowMore(false); void publishDerivative(); }}>
              <span style={{ fontSize: 22 }}>🌱</span>
              <span style={{ flex: 1, textAlign: 'left' }}>
                <span className="t-body" style={{ fontWeight: 700, display: 'block' }}>커뮤니티에 올리기</span>
                <span className="t-cap c-sub">{forked && !forked.code.startsWith('LOCAL') ? `${forked.name} 위에 쌓아 올리기 (출처 박힘)` : '내 합주를 보드에 공개'}</span>
              </span>
            </button>
            <button className="sheet-row" disabled={!hasTake || busy} style={{ opacity: hasTake && !busy ? 1 : 0.45 }} onClick={() => { setShowMore(false); saveCurrent(); }}>
              <span style={{ fontSize: 22 }}>💾</span>
              <span style={{ flex: 1, textAlign: 'left' }}>
                <span className="t-body" style={{ fontWeight: 700, display: 'block' }}>저장</span>
                <span className="t-cap c-sub">{hasTake ? '내 기기에 곡 저장' : '녹음 후 사용 가능'}</span>
              </span>
            </button>
            <button className="sheet-row" disabled={!hasTake || busy} style={{ opacity: hasTake && !busy ? 1 : 0.45 }} onClick={() => { setShowMore(false); setEditing(true); }}>
              <span style={{ fontSize: 22 }}>🎚</span>
              <span style={{ flex: 1, textAlign: 'left' }}>
                <span className="t-body" style={{ fontWeight: 700, display: 'block' }}>음 편집</span>
                <span className="t-cap c-sub">{hasTake ? '피아노롤로 음 다듬기' : '녹음 후 사용 가능'}</span>
              </span>
            </button>
            <button className="sheet-row" disabled={!hasTake || busy} style={{ opacity: hasTake && !busy ? 1 : 0.45 }} onClick={() => { setShowMore(false); setLoopSheet(true); }}>
              <span style={{ fontSize: 22 }}>🔁</span>
              <span style={{ flex: 1, textAlign: 'left' }}>
                <span className="t-body" style={{ fontWeight: 700, display: 'block' }}>구간 반복{looped ? ' (적용됨)' : ''}</span>
                <span className="t-cap c-sub">{hasTake ? '녹음 앞부분을 마디·횟수로 반복' : '녹음 후 사용 가능'}</span>
              </span>
            </button>
            <div style={{ height: 1, background: 'var(--line)', margin: '8px 6px' }} />
            <button className="sheet-row" onClick={() => { setShowMore(false); void receive(); }}>
              <span style={{ fontSize: 22 }}>📥</span>
              <span style={{ flex: 1, textAlign: 'left' }}>
                <span className="t-body" style={{ fontWeight: 700, display: 'block' }}>가져오기</span>
                <span className="t-cap c-sub">친구 트랙 받아서 얹기</span>
              </span>
            </button>
            <button className="sheet-row" onClick={() => { setShowMore(false); go('community'); }}>
              <span style={{ fontSize: 22 }}>🌐</span>
              <span style={{ flex: 1, textAlign: 'left' }}>
                <span className="t-body" style={{ fontWeight: 700, display: 'block' }}>구경 가기</span>
                <span className="t-cap c-sub">다른 사람들의 합주 둘러보기</span>
              </span>
            </button>
            <button className="btn" style={{ marginTop: 10, background: 'var(--bg)', color: 'var(--text-2)' }} onClick={() => setShowMore(false)}>닫기</button>
          </div>
        </>
      )}

      {/* 구간 반복 시트 */}
      {loopSheet && (
        <>
          <div className="backdrop" onClick={() => setLoopSheet(false)} />
          <div className="sheet">
            <div className="sheet-grip" />
            <div className="t-title" style={{ padding: '4px 6px 6px' }}>🔁 구간 반복</div>
            <div className="t-cap c-sub" style={{ padding: '0 6px 14px' }}>녹음 앞부분을 정한 마디만큼 잘라 정한 횟수로 이어붙여요. (예: 1마디 × 4 = 4마디)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 6px 10px' }}>
              <span className="t-cap c-sub" style={{ width: 44 }}>길이</span>
              {[1, 2, 4].map((b) => (
                <button key={b} className={loopBars === b ? 'chip' : 'chip chip-ghost'} onClick={() => setLoopBars(b)}>{b}마디</button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 6px 16px' }}>
              <span className="t-cap c-sub" style={{ width: 44 }}>횟수</span>
              {[2, 4, 8].map((n) => (
                <button key={n} className={loopCount === n ? 'chip' : 'chip chip-ghost'} onClick={() => setLoopCount(n)}>×{n}</button>
              ))}
            </div>
            <button className="btn" onClick={() => { applyLoop(); setLoopSheet(false); }}>적용 · {loopBars}마디 × {loopCount}회</button>
            <button className="btn" style={{ marginTop: 8, background: 'var(--bg)', color: 'var(--text-2)' }} disabled={!looped} onClick={() => { clearLoop(); setLoopSheet(false); }}>반복 해제</button>
          </div>
        </>
      )}

      {/* 멜로디 전체화면 */}
      {melodyFull && surfaceWrap(instrument === 'piano' ? renderPiano(true) : fretInstrument ? <NotePadGrid instrument={fretInstrument} held={heldNotes} frets={FRETS_FULL} onDown={melodyDown} onUp={melodyUp} /> : null)}

      {/* 드럼 터치 전체화면 */}
      {drumTouchFull && surfaceWrap(<DrumPad onHit={hitDrum} flash={flashPiece} />)}

      {/* 음 편집(피아노롤) */}
      {editing && (
        <NoteEditor
          events={stateRef.current.events}
          onApply={(evs) => {
            stateRef.current = { ...initialChordState, events: evs };
            setHasTake(evs.length > 0);
            setActive(null);
            setEditing(false);
          }}
          onClose={() => setEditing(false)}
        />
      )}

      {/* 합주 받기 바텀시트 */}
      {showReceive && pending && (
        <>
          <div className="backdrop" onClick={() => { setShowReceive(false); setPending(null); }} />
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
            <button className="btn" style={{ marginTop: 8, background: 'var(--bg)', color: 'var(--text-2)' }} onClick={() => { setShowReceive(false); setPending(null); }}>
              닫기
            </button>
          </div>
        </>
      )}
    </>
  );

  function renderPiano(full: boolean): ReactNode {
    const { whites, blacks } = buildKeys(octave);
    const blackW = (100 / (WHITE_PC.length * VISIBLE_OCTAVES)) * 0.62;
    const h = full ? 'min(64vh, 420px)' : 200;
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <button className="chip" style={{ opacity: octave <= OCTAVE_MIN ? 0.4 : 1 }} disabled={octave <= OCTAVE_MIN} onClick={() => shiftOctave(-1)}>▼ 옥타브</button>
          <span className="t-cap c-sub" style={{ flex: 1, textAlign: 'center', fontWeight: 700 }}>C{octave} ~ B{octave + 1}</span>
          <button className="chip" style={{ opacity: octave >= OCTAVE_MAX ? 0.4 : 1 }} disabled={octave >= OCTAVE_MAX} onClick={() => shiftOctave(1)}>옥타브 ▲</button>
        </div>
        <div style={{ position: 'relative', height: h, userSelect: 'none', touchAction: 'none' }}>
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
  }
}
