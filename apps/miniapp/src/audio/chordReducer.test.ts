import { describe, it, expect } from 'vitest';
import { chordReducer, initialChordState, type ChordState, type ChordAction } from './chordReducer';

function run(actions: ChordAction[], start: ChordState = initialChordState): ChordState {
  return actions.reduce(chordReducer, start);
}

describe('chordReducer', () => {
  it('기록: 첫 down은 noteOn 1개', () => {
    const s = run([{ type: 'down', chord: 'C', source: 'touch', tick: 0, nowMs: 0 }]);
    expect(s.events).toEqual([{ tick: 0, phase: 'on', chord: 'C', source: 'touch' }]);
    expect(s.activeChord).toBe('C');
  });

  it('같은 코드 down 중복은 noteOn 추가 안 함', () => {
    const s = run([
      { type: 'down', chord: 'C', source: 'touch', tick: 0, nowMs: 0 },
      { type: 'down', chord: 'C', source: 'touch', tick: 5, nowMs: 50 },
    ]);
    expect(s.events.filter((e) => e.phase === 'on')).toHaveLength(1);
  });

  it('다른 코드로 전환 시 이전 off + 새 on', () => {
    const s = run([
      { type: 'down', chord: 'C', source: 'touch', tick: 0, nowMs: 0 },
      { type: 'down', chord: 'G', source: 'touch', tick: 8, nowMs: 80 },
    ]);
    expect(s.events).toEqual([
      { tick: 0, phase: 'on', chord: 'C', source: 'touch' },
      { tick: 8, phase: 'off', chord: 'C', source: 'touch' },
      { tick: 8, phase: 'on', chord: 'G', source: 'touch' },
    ]);
    expect(s.activeChord).toBe('G');
  });

  it('up은 활성 코드에 대해 noteOff 1개, activeChord=null', () => {
    const s = run([
      { type: 'down', chord: 'C', source: 'touch', tick: 0, nowMs: 0 },
      { type: 'up', source: 'touch', tick: 10, nowMs: 100 },
    ]);
    expect(s.events.at(-1)).toEqual({ tick: 10, phase: 'off', chord: 'C', source: 'touch' });
    expect(s.activeChord).toBeNull();
  });

  it('터치 연주 중 gesture down은 무시', () => {
    const s = run([
      { type: 'down', chord: 'C', source: 'touch', tick: 0, nowMs: 0 },
      { type: 'down', chord: 'G', source: 'gesture', tick: 4, nowMs: 40 },
    ]);
    expect(s.activeChord).toBe('C');
    expect(s.events.filter((e) => e.source === 'gesture')).toHaveLength(0);
  });

  it('터치 종료 후 200ms 이내 gesture는 무시, 이후는 허용', () => {
    const base = run([
      { type: 'down', chord: 'C', source: 'touch', tick: 0, nowMs: 1000 },
      { type: 'up', source: 'touch', tick: 5, nowMs: 1050 },
    ]);
    const tooSoon = chordReducer(base, { type: 'down', chord: 'G', source: 'gesture', tick: 8, nowMs: 1200 }); // +150ms
    expect(tooSoon.activeChord).toBeNull();
    const ok = chordReducer(base, { type: 'down', chord: 'G', source: 'gesture', tick: 9, nowMs: 1300 }); // +250ms
    expect(ok.activeChord).toBe('G');
    expect(ok.activeSource).toBe('gesture');
  });

  it('비활성 소스의 up은 활성 코드를 끄지 않음', () => {
    const s = run([
      { type: 'down', chord: 'C', source: 'touch', tick: 0, nowMs: 0 },
      { type: 'up', source: 'gesture', tick: 3, nowMs: 30 },
    ]);
    expect(s.activeChord).toBe('C');
  });
});
