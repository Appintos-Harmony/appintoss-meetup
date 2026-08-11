// 이벤트 계약 v2 검증: 28코드 인터벌(tuning 기준)·normalizeEvents 하위호환·드럼 키.
// 순수 모듈만 import(Tone/Web Audio 비의존)이라 vitest에서 바로 실행된다. TASK-20260622-030.
import { describe, it, expect } from 'vitest';
import { normalizeEvents, toNoteEvent, drumKey, wireKey } from './events';
import type { ChordEvent } from './chordReducer';
import { notesFor, noteToMidi } from './tuning';
import { ROOTS, QUALITIES, QUALITY_INTERVALS, buildChordName } from '../components/studio/chords';

describe('28코드: buildChordName이 tuning 기준 정확한 인터벌을 가리킨다', () => {
  it('7루트 × 4종류 = 28코드, 근음 기준 반음 인터벌이 종류와 일치', () => {
    let count = 0;
    for (const root of ROOTS) {
      for (const q of QUALITIES) {
        const name = buildChordName(root, q.key);
        const notes = notesFor(name);
        expect(notes.length).toBeGreaterThanOrEqual(3);
        const root0 = noteToMidi(notes[0]);
        const intervals = Array.from(
          new Set(notes.map((n) => (((noteToMidi(n) - root0) % 12) + 12) % 12)),
        ).sort((a, b) => a - b);
        expect(intervals).toEqual(QUALITY_INTERVALS[q.key]);
        count++;
      }
    }
    expect(count).toBe(28);
  });

  it('대표 코드 이름 매핑(maj는 접미사 없음)', () => {
    expect(buildChordName('C', 'maj')).toBe('C');
    expect(buildChordName('A', 'm')).toBe('Am');
    expect(buildChordName('G', '7')).toBe('G7');
    expect(buildChordName('B', 'm7')).toBe('Bm7');
  });
});

describe('normalizeEvents: 레거시(kind 없음) → 타입드 NoteEvent', () => {
  it('코드 이름은 kind:chord', () => {
    const raw: ChordEvent[] = [{ tick: 0, phase: 'on', chord: 'G7', source: 'touch' }];
    expect(normalizeEvents(raw)).toEqual([{ kind: 'chord', tick: 0, phase: 'on', chord: 'G7', source: 'touch' }]);
  });

  it('코드 이름이 아닌 음명은 kind:melody(note로 이동)', () => {
    const e: ChordEvent = { tick: 4, phase: 'on', chord: 'C4', source: 'touch' };
    expect(toNoteEvent(e)).toEqual({ kind: 'melody', tick: 4, phase: 'on', note: 'C4', source: 'touch' });
  });

  it("'drum:piece'는 kind:drum, phase:hit", () => {
    const e: ChordEvent = { tick: 8, phase: 'on', chord: 'drum:snare', source: 'gesture' };
    expect(toNoteEvent(e)).toEqual({ kind: 'drum', tick: 8, phase: 'hit', piece: 'snare', source: 'gesture' });
  });

  it('빈/누락 입력은 빈 배열', () => {
    expect(normalizeEvents(undefined)).toEqual([]);
    expect(normalizeEvents(null)).toEqual([]);
    expect(normalizeEvents([])).toEqual([]);
  });
});

describe('wireKey / drumKey: NoteEvent ↔ 와이어 chord 필드 왕복', () => {
  it('drumKey와 복원이 일치', () => {
    expect(drumKey('kick')).toBe('drum:kick');
    expect(wireKey({ kind: 'drum', tick: 0, phase: 'hit', piece: 'kick', source: 'touch' })).toBe('drum:kick');
  });
  it('chord/melody의 wireKey', () => {
    expect(wireKey({ kind: 'chord', tick: 0, phase: 'on', chord: 'Am', source: 'touch' })).toBe('Am');
    expect(wireKey({ kind: 'melody', tick: 0, phase: 'on', note: 'E4', source: 'touch' })).toBe('E4');
  });
});
