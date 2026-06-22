import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
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
  type Voice,
} from '../audio/engine';
import { chordReducer, initialChordState, type ChordState, type Source } from '../audio/chordReducer';
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
import { saveSong, newSongId, listSongs, type Song } from '../lib/storage';
import { initHandTracking, startCamera, stopCamera, detect, type GestureMode, type Pt } from '../audio/gesture';
import {
  createSession,
  getSession,
  addTrack,
  copyText,
  readClipboardCode,
  ping,
  PRELOAD,
  type Session,
  type SessionTrack,
} from '../lib/share';
import { getNickname } from '../lib/identity';
import { InstrumentCombo } from '../components/studio/InstrumentCombo';
import { ChordMatrix } from '../components/studio/ChordMatrix';
import { NotePadGrid } from '../components/studio/NotePadGrid';
import { DrumPad } from '../components/studio/DrumPad';
import { DevOverlay } from '../components/studio/DevOverlay';
import { NoteEditor } from '../components/studio/NoteEditor';
import { ROMAN, chordColor, PRESET_POP, MAX_CHORDS, GESTURE_ZONES, GESTURE_ZONES_FULL, FRETS_NORMAL, FRETS_FULL, DRUM_KIT_LAYOUT, nearestDrumPiece } from '../components/studio/chords';

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
  const [toast, setToast] = useState('');
  const [input, setInput] = useState<Input>('touch');
  const [camMsg, setCamMsg] = useState('');
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [baseOwner, setBaseOwner] = useState('');
  const [trackCount, setTrackCount] = useState(0);
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
  const [flashPiece, setFlashPiece] = useState<DrumPiece | null>(null); // 드럼 타격 시 모양/패드 깜빡임
  const [hands, setHands] = useState<1 | 2>(1); // 제스처 한 손/양손
  const [gestureChords, setGestureChords] = useState<string[]>([]); // 제스처로 현재 울리는 코드(존 하이라이트)

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
    if (!forked) return;
    const base = forked.tracks[0];
    if (!base) return;
    clearMelody();
    stateRef.current = { ...initialChordState, events: base.events };
    setHasTake(base.events.length > 0);
    setSessionCode(forked.code.startsWith('LOCAL') ? null : forked.code);
    setBaseOwner(base.owner);
    setTrackCount(forked.tracks.length);
    setSessionTracks(forked.tracks);
    flashToast(`${base.owner}님 트랙을 얹을 준비 완료`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forked]);

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
  }

  function shiftOctave(d: number) {
    clearMelody();
    setOctave((o) => Math.min(OCTAVE_MAX, Math.max(OCTAVE_MIN, o + d)));
  }

  function switchMode(m: PlayMode) {
    if (m === playMode || instrument === 'drum') return;
    allOff();
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

  // 제스처 루프: 코드(지속음) / 드럼(상승엣지 타격). 한 손/양손(최대 2).
  function loop() {
    const v = videoRef.current;
    if (v && v.readyState >= 2) {
      const mirror = facingRef.current === 'user';
      const maxHands = handsRef.current;
      if (drumModeRef.current) {
        const frames = detect(v, performance.now(), { zoneCount: 1, mode: gestureModeRef.current, mirror }).slice(0, maxHands);
        if (devRef.current) setLandmarks(frames.flatMap((f) => f.landmarks ?? []));
        for (let i = 0; i < 2; i++) {
          const f = frames[i];
          let piece: DrumPiece | null = null;
          if (f && f.active && f.pos) {
            const hx = mirror ? 1 - f.pos.x : f.pos.x;
            piece = nearestDrumPiece(hx, f.pos.y);
          }
          const prev = drumPrevRef.current[i];
          if (piece !== null && (!prev.active || prev.piece !== piece)) hitDrum(piece, 'gesture');
          drumPrevRef.current[i] = { active: piece !== null, piece };
        }
      } else {
        const zones = selectedRef.current.slice(0, fullscreenRef.current ? GESTURE_ZONES_FULL : GESTURE_ZONES);
        const frames = detect(v, performance.now(), { zoneCount: Math.max(1, zones.length), mode: gestureModeRef.current, mirror }).slice(0, maxHands);
        if (devRef.current) setLandmarks(frames.flatMap((f) => f.landmarks ?? []));
        if (maxHands === 1) {
          const f = frames[0];
          if (f && f.active && f.zone !== null && f.zone < zones.length) downChord(zones[f.zone], 'gesture');
          else upChord('gesture');
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
    drumPrevRef.current = [
      { active: false, piece: null },
      { active: false, piece: null },
    ];
    twoHandRef.current = [null, null];
    setGestureChords([]);
  }

  async function selectGesture() {
    if (input === 'gesture') return;
    setCamMsg('카메라 준비 중…');
    try {
      await ensureAudio();
      await initHandTracking();
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

  function scheduleEvents(events: SessionTrack['events'], voices: { chord: Voice; melody: Voice; drum: Voice }): number {
    let maxMs = 0;
    for (const ev of normalizeEvents(events)) {
      const ms = tickToMs(ev.tick);
      if (ms > maxMs) maxMs = ms;
      const id = window.setTimeout(() => {
        if (ev.kind === 'drum') voices.drum.hit(ev.piece);
        else if (ev.kind === 'melody') {
          if (ev.phase === 'on') voices.melody.on(ev.note);
          else voices.melody.off(ev.note);
        } else {
          if (ev.phase === 'on') voices.chord.on(ev.chord);
          else voices.chord.off(ev.chord);
        }
      }, ms);
      playTimersRef.current.push(id);
    }
    return maxMs;
  }

  async function play() {
    await ensureAudio();
    stopPlayback();
    stopJam();
    allOff();
    soundingRef.current = null;
    clearMelody();
    // 현재 악기 보이스(샘플 로드됐으면 실제 샘플)로 take 재생.
    let maxMs = 0;
    for (const ev of normalizeEvents(stateRef.current.events)) {
      const ms = tickToMs(ev.tick);
      if (ms > maxMs) maxMs = ms;
      const id = window.setTimeout(() => {
        if (ev.kind === 'drum') triggerHit(ev.piece);
        else if (ev.kind === 'melody') {
          if (ev.phase === 'on') downNote(ev.note);
          else upNote(ev.note);
        } else {
          if (ev.phase === 'on') chordOn(ev.chord);
          else chordOff(ev.chord);
        }
      }, ms);
      playTimersRef.current.push(id);
    }
    playTimersRef.current.push(window.setTimeout(() => allOff(), maxMs + 300));
  }

  function stopJam() {
    voicesRef.current.forEach((v) => v.dispose());
    voicesRef.current = [];
    setJamming(false);
  }

  function playSession() {
    void ensureAudio().then(() => {
      stopJam();
      stopPlayback();
      const tracks = sessionTracks.length ? sessionTracks : [{ owner: '나', events: stateRef.current.events, createdAt: 0 }];
      const all: Voice[] = [];
      let maxMs = 0;
      tracks.forEach((t, i) => {
        const inst = inferInstrument(t.events);
        const tStyle = inst === 'drum' ? (i % 2 ? 'electronic' : 'analog') : i % 2 ? 'electric' : 'grand';
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
    setShowReceive(true);
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
    setShowReceive(false);
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
  const drumMode = instrument === 'drum';
  const fretInstrument: 'guitar' | 'bass' | null = instrument === 'guitar' || instrument === 'bass' ? instrument : null;
  const countdown = BEATS_PER_BAR - (beat < 0 ? 0 : beat);
  const statusText = camMsg || (countin ? `카운트인 ${countdown}` : recording ? '녹음 중' : !ready ? '눌러서 소리 켜기' : '준비됐어요');
  const ctrlBtn = (bg: string, color: string, shadow = 'var(--e2)'): CSSProperties => ({ flex: 1, background: bg, color, boxShadow: shadow });
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
    setHands((h) => (h === 1 ? 2 : 1));
    twoHandRef.current.forEach((c) => c && chordOff(c)); // 잔류음 정리
    twoHandRef.current = [null, null];
    upChord('gesture');
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
      ) : (
        /* 코드 수평 존 */
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
          {gestureControls}
        </>
      )}
    </div>
  ) : null;

  return (
    <>
      {devMode && <DevOverlay fps={fps} latency={latency} />}

      <div className="appbar">
        스튜디오
        <span className="c-sub" style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 500 }} onClick={() => go('home')}>
          홈
        </span>
      </div>

      <div className="content">
        <div className="segment" style={{ opacity: drumMode ? 0.45 : 1 }}>
          <button className="seg" data-on={!drumMode && playMode === 'chord'} disabled={drumMode} onClick={() => switchMode('chord')}>🎸 코드</button>
          <button className="seg" data-on={!drumMode && playMode === 'melody'} disabled={drumMode} onClick={() => switchMode('melody')}>🎹 멜로디</button>
        </div>

        <InstrumentCombo instrument={instrument} style={style} disabled={busy} onPick={chooseVoice} />

        {(drumMode || playMode === 'chord') && (
          <div className="segment" style={{ marginTop: 8 }}>
            <button className="seg" data-on={input === 'touch'} onClick={selectTouch}>👆 터치</button>
            <button className="seg" data-on={input === 'gesture'} onClick={selectGesture}>👋 제스처</button>
          </div>
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
                    style={{ ['--accent' as string]: base, ['--accent-d' as string]: dark } as CSSProperties}
                    onPointerDown={() => void ensureAudio().then(() => downChord(c, 'touch'))}
                    onPointerUp={() => upChord('touch')}
                    onPointerLeave={() => active === c && upChord('touch')}
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
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button className="btn" style={{ flex: 1, background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--e2)' }} onClick={saveCurrent}>
              💾 저장
            </button>
            <button className="btn" style={{ flex: 1, background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--e2)' }} onClick={() => setEditing(true)}>
              🎚 음 편집
            </button>
          </div>
        )}

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

        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button className="btn" style={{ flex: 1, background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--e2)' }} onClick={receive}>📥 가져오기</button>
          <button className="btn" style={{ flex: 1, background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--e2)' }} onClick={() => go('community')}>🌐 구경 가기</button>
          {hasTake && !busy && (
            <button className="btn" style={{ flex: 1, background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--e2)' }} onClick={share}>📤 공유</button>
          )}
        </div>

        {toast && <div style={{ marginTop: 14, textAlign: 'center', color: 'var(--blue)', fontWeight: 700, fontSize: 14 }}>{toast}</div>}
      </div>

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
