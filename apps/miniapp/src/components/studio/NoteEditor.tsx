// 음 편집 페이지(가라지밴드풍 피아노롤). 녹음된 take를 박자 그리드 위 블록으로 보고,
// 노트를 드래그로 이동(시간)·세로 이동(멜로디=음정)·오른쪽 끝 드래그로 길이 조절, 버튼으로 미세조정/퀀타이즈/삭제.
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
  const [playing, setPlaying] = useState(false);
  const voicesRef = useRef<Voice[]>([]);
  const timersRef = useRef<number[]>([]);
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const [playTick, setPlayTick] = useState(0); // 재생 플레이헤드 위치(틱)
  const dragRef = useRef<{ id: number; mode: 'move' | 'resize'; x0: number; y0: number; start0: number; dur0: number; midi0: number } | null>(null);

  useEffect(() => () => stopPreview(), []);

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

  function stopPreview() {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
    voicesRef.current.forEach((v) => v.dispose());
    voicesRef.current = [];
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    setPlayTick(0);
    setPlaying(false);
  }

  async function preview() {
    if (playing) {
      stopPreview();
      return;
    }
    stopPreview();
    await unlockAudio();
    const cv = createVoice('piano', 'grand');
    const dv = createVoice('drum', 'analog');
    voicesRef.current = [cv, dv];
    let maxMs = 0;
    for (const ev of normalizeEvents(notesToEvents(notes))) {
      const ms = tickToMs(ev.tick);
      if (ms > maxMs) maxMs = ms;
      const id = window.setTimeout(() => {
        if (ev.kind === 'drum') dv.hit(ev.piece);
        else if (ev.kind === 'melody') {
          if (ev.phase === 'on') cv.on(ev.note);
          else cv.off(ev.note);
        } else {
          if (ev.phase === 'on') cv.on(ev.chord);
          else cv.off(ev.chord);
        }
      }, ms);
      timersRef.current.push(id);
    }
    timersRef.current.push(window.setTimeout(() => stopPreview(), maxMs + 800));
    setPlaying(true);
    // 플레이헤드: 경과 시간 → 틱으로 변환해 선을 움직임(노트 위를 지날 때 색 변화).
    startRef.current = performance.now();
    const tickLoop = () => {
      setPlayTick(msToTick(performance.now() - startRef.current));
      rafRef.current = requestAnimationFrame(tickLoop);
    };
    rafRef.current = requestAnimationFrame(tickLoop);
  }

  // ---- 드래그 ----
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
        <div className="t-title" style={{ flex: 1 }}>음 편집</div>
        <button className="chip chip-ghost" onClick={() => { stopPreview(); onClose(); }}>취소</button>
        <button className="chip" onClick={() => { stopPreview(); onApply(notesToEvents(notes)); }}>적용</button>
      </div>

      {notes.length === 0 ? (
        <div className="t-cap c-sub" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
          편집할 노트가 없어요. 먼저 녹음해 주세요.
        </div>
      ) : (
        <>
          <div className="t-cap c-sub" style={{ textAlign: 'center', padding: '0 16px 6px' }}>
            블록을 끌어 위치 이동{melodyOnly ? '(세로=음정)' : ''}, 오른쪽 끝을 끌어 길이 조절
          </div>
          <div style={{ flex: 1, overflow: 'auto', background: 'var(--surface)', margin: '0 12px', borderRadius: 'var(--r-md)', boxShadow: 'var(--e1)' }}>
            <div style={{ display: 'flex' }}>
              <div style={{ position: 'sticky', left: 0, zIndex: 2, background: 'var(--surface-2)', flex: 'none' }}>
                {Array.from({ length: rowCount }).map((_, i) => (
                  <div key={i} style={{ height: LANE_H, width: 54, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: 'var(--text-2)', borderBottom: '1px solid var(--line)' }}>
                    {rowLabel(i)}
                  </div>
                ))}
              </div>
              <div style={{ position: 'relative', width, height, flex: 'none' }}>
                {playing && (
                  <div style={{ position: 'absolute', left: playTick * PX, top: 0, height, width: 2.5, background: 'var(--coral)', boxShadow: '0 0 8px var(--coral)', zIndex: 4, pointerEvents: 'none' }} />
                )}
                {Array.from({ length: Math.ceil(totalTicks / TPB) + 1 }).map((_, i) => {
                  const t = i * TPB;
                  const isBar = t % BAR === 0;
                  return <div key={i} style={{ position: 'absolute', left: t * PX, top: 0, bottom: 0, width: isBar ? 2 : 1, background: isBar ? 'var(--line-2)' : 'var(--line)' }} />;
                })}
                {Array.from({ length: rowCount }).map((_, i) => (
                  <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: i * LANE_H, height: LANE_H, borderBottom: '1px solid var(--line)' }} />
                ))}
                {notes.map((n) => {
                  const r = rowOf(n);
                  if (r < 0) return null;
                  const w = n.kind === 'drum' ? Math.max(GRID * PX, 14) : Math.max(n.dur * PX, 12);
                  const noteEnd = n.start + (n.kind === 'drum' ? GRID : Math.max(n.dur, 1));
                  const active = playing && playTick >= n.start && playTick < noteEnd; // 플레이헤드가 지나는 중
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
                        opacity: sel === null || sel === n.id ? 1 : 0.7,
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
              </div>
            </div>
          </div>

          <div className="t-cap c-sub" style={{ textAlign: 'center', padding: '8px 0 2px' }}>
            {selNote ? `선택: ${selNote.kind === 'drum' ? drumLabel(selNote.value) : selNote.kind === 'melody' ? `${solfa(selNote.value)}(${selNote.value})` : selNote.value} · ${beatLabel(selNote.start)}박` : '노트를 탭하거나 끌어서 편집'}
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
            <button className="btn" style={{ flex: 1, background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--e2)' }} onClick={() => setNotes((ns) => quantizeNotes(ns, GRID, null))}>전체 박자 맞춤</button>
            <button className="btn" style={{ flex: 1, background: playing ? 'var(--coral)' : 'var(--blue)' }} onClick={() => void preview()}>{playing ? '■ 정지' : '▶ 미리듣기'}</button>
          </div>
        </>
      )}
    </div>
  );
}
