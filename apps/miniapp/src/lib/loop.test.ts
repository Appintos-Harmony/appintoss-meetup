import { describe, it, expect } from 'vitest';
import { loopEvents } from './loop';
import type { ChordEvent } from '../audio/chordReducer';

const on = (tick: number, chord: string): ChordEvent => ({ tick, phase: 'on', chord, source: 'touch' });
const off = (tick: number, chord: string): ChordEvent => ({ tick, phase: 'off', chord, source: 'touch' });

describe('loopEvents (구간 반복 타일링)', () => {
  it('한 마디(16틱) 패턴을 4회로 이어붙임: 틱이 16씩 오프셋', () => {
    const base = [on(0, 'C'), off(8, 'C')];
    const out = loopEvents(base, 16, 4);
    expect(out).toHaveLength(8); // 2 이벤트 × 4
    expect(out.map((e) => e.tick)).toEqual([0, 8, 16, 24, 32, 40, 48, 56]);
    expect(out.filter((e) => e.phase === 'on')).toHaveLength(4);
  });

  it('loopTicks 밖 이벤트는 단위에서 제외', () => {
    const base = [on(0, 'C'), off(8, 'C'), on(20, 'G'), off(28, 'G')]; // G는 16틱 밖
    const out = loopEvents(base, 16, 2);
    expect(out.every((e) => e.chord === 'C')).toBe(true);
    expect(out).toHaveLength(4);
  });

  it('경계를 넘어 열린 코드는 루프 끝에서 off로 닫음(hanging 방지)', () => {
    const base = [on(0, 'C')]; // off가 16틱 안에 없음
    const out = loopEvents(base, 16, 2);
    // 각 루프마다 on + 경계 off(15, 31)
    expect(out.filter((e) => e.phase === 'off')).toHaveLength(2);
    expect(out.find((e) => e.tick === 15 && e.phase === 'off')).toBeTruthy();
    expect(out.find((e) => e.tick === 31 && e.phase === 'off')).toBeTruthy();
  });

  it('드럼 원샷(drum:*)은 off로 닫지 않고 그대로 복제', () => {
    const base: ChordEvent[] = [{ tick: 0, phase: 'on', chord: 'drum:kick', source: 'touch' }];
    const out = loopEvents(base, 16, 3);
    expect(out).toHaveLength(3); // off 추가 없음
    expect(out.every((e) => e.phase === 'on' && e.chord === 'drum:kick')).toBe(true);
    expect(out.map((e) => e.tick)).toEqual([0, 16, 32]);
  });

  it('count=1은 단위 1개(경계 off 포함)만 반환', () => {
    const base = [on(0, 'C'), off(8, 'C')];
    expect(loopEvents(base, 16, 1)).toHaveLength(2);
  });

  it('loopTicks<=0 또는 count<=0은 원본 복사 반환', () => {
    const base = [on(0, 'C')];
    expect(loopEvents(base, 0, 4)).toHaveLength(1);
    expect(loopEvents(base, 16, 0)).toHaveLength(1);
  });
});
