// 크로매틱 지판 검증 — 기타/베이스 패드가 반음(도 도# 레 레#…) 순서로, 계이름과 음이 일치하는지.
// 이전 버그: 칸 오프셋이 다이아토닉[0,2,4,5,7]이라 음·계이름이 건너뛰어 둘 다 틀렸음. TASK-030 피드백.
import { describe, it, expect } from 'vitest';
import { transpose, solfa, midiToName } from './notes';
import { noteToMidi } from '../audio/tuning';

describe('notes — 크로매틱 지판(반음 순서)', () => {
  it('transpose는 한 칸=반음으로 정확히 올린다(기타 6번줄 E2 기준 한 옥타브)', () => {
    const seq = Array.from({ length: 13 }, (_, i) => transpose('E2', i));
    expect(seq).toEqual(['E2', 'F2', 'F#2', 'G2', 'G#2', 'A2', 'A#2', 'B2', 'C3', 'C#3', 'D3', 'D#3', 'E3']);
  });

  it('계이름(solfa)이 실제 음과 일치', () => {
    expect(solfa('E2')).toBe('미');
    expect(solfa('F2')).toBe('파');
    expect(solfa('F#2')).toBe('파#');
    expect(solfa('C3')).toBe('도');
    expect(solfa('C#3')).toBe('도#');
  });

  it('미↔파·시↔도 사이엔 반음(검은음) 없음 = 한 반음', () => {
    expect(noteToMidi('F2') - noteToMidi('E2')).toBe(1);
    expect(noteToMidi('C3') - noteToMidi('B2')).toBe(1);
  });

  it('베이스 4번줄 E1도 동일 규칙', () => {
    expect(transpose('E1', 1)).toBe('F1');
    expect(transpose('E1', 3)).toBe('G1');
    expect(solfa(transpose('E1', 5))).toBe('라');
  });

  it('midiToName 왕복', () => {
    expect(midiToName(noteToMidi('A4'))).toBe('A4');
    expect(midiToName(60)).toBe('C4');
  });
});
