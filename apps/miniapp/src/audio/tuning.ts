// 음정 단일 진실원(single source of truth). 평균율(12-TET), 기준 A4 = 440 Hz.
// 순수 함수 — 오디오 런타임(Tone/Web Audio) 비의존이라 vitest로 직접 검증 가능하다.
// engine.ts(재생)와 tuning.test.ts(검증)가 이 표를 함께 쓴다. DL-019 / TASK-20260622-029.

/** 기준 피치. A4 = 440 Hz (평균율). */
export const A4_HZ = 440;

// 음이름(♯/♭ 이명동음 포함) → 옥타브 내 반음 인덱스(C=0).
const SEMITONE: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

/** 'C4'·'F#3'·'Bb4' → MIDI 번호. C4 = 60(가온다), A4 = 69. */
export function noteToMidi(note: string): number {
  const m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(note.trim());
  if (!m) throw new Error(`잘못된 음이름: "${note}"`);
  const semitone = SEMITONE[m[1].toUpperCase() + m[2]];
  if (semitone === undefined) throw new Error(`알 수 없는 음: "${note}"`);
  return (parseInt(m[3], 10) + 1) * 12 + semitone;
}

/** MIDI 번호 → 주파수(Hz). 평균율, A4(69) = 440. */
export function midiToFreq(midi: number): number {
  return A4_HZ * Math.pow(2, (midi - 69) / 12);
}

/** 음이름 → 주파수(Hz). 코드/멜로디 재생이 실제로 내는 음을 결정한다. */
export function noteToFreq(note: string): number {
  return midiToFreq(noteToMidi(note));
}

// 코드(C/Am/F/G…) → 구성음. 멜로디 개별음(C4 등)은 표에 없으면 단일음으로 처리.
const CHORD_NOTES: Record<string, string[]> = {
  C: ['C4', 'E4', 'G4'],
  Cm: ['C4', 'Eb4', 'G4'],
  C7: ['C4', 'E4', 'G4', 'Bb4'],
  Cm7: ['C4', 'Eb4', 'G4', 'Bb4'],
  D: ['D4', 'F#4', 'A4'],
  Dm: ['D4', 'F4', 'A4'],
  D7: ['D4', 'F#4', 'A4', 'C5'],
  Dm7: ['D4', 'F4', 'A4', 'C5'],
  E: ['E3', 'G#3', 'B3'],
  Em: ['E3', 'G3', 'B3'],
  E7: ['E3', 'G#3', 'B3', 'D4'],
  Em7: ['E3', 'G3', 'B3', 'D4'],
  F: ['F3', 'A3', 'C4'],
  Fm: ['F3', 'Ab3', 'C4'],
  F7: ['F3', 'A3', 'C4', 'Eb4'],
  Fm7: ['F3', 'Ab3', 'C4', 'Eb4'],
  G: ['G3', 'B3', 'D4'],
  Gm: ['G3', 'Bb3', 'D4'],
  G7: ['G3', 'B3', 'D4', 'F4'],
  Gm7: ['G3', 'Bb3', 'D4', 'F4'],
  A: ['A3', 'C#4', 'E4'],
  Am: ['A3', 'C4', 'E4'],
  A7: ['A3', 'C#4', 'E4', 'G4'],
  Am7: ['A3', 'C4', 'E4', 'G4'],
  B: ['B3', 'D#4', 'F#4'],
  Bm: ['B3', 'D4', 'F#4'],
  B7: ['B3', 'D#4', 'F#4', 'A4'],
  Bm7: ['B3', 'D4', 'F#4', 'A4'],
};

/** chord(C/Am…) 또는 개별음(C4) → 음이름 배열. */
export function notesFor(v: string): string[] {
  return CHORD_NOTES[v] ?? [v];
}

/** v가 코드 이름(CHORD_NOTES에 정의)인지. 멜로디 개별음과 구분용(재생 보이스 분리 등). */
export function isChordName(v: string): boolean {
  return v in CHORD_NOTES;
}

/** chord/개별음 → 정확한 주파수(Hz) 배열. 재생 엔진이 내는 실제 음. */
export function chordToFreqs(v: string): number[] {
  return notesFor(v).map(noteToFreq);
}

export interface VoicedNote {
  freq: number;
  /** 0~1 음별 게인(velocity). 근음 강조용. */
  gain: number;
}

// 코드 재생 보이싱(근음 중심). 같은 음량으로 쌓으면 사람은 최상단 음을 멜로디로 듣는다
// (high-voice superiority effect — 입증된 심리음향). 그래서 근음을 한 옥타브 아래 베이스로
// 보강하고, 위로 갈수록 게인을 낮춰 근음을 중심에 둔다. 게인 값은 청취 튜닝 대상(모바일 실기 확인).
export function chordVoicing(v: string): VoicedNote[] {
  const notes = notesFor(v);
  // 멜로디 개별음(코드 아님)은 단일음 그대로(게인 1).
  if (!(v in CHORD_NOTES)) {
    return [{ freq: noteToFreq(notes[0]), gain: 1 }];
  }
  const out: VoicedNote[] = [];
  // 베이스: 근음(맨 아래 = 루트)을 한 옥타브 아래에 보강.
  out.push({ freq: midiToFreq(noteToMidi(notes[0]) - 12), gain: 0.85 });
  // 구성음: 근음이 가장 크고 위로 갈수록 감쇠(최상단이 가장 작게).
  notes.forEach((n, i) => {
    const gain = i === 0 ? 1 : Math.max(0.4, 0.62 - i * 0.06);
    out.push({ freq: noteToFreq(n), gain });
  });
  return out;
}
