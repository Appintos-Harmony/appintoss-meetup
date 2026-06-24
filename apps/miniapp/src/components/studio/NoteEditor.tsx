// 음 편집 페이지(가라지밴드풍 피아노롤). 녹음된 take를 박자 그리드 위 블록으로 보고,
// 노트를 드래그로 이동(시간)·세로 이동(멜로디=음정)·오른쪽 끝 드래그로 길이 조절, 버튼으로 미세조정/퀀타이즈/삭제.
// 재생: 빨간 재생위치선(드래그로 스크럽) · 실행(현재 위치부터) · 정지(위치 유지) · 다시듣기(처음부터).
// 핵심 변환(파싱·직렬화·퀀타이즈)은 lib/noteEdit(순수·테스트).
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { parseNotes, notesToEvents, quantizeNotes, type EditNote } from '../../lib/noteEdit';
import type { ChordEvent } from '../../audio/events';
import { normalizeEvents } from '../../audio/events';
import { noteToMidi } from '../../audio/tuning';
import { transpose, solfa, midiToName } from '../../lib/notes';
import { DRUM_PIECES } from './chords';
import { TICKS_PER_BEAT, BEATS_PER_BAR, tickToMs, msToTick } from '../../audio/transport';
import { unlockAudio, createVoice, type Voice } from '../../audio/engine';

const GRID = TICKS_PER_BEAT / 2; // 1/8박 스냅
const PX = 12; // tick당 px
const LANE_H = 34;
const TPB = TICKS_PER_BEAT;
const BAR = BEATS_PER_BAR * TPB;
const LABEL_W = 54;

// 편집 화면 전용 색(앱 전체보다 한 단계 진한 톤 — 대비↑, 음악앱 부드러움 유지).
const C_BG = '#d7dde6'; // 화면 배경
const C_PANEL = '#eceff4'; // 편집 영역
const C_LABEL = '#dfe4ec'; // 레인 라벨 열
const C_BAR = '#aeb8c6'; // 마디선
const C_BEAT = '#c7cfda'; // 박선
const C_HEAD = '#ff3b30'; // 재생 위치선(빨강 고정)

const drumLabel = (p: string) => DRUM_PIECES.find((d) => d.key === p)?.label ?? p;
const drumColor = (p: string) => DRUM_PIECES.find((d) => d.key === p)?.color ?? '#888';
const drumOrder = (p: string) => {
  const i = DRUM_PIECES.findIndex((d) => d.key === p);
  return i < 0 ? 99 : i;
};
const laneKeyOf = (n: EditNote) => `${n.kind}:${n.value}`;
const rank = (kind: EditNote['kind']) => (kind === 'melody' ? 0 : kind === 'chord' ? 1 : 2);
const colorOf = (n: EditNote) => (n.kind === 'drum' ? drumColor(n.value) : n.kind === 'chord' ? '#8b5cf6' : '#3182f6');

export function NoteEditor({ events, onApply, onClose }: { events: ChordEvent[]; onApply: (events: ChordEvent[]) => void; onClose: () => void }) {
  const [notes, setNotes] = useState<EditNote[]>(() => parseNotes(events));
  const [sel, setSel] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadTick, setPlayheadTick] = useState(0); // 재생 위치(틱). currentTime/playheadPosition의 단일 소스.
  const [isDragging, setIsDragging] = useState(false);

  const voicesRef = useRef<Voice[]>([]);
  const timersRef = useRef<number[]>([]);
  const rafRef = useRef(0);
  const startPerfRef = useRef(0); // 재생 시작 시각(performance.now)
  const startTickRef = useRef(0); // 재생 시작 위치(틱)
  const headDragRef = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: number; mode: 'move' | 'resize'; x0: number; y0: number; start0: number; dur0: number; midi0: number } | null>(null);

  useEffect(
    () => () => {
      stopAudio();
      stopRaf();
    },
    [],
  );

  // 멜로디만 있는 take면 연속 반음 피아노롤(세로 드래그로 음정), 아니면 값별 이산 레인.
  const melodyOnly = notes.length > 0 && notes.every((n) => n.kind === 'melody');
  const { lo, hi } = useMemo(() => {
    const ms = notes.filter((n) => n.kind === 'melody').map((n) => noteToMidi(n.value));
    if (!ms.length) return { lo: 60, hi: 72 };
    return { lo: Math.min(...ms) - 2, hi: Math.max(...ms) + 2 };
  }, [notes]);

  const lanes = useMemo(() => {
    const reps = new Map<string, EditNote>();
    for (const n of notes) if (!reps.has(laneKeyOf(n))) reps.set(laneKeyOf(n), n);
    return Array.from(reps.values())
      .sort((a, b) => {
        if (rank(a.kind) !== rank(b.kind)) return rank(a.kind) - rank(b.kind);
        if (a.kind === 'melody') return noteToMidi(b.value) - noteToMidi(a.value);
        if (a.kind === 'drum') return drumOrder(a.value) - drumOrder(b.value);
        return a.value.localeCompare(b.value);
      })
      .map(laneKeyOf);
  }, [notes]);

  const rowCount = melodyOnly ? hi - lo + 1 : Math.max(1, lanes.length);
  const rowOf = (n: EditNote) => (melodyOnly ? hi - noteToMidi(n.value) : lanes.indexOf(laneKeyOf(n)));
  const rowLabel = (i: number) => {
    if (melodyOnly) return solfa(midiToName(hi - i));
    const key = lanes[i] ?? '';
    const c = key.indexOf(':');
    const kind = key.slice(0, c);
    const value = key.slice(c + 1);
    return kind === 'melody' ? solfa(value) : kind === 'drum' ? drumLabel(value) : value;
  };

  const maxTick = notes.reduce((m, n) => Math.max(m, n.start + n.dur), 0);
  const totalTicks = Math.max(maxTick + TPB, BAR * 4);
  const width = totalTicks * PX;
  const height = rowCount * LANE_H;
  const selNote = notes.find((n) => n.id === sel) ?? null;
  const beatLabel = (t: number) => `${Math.floor(t / BAR) + 1}.${Math.floor((t % BAR) / TPB) + 1}`;

  // ---- 재생 트랜스포트 ----
  function stopAudio() {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
    voicesRef.current.forEach((v) => v.dispose());
    voicesRef.current = [];
  }
  function stopRaf() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  }

  // 정지: 오디오 즉시 멈춤, 빨간 선은 현재 위치에 유지(처음으로 안 돌아감).
  function pause() {
    stopAudio();
    stopRaf();
    setIsPlaying(false);
  }

  async function playFrom(fromTick: number) {
    stopAudio();
    stopRaf();
    await unlockAudio();
    const cv = createVoice('piano', 'grand');
    const dv = createVoice('drum', 'analog');
    voicesRef.current = [cv, dv];
    const fromMs = tickToMs(fromTick);
    for (const ev of normalizeEvents(notesToEvents(notes))) {
      const ms = tickToMs(ev.tick);
      if (ms < fromMs - 1) continue; // 이미 지난 구간은 스킵(현재 위치부터)
      const id = window.setTimeout(() => {
        if (ev.kind === 'drum') dv.hit(ev.piece);
        else if (ev.kind === 'melody') {
          if (ev.phase === 'on') cv.on(ev.note);
          else cv.off(ev.note);
        } else {
          if (ev.phase === 'on') cv.on(ev.chord);
          else cv.off(ev.chord);
        }
      }, Math.max(0, ms - fromMs));
      timersRef.current.push(id);
    }
    startTickRef.current = fromTick;
    startPerfRef.current = performance.now();
    setIsPlaying(true);
    const endTick = Math.max(maxTick, fromTick + 1);
    const loop = () => {
      const t = startTickRef.current + msToTick(performance.now() - startPerfRef.current);
      if (t >= endTick) {
        setPlayheadTick(endTick); // 끝에서 멈춤(자동 복귀 X)
        stopAudio();
        stopRaf();
        setIsPlaying(false);
        return;
      }
      setPlayheadTick(t);
      const sc = scrollRef.current;
      if (sc) {
        const headX = LABEL_W + t * PX;
        if (headX - sc.scrollLeft > sc.clientWidth - 60) sc.scrollLeft = headX - sc.clientWidth + 140;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }

  // 실행: 현재 빨간 선 위치부터(끝까지 갔으면 처음부터).
  function play() {
    const from = playheadTick >= maxTick ? 0 : playheadTick;
    if (from === 0) setPlayheadTick(0);
    void playFrom(from);
  }
  // 다시듣기: 처음으로 되돌리고 바로 재생.
  function restart() {
    setPlayheadTick(0);
    void playFrom(0);
  }

  // ---- 빨간 선 드래그(스크럽) ----
  function tickFromClientX(clientX: number): number {
    const g = gridRef.current;
    if (!g) return playheadTick;
    const x = clientX - g.getBoundingClientRect().left;
    return Math.max(0, Math.min(totalTicks, x / PX));
  }
  function onHeadDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    if (isPlaying) pause(); // 드래그 중엔 재생 멈추고 위치만 이동
    headDragRef.current = true;
    setIsDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 캡처 미지원 무시 */
    }
    setPlayheadTick(tickFromClientX(e.clientX));
  }
  function onHeadMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!headDragRef.current) return;
    setPlayheadTick(tickFromClientX(e.clientX));
  }
  function onHeadUp(e: ReactPointerEvent<HTMLDivElement>) {
    headDragRef.current = false;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* 무시 */
    }
  }

  // ---- 노트 드래그(이동·길이) ----
  function onNoteDown(e: ReactPointerEvent<HTMLButtonElement>, n: EditNote) {
    setSel(n.id);
    const rect = e.currentTarget.getBoundingClientRect();
    const onRightEdge = n.kind !== 'drum' && rect.right - e.clientX < 18;
    dragRef.current = { id: n.id, mode: onRightEdge ? 'resize' : 'move', x0: e.clientX, y0: e.clientY, start0: n.start, dur0: n.dur, midi0: n.kind === 'melody' ? noteToMidi(n.value) : 0 };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 캡처 미지원 무시 */
    }
  }
  function onNoteMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const d = dragRef.current;
    if (!d) return;
    const dxTicks = Math.round((e.clientX - d.x0) / PX);
    if (d.mode === 'resize') {
      setNotes((ns) => ns.map((n) => (n.id === d.id ? { ...n, dur: Math.max(1, d.dur0 + dxTicks) } : n)));
      return;
    }
    const dyRows = melodyOnly ? Math.round((e.clientY - d.y0) / LANE_H) : 0;
    setNotes((ns) =>
      ns.map((n) => {
        if (n.id !== d.id) return n;
        const start = Math.max(0, d.start0 + dxTicks);
        if (n.kind === 'melody' && melodyOnly && dyRows !== 0) {
          const newMidi = Math.min(hi, Math.max(lo, d.midi0 - dyRows));
          return { ...n, start, value: midiToName(newMidi) };
        }
        return { ...n, start };
      }),
    );
  }
  function onNoteUp(e: ReactPointerEvent<HTMLButtonElement>) {
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* 무시 */
    }
  }

  const move = (dd: number) => sel !== null && setNotes((ns) => ns.map((n) => (n.id === sel ? { ...n, start: Math.max(0, n.start + dd) } : n)));
  const tr = (dd: number) => sel !== null && setNotes((ns) => ns.map((n) => (n.id === sel && n.kind === 'melody' ? { ...n, value: transpose(n.value, dd) } : n)));
  const del = () => {
    if (sel === null) return;
    setNotes((ns) => ns.filter((n) => n.id !== sel));
    setSel(null);
  };

  const tbtn = (bg = 'var(--surface)', color = 'var(--text)'): CSSProperties => ({ flex: 'none', minWidth: 42, padding: '10px 12px', borderRadius: 10, border: 0, background: bg, color, fontWeight: 800, fontSize: 14, boxShadow: 'var(--e1)', cursor: 'pointer' });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: C_BG, display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
        <div className="t-title" style={{ flex: 1 }}>음 편집</div>
        <button className="chip chip-ghost" onClick={() => { pause(); onClose(); }}>취소</button>
        <button className="chip" onClick={() => { pause(); onApply(notesToEvents(notes)); }}>적용</button>
      </div>

      {notes.length === 0 ? (
        <div className="t-cap c-sub" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
          편집할 노트가 없어요. 먼저 녹음해 주세요.
        </div>
      ) : (
        <>
          <div className="t-cap" style={{ textAlign: 'center', padding: '0 16px 6px', color: 'var(--text-2)' }}>
            블록을 끌어 위치 이동{melodyOnly ? '(세로=음정)' : ''} · 빨간 선을 끌어 재생 위치 조절
          </div>
          <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', background: C_PANEL, margin: '0 12px', borderRadius: 'var(--r-md)', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.05), var(--e2)' }}>
            <div style={{ display: 'flex' }}>
              <div style={{ position: 'sticky', left: 0, zIndex: 3, background: C_LABEL, flex: 'none' }}>
                {Array.from({ length: rowCount }).map((_, i) => (
                  <div key={i} style={{ height: LANE_H, width: LABEL_W, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: 'var(--text)', borderBottom: `1px solid ${C_BEAT}` }}>
                    {rowLabel(i)}
                  </div>
                ))}
              </div>
              <div ref={gridRef} style={{ position: 'relative', width, height, flex: 'none' }}>
                {Array.from({ length: Math.ceil(totalTicks / TPB) + 1 }).map((_, i) => {
                  const t = i * TPB;
                  const isBar = t % BAR === 0;
                  return <div key={i} style={{ position: 'absolute', left: t * PX, top: 0, bottom: 0, width: isBar ? 2 : 1, background: isBar ? C_BAR : C_BEAT }} />;
                })}
                {Array.from({ length: rowCount }).map((_, i) => (
                  <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: i * LANE_H, height: LANE_H, borderBottom: `1px solid ${C_BEAT}` }} />
                ))}
                {notes.map((n) => {
                  const r = rowOf(n);
                  if (r < 0) return null;
                  const w = n.kind === 'drum' ? Math.max(GRID * PX, 14) : Math.max(n.dur * PX, 12);
                  const noteEnd = n.start + (n.kind === 'drum' ? GRID : Math.max(n.dur, 1));
                  const active = isPlaying && playheadTick >= n.start && playheadTick < noteEnd; // 플레이헤드가 지나는 중
                  return (
                    <button
                      key={n.id}
                      onPointerDown={(e) => onNoteDown(e, n)}
                      onPointerMove={onNoteMove}
                      onPointerUp={onNoteUp}
                      onPointerCancel={onNoteUp}
                      style={{
                        position: 'absolute',
                        left: n.start * PX,
                        top: r * LANE_H + 4,
                        width: w,
                        height: LANE_H - 8,
                        borderRadius: 6,
                        border: 0,
                        background: colorOf(n),
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 800,
                        boxShadow: active ? `0 0 12px ${colorOf(n)}` : sel === n.id ? '0 0 0 2.5px var(--text)' : 'var(--e1)',
                        opacity: sel === null || sel === n.id ? 1 : 0.72,
                        padding: 0,
                        cursor: 'grab',
                        touchAction: 'none',
                        borderRight: n.kind !== 'drum' ? '3px solid rgba(255,255,255,.55)' : 0,
                        filter: active ? 'brightness(1.4)' : 'none',
                        transform: active ? 'scaleY(1.14)' : 'none',
                        transition: 'filter .08s, transform .08s, box-shadow .08s',
                      }}
                    >
                      {n.kind === 'drum' ? '●' : ''}
                    </button>
                  );
                })}
                {/* 재생 위치선(빨강) — 전체 높이 그랩(드래그로 스크럽) */}
                <div
                  onPointerDown={onHeadDown}
                  onPointerMove={onHeadMove}
                  onPointerUp={onHeadUp}
                  onPointerCancel={onHeadUp}
                  style={{ position: 'absolute', left: playheadTick * PX - 10, top: 0, width: 20, height, zIndex: 6, cursor: 'ew-resize', touchAction: 'none' }}
                >
                  <div style={{ position: 'absolute', left: 8.75, top: 0, width: isDragging ? 3 : 2.5, height: '100%', background: C_HEAD, boxShadow: `0 0 ${isDragging ? 12 : 8}px ${C_HEAD}99` }} />
                  <div style={{ position: 'absolute', left: 1, top: 0, width: 18, height: 18, borderRadius: '4px 4px 9px 9px', background: C_HEAD, boxShadow: isDragging ? '0 0 0 5px rgba(255,59,48,.22), 0 2px 6px rgba(0,0,0,.35)' : '0 2px 5px rgba(0,0,0,.3)', transform: isDragging ? 'scale(1.12)' : 'none', transition: 'transform .1s', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 800 }}>⇆</div>
                </div>
              </div>
            </div>
          </div>

          <div className="t-cap" style={{ textAlign: 'center', padding: '8px 0 2px', color: 'var(--text-2)' }}>
            {selNote
              ? `선택: ${selNote.kind === 'drum' ? drumLabel(selNote.value) : selNote.kind === 'melody' ? `${solfa(selNote.value)}(${selNote.value})` : selNote.value} · ${beatLabel(selNote.start)}박`
              : `재생 위치 ${beatLabel(Math.round(playheadTick))}박${isPlaying ? ' · 재생 중' : ''}`}
          </div>

          <div style={{ display: 'flex', gap: 6, padding: '6px 12px', overflowX: 'auto' }}>
            <button style={tbtn()} disabled={!selNote} onClick={() => move(-GRID)}>◀</button>
            <button style={tbtn()} disabled={!selNote} onClick={() => move(GRID)}>▶</button>
            <button style={tbtn()} disabled={!selNote || selNote.kind !== 'melody'} onClick={() => tr(1)}>▲음</button>
            <button style={tbtn()} disabled={!selNote || selNote.kind !== 'melody'} onClick={() => tr(-1)}>▼음</button>
            <button style={tbtn()} disabled={!selNote} onClick={() => setNotes((ns) => quantizeNotes(ns, GRID, sel))}>⏱맞춤</button>
            <button style={tbtn('var(--coral)', '#fff')} disabled={!selNote} onClick={del}>🗑</button>
          </div>
          <div style={{ display: 'flex', gap: 8, padding: '4px 12px calc(12px + env(safe-area-inset-bottom))' }}>
            <button className="btn" style={{ flex: 1, minWidth: 0, fontSize: 14, padding: '12px 6px', background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--e2)' }} onClick={() => setNotes((ns) => quantizeNotes(ns, GRID, null))}>전체 맞춤</button>
            <button className="btn" style={{ flex: 1, minWidth: 0, fontSize: 14, padding: '12px 6px', background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--e2)' }} onClick={restart}>↺ 다시듣기</button>
            <button className="btn" style={{ flex: 1.2, minWidth: 0, fontSize: 14, padding: '12px 6px', background: isPlaying ? 'var(--coral)' : 'var(--blue)', color: '#fff' }} onClick={() => (isPlaying ? pause() : play())}>
              {isPlaying ? '■ 정지' : '▶ 실행'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
