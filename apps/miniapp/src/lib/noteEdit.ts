// 노트 편집 핵심 로직(순수). 녹음된 이벤트(ChordEvent[]) ↔ 편집용 노트(EditNote[]) 변환 + 퀀타이즈.
// UI(NoteEditor.tsx)와 분리해 단위테스트로 정확성 보장. tick 기반(벽시계 ms 금지, DL-019).
import { normalizeEvents, drumKey, type ChordEvent, type DrumPiece } from '../audio/events';

export interface EditNote {
  id: number;
  kind: 'chord' | 'melody' | 'drum';
  value: string; // 코드명 / 음명 / 드럼피스
  start: number; // tick
  dur: number; // tick (드럼은 표시용 고정)
}

/** 녹음 이벤트 → 편집 노트(on/off 페어링, 드럼은 포인트). start 순 정렬. */
export function parseNotes(events: ChordEvent[]): EditNote[] {
  const notes: EditNote[] = [];
  const active = new Map<string, { start: number; kind: 'chord' | 'melody'; value: string }>();
  let id = 0;
  for (const ev of normalizeEvents(events)) {
    if (ev.kind === 'drum') {
      notes.push({ id: id++, kind: 'drum', value: ev.piece, start: ev.tick, dur: 2 });
      continue;
    }
    const value = ev.kind === 'chord' ? ev.chord : ev.note;
    const key = ev.kind + ':' + value;
    if (ev.phase === 'on') {
      active.set(key, { start: ev.tick, kind: ev.kind, value });
    } else {
      const a = active.get(key);
      if (a) {
        notes.push({ id: id++, kind: a.kind, value: a.value, start: a.start, dur: Math.max(1, ev.tick - a.start) });
        active.delete(key);
      }
    }
  }
  // 닫히지 않은 on은 기본 길이로 마감.
  for (const a of active.values()) notes.push({ id: id++, kind: a.kind, value: a.value, start: a.start, dur: 4 });
  return notes.sort((x, y) => x.start - y.start);
}

/** 편집 노트 → 녹음 이벤트. 동일 tick은 off 먼저(겹침 정리). */
export function notesToEvents(notes: EditNote[]): ChordEvent[] {
  const evs: ChordEvent[] = [];
  for (const n of notes) {
    if (n.kind === 'drum') {
      evs.push({ tick: n.start, phase: 'on', chord: drumKey(n.value as DrumPiece), source: 'touch' });
    } else {
      evs.push({ tick: n.start, phase: 'on', chord: n.value, source: 'touch' });
      evs.push({ tick: n.start + Math.max(1, n.dur), phase: 'off', chord: n.value, source: 'touch' });
    }
  }
  return evs.sort((a, b) => a.tick - b.tick || (a.phase === b.phase ? 0 : a.phase === 'off' ? -1 : 1));
}

/** tick을 grid(예: 1/8박)에 스냅. */
export function quantizeTick(tick: number, grid: number): number {
  return Math.max(0, Math.round(tick / grid) * grid);
}

/** 노트 1개 또는 전체를 grid에 퀀타이즈. id=null이면 전체. */
export function quantizeNotes(notes: EditNote[], grid: number, id: number | null): EditNote[] {
  return notes.map((n) => (id === null || n.id === id ? { ...n, start: quantizeTick(n.start, grid) } : n));
}
