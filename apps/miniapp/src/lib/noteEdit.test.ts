// 노트 편집 로직 검증 — 파싱↔직렬화 왕복, 드럼 포인트, 퀀타이즈. TASK-030 음 편집 페이지.
import { describe, it, expect } from 'vitest';
import { parseNotes, notesToEvents, quantizeTick, quantizeNotes } from './noteEdit';
import type { ChordEvent } from '../audio/events';

describe('noteEdit — 파싱', () => {
  it('코드 on/off를 노트(시작·길이)로 페어링', () => {
    const ev: ChordEvent[] = [
      { tick: 0, phase: 'on', chord: 'C', source: 'touch' },
      { tick: 16, phase: 'off', chord: 'C', source: 'touch' },
      { tick: 16, phase: 'on', chord: 'G', source: 'touch' },
      { tick: 32, phase: 'off', chord: 'G', source: 'touch' },
    ];
    const notes = parseNotes(ev);
    expect(notes).toHaveLength(2);
    expect(notes[0]).toMatchObject({ kind: 'chord', value: 'C', start: 0, dur: 16 });
    expect(notes[1]).toMatchObject({ kind: 'chord', value: 'G', start: 16, dur: 16 });
  });

  it('멜로디 단음과 드럼 포인트', () => {
    const ev: ChordEvent[] = [
      { tick: 0, phase: 'on', chord: 'C4', source: 'touch' },
      { tick: 4, phase: 'off', chord: 'C4', source: 'touch' },
      { tick: 8, phase: 'on', chord: 'drum:snare', source: 'gesture' },
    ];
    const notes = parseNotes(ev);
    expect(notes[0]).toMatchObject({ kind: 'melody', value: 'C4', start: 0, dur: 4 });
    expect(notes[1]).toMatchObject({ kind: 'drum', value: 'snare', start: 8 });
  });
});

describe('noteEdit — 왕복(parse→serialize)', () => {
  it('코드 시퀀스 왕복 보존', () => {
    const ev: ChordEvent[] = [
      { tick: 0, phase: 'on', chord: 'C', source: 'touch' },
      { tick: 16, phase: 'off', chord: 'C', source: 'touch' },
      { tick: 16, phase: 'on', chord: 'G', source: 'touch' },
      { tick: 32, phase: 'off', chord: 'G', source: 'touch' },
    ];
    expect(notesToEvents(parseNotes(ev))).toEqual(ev);
  });

  it('드럼 왕복', () => {
    const ev: ChordEvent[] = [
      { tick: 0, phase: 'on', chord: 'drum:kick', source: 'touch' },
      { tick: 8, phase: 'on', chord: 'drum:snare', source: 'touch' },
    ];
    expect(notesToEvents(parseNotes(ev))).toEqual(ev);
  });
});

describe('noteEdit — 퀀타이즈', () => {
  it('가장 가까운 grid로 스냅', () => {
    expect(quantizeTick(5, 2)).toBe(6); // 5→6 (1/8=2)
    expect(quantizeTick(3, 4)).toBe(4); // 3→4 (1박=4)
    expect(quantizeTick(1, 4)).toBe(0);
  });

  it('전체 퀀타이즈는 모든 노트 start 스냅', () => {
    const notes = [
      { id: 0, kind: 'chord' as const, value: 'C', start: 1, dur: 16 },
      { id: 1, kind: 'chord' as const, value: 'G', start: 15, dur: 16 },
    ];
    const q = quantizeNotes(notes, 4, null);
    expect(q[0].start).toBe(0);
    expect(q[1].start).toBe(16);
  });
});
