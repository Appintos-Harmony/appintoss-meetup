// 음정 정확도 검증 — 코드가 요구하는 음이 평균율(A4=440) 기준 정확한 주파수로 나오는지.
// 순수 모듈이라 Web Audio 없이 vitest에서 실행된다. TASK-20260622-029.
import { describe, it, expect } from 'vitest';
import { A4_HZ, noteToMidi, noteToFreq, notesFor, chordToFreqs, chordVoicing } from './tuning';

// 두 주파수의 음정 차이를 cent로(1200 cent = 1 옥타브). 음정 정확도 판정 단위.
function cents(freq: number, ref: number): number {
  return 1200 * Math.log2(freq / ref);
}
function expectInTune(note: string, refHz: number, maxCents = 1): void {
  expect(Math.abs(cents(noteToFreq(note), refHz))).toBeLessThan(maxCents);
}

describe('tuning — 음이름 → MIDI', () => {
  it('가온다 C4 = 60, A4 = 69, 옥타브 경계', () => {
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('C5')).toBe(72);
    expect(noteToMidi('A0')).toBe(21);
    expect(noteToMidi('C8')).toBe(108);
  });
  it('이명동음은 동일(A#4 = Bb4, Eb4 = D#4)', () => {
    expect(noteToMidi('A#4')).toBe(noteToMidi('Bb4'));
    expect(noteToMidi('Eb4')).toBe(noteToMidi('D#4'));
  });
  it('잘못된 음이름은 throw', () => {
    expect(() => noteToMidi('H4')).toThrow();
    expect(() => noteToMidi('C')).toThrow();
    expect(() => noteToMidi('')).toThrow();
  });
});

describe('tuning — 음이름 → 주파수 (평균율 A4=440)', () => {
  it('기준 A4 = 정확히 440 Hz', () => {
    expect(noteToFreq('A4')).toBe(A4_HZ);
    expect(noteToFreq('A4')).toBe(440);
  });
  it('표준 음들이 ±1 cent 이내', () => {
    expectInTune('C4', 261.6256);
    expectInTune('E4', 329.6276);
    expectInTune('G4', 391.9954);
    expectInTune('C5', 523.2511);
    expectInTune('A3', 220);
    expectInTune('A5', 880);
    expectInTune('F3', 174.6141);
    expectInTune('B3', 246.9417);
    expectInTune('C8', 4186.009);
  });
  it('한 옥타브 = 정확히 2배', () => {
    expect(noteToFreq('A5') / noteToFreq('A4')).toBeCloseTo(2, 10);
    expect(noteToFreq('C5') / noteToFreq('C4')).toBeCloseTo(2, 10);
  });
});

describe('tuning — 코드가 요구하는 음을 정확히 낸다', () => {
  it('라이브 4코드(C·Am·F·G) 구성음', () => {
    expect(notesFor('C')).toEqual(['C4', 'E4', 'G4']);
    expect(notesFor('Am')).toEqual(['A3', 'C4', 'E4']);
    expect(notesFor('F')).toEqual(['F3', 'A3', 'C4']);
    expect(notesFor('G')).toEqual(['G3', 'B3', 'D4']);
  });
  it('C 메이저 = 도·미·솔 주파수(±1 cent)', () => {
    const [c, e, g] = chordToFreqs('C');
    expect(Math.abs(cents(c, 261.6256))).toBeLessThan(1);
    expect(Math.abs(cents(e, 329.6276))).toBeLessThan(1);
    expect(Math.abs(cents(g, 391.9954))).toBeLessThan(1);
  });
  it('멜로디 도~도(C4..C5)는 단일음으로 정확히 매핑', () => {
    expect(notesFor('C4')).toEqual(['C4']);
    expect(chordToFreqs('C4')[0]).toBeCloseTo(261.6256, 2);
    expect(chordToFreqs('C5')[0]).toBeCloseTo(523.2511, 2);
  });
});

describe('tuning — 코드 보이싱(근음 중심)', () => {
  it('C 코드: 베이스 근음(C3) 보강 + 근음 게인 > 최상단 게인', () => {
    const v = chordVoicing('C');
    // 베이스로 C3(근음 한 옥타브 아래) 포함
    expect(v.some((n) => Math.abs(n.freq - noteToFreq('C3')) < 0.01)).toBe(true);
    const root = v.find((n) => Math.abs(n.freq - noteToFreq('C4')) < 0.01);
    const top = v.find((n) => Math.abs(n.freq - noteToFreq('G4')) < 0.01);
    expect(root).toBeDefined();
    expect(top).toBeDefined();
    // 근음(C4)이 최상단(G4)보다 크게 울린다 → 고음 우위 완화
    expect(root!.gain).toBeGreaterThan(top!.gain);
    // 근음 게인은 최대(1.0)
    expect(root!.gain).toBe(1);
  });
  it('최상단 음이 항상 가장 작은 게인', () => {
    for (const chord of ['C', 'Am', 'F', 'G']) {
      const v = chordVoicing(chord);
      const gains = v.map((n) => n.gain);
      // 마지막(최상단) 구성음 게인이 근음(=index 1, 베이스 다음) 게인보다 작거나 같다
      expect(gains[gains.length - 1]).toBeLessThanOrEqual(gains[1]);
    }
  });
  it('멜로디 단일음은 게인 1.0 단일 노트(베이스 보강 없음)', () => {
    const v = chordVoicing('C4');
    expect(v).toHaveLength(1);
    expect(v[0].gain).toBe(1);
    expect(v[0].freq).toBeCloseTo(261.6256, 2);
  });
});
