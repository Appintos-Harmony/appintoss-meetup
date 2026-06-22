import { describe, it, expect } from 'vitest';
import { chordReducer, initialChordState, type ChordState } from './chordReducer';

// 멀티터치 멜로디(폴리포니) 경로 회귀 테스트 (REVIEW-20260622-032 M-3).
// poly=true: 음별 독립 noteOn/noteOff, 코드 경로(activeChord)와 분리.
const down = (s: ChordState, chord: string): ChordState =>
  chordReducer(s, { type: 'down', chord, source: 'touch', tick: 0, nowMs: 0, poly: true });
const up = (s: ChordState, chord: string): ChordState =>
  chordReducer(s, { type: 'up', source: 'touch', tick: 0, nowMs: 0, chord, poly: true });

describe('chordReducer 폴리포니(멀티터치 멜로디)', () => {
  it('여러 음 동시 보유 — 각각 noteOn 가산', () => {
    let s = initialChordState;
    s = down(s, 'C4');
    s = down(s, 'E4');
    s = down(s, 'G4');
    expect(Object.keys(s.activeNotes).sort()).toEqual(['C4', 'E4', 'G4']);
    expect(s.events.filter((e) => e.phase === 'on').length).toBe(3);
  });

  it('같은 음 재입력은 무시(중복 noteOn 없음·동일 참조 반환)', () => {
    let s = initialChordState;
    s = down(s, 'C4');
    const after = down(s, 'C4');
    expect(after).toBe(s);
    expect(after.events.filter((e) => e.phase === 'on' && e.chord === 'C4').length).toBe(1);
  });

  it('한 음만 떼면 그 음만 off, 나머지는 유지', () => {
    let s = initialChordState;
    s = down(s, 'C4');
    s = down(s, 'E4');
    s = up(s, 'C4');
    expect(Object.keys(s.activeNotes)).toEqual(['E4']);
    const offs = s.events.filter((e) => e.phase === 'off');
    expect(offs).toHaveLength(1);
    expect(offs[0].chord).toBe('C4');
  });

  it('누르지 않은 음 up은 무시(no-op·동일 참조)', () => {
    let s = initialChordState;
    s = down(s, 'C4');
    const after = up(s, 'G4');
    expect(after).toBe(s);
  });

  it('폴리(멜로디)는 코드 활성상태(activeChord)와 독립', () => {
    let s = initialChordState;
    s = down(s, 'C4');
    expect(s.activeChord).toBeNull();
    expect(s.activeSource).toBeNull();
  });

  it('보유한 모든 음을 떼면 activeNotes 비고 on/off 균형', () => {
    let s = initialChordState;
    s = down(s, 'C4');
    s = down(s, 'E4');
    s = up(s, 'E4');
    s = up(s, 'C4');
    expect(Object.keys(s.activeNotes)).toHaveLength(0);
    expect(s.events.filter((e) => e.phase === 'on').length).toBe(2);
    expect(s.events.filter((e) => e.phase === 'off').length).toBe(2);
  });
});
