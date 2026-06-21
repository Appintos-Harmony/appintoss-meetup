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
type Sheet = 'timbre' | 'receive' | null;

// 코드별 강조색 + 기능(로마숫자, C장조 기준)
const ACCENT: Record<Chord, [string, string]> = {
  C: ['#3182f6', '#1b64da'],
  Am: ['#8b5cf6', '#7c3aed'],
  F: ['#15c47e', '#0fa968'],
  G: ['#ff6b6b', '#ee5253'],
};
const ROMAN: Record<Chord, string> = { C: 'I', Am: 'vi', F: 'IV', G: 'V' };
const SIG = ['#3182f6', '#ff6b6b', '#15c47e', '#8b5cf6', '#ff9f1c'];
const TIMBRE_LABEL: Record<Timbre, string> = { acoustic: '어쿠스틱 피아노', electric: '일렉트릭', synthbass: '신스 베이스' };
const TIMBRE_EMOJI: Record<Timbre, string> = { acoustic: '🎹', electric: '🎸', synthbass: '🎵' };

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
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [baseOwner, setBaseOwner] = useState('');
  const [trackCount, setTrackCount] = useState(0);
  const [sessionTracks, setSessionTracks] = useState<SessionTrack[]>([]);
  const [jamming, setJamming] = useState(false);
  const [timbre, setTimbreState] = useState<Timbre>(() => getTimbre());
  const [sheet, setSheet] = useState<Sheet>(null);
  const [pending, setPending] = useState<Session | null>(null);

  const stateRef = useRef<ChordState>(initialChordState);
  const recordStartRef = useRef(0);
  const phaseRef = useRef<Phase>('idle');
  phaseRef.current = phase;
  const soundingRef = useRef<Chord | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const voicesRef = useRef<Voice[]>([]);

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

  function applyChord(next: Chord | null) {
    if (soundingRef.current === next) return;
    if (soundingRef.current) chordOff(soundingRef.current);
    if (next) chordOn(next);
    soundingRef.current = next;
  }

  function downChord(chord: Chord, source: Source) {
    stateRef.current = chordReducer(stateRef.current, { type: 'down', chord, source, tick: curTick(), nowMs: performance.now() });
    const a = stateRef.current.activeChord as Chord | null;
    applyChord(a);
    setActive(a);
  }

  function upChord(source: Source) {
    stateRef.current = chordReducer(stateRef.current, { type: 'up', source, tick: curTick(), nowMs: performance.now() });
    const a = stateRef.current.activeChord as Chord | null;
    applyChord(a);
    setActive(a);
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
            if (ev.phase === 'on') voices[i].on(ev.chord as Chord);
            else voices[i].off(ev.chord as Chord);
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

  // 합주 받기 → 바텀시트로 확인
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

  const recording = phase === 'recording';
  const countin = phase === 'countin';
  const busy = phase !== 'idle';
  const countdown = BEATS_PER_BAR - (beat < 0 ? 0 : beat);
  const statusText = camMsg || (countin ? `카운트인 ${countdown}` : recording ? '녹음 중' : !ready ? '코드를 누르면 소리가 켜져요' : '준비됐어요');

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
        {/* 입력 세그먼트 */}
        <div className="segment">
          <button className="seg" data-on={input === 'touch'} onClick={selectTouch}>👆 터치</button>
          <button className="seg" data-on={input === 'gesture'} onClick={selectGesture}>👋 제스처</button>
        </div>

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

        {/* 제스처 카메라 (항상 마운트) */}
        <div style={{ display: input === 'gesture' ? 'block' : 'none', position: 'relative', marginTop: 14, borderRadius: 'var(--r-xl)', overflow: 'hidden', background: '#0b0d10', aspectRatio: '4 / 3', boxShadow: 'var(--e3)' }}>
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

        {/* 터치 패드 */}
        {input === 'touch' && (
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

            {/* 트랙 아바타 */}
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
