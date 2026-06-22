// 음 이동 유틸(순수). 기타/베이스 계이름 패드가 '개방현 + 반음 오프셋 → 음명'을 계산할 때 사용.
// 음정값은 audio/tuning.ts(김민혁)가 단일 진실원 — noteToMidi만 import해 MIDI로 환산하고,
// 여기서는 MIDI→음명(표기)만 담당한다(tuning 무수정).
import { noteToMidi } from '../audio/tuning';

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** MIDI 번호 → 샤프 표기 음명(예: 66 → 'F#4'). C4 = 60. */
export function midiToName(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return SHARP_NAMES[pc] + octave;
}

/** 음명을 반음(semitones)만큼 이동한 음명(예: transpose('E2', 2) → 'F#2'). */
export function transpose(note: string, semitones: number): string {
  return midiToName(noteToMidi(note) + semitones);
}

// 음명(C4) → 한글 계이름(도). 표기용(피아노/지판 패드 라벨 공통).
const SOLFA: Record<string, string> = {
  C: '도', 'C#': '도#', D: '레', 'D#': '레#', E: '미', F: '파',
  'F#': '파#', G: '솔', 'G#': '솔#', A: '라', 'A#': '라#', B: '시',
};

/** 음명 → 한글 계이름(옥타브 제외). 예: 'F#2' → '파#'. */
export function solfa(note: string): string {
  const m = /^([A-G]#?)/.exec(note);
  return m ? SOLFA[m[1]] ?? note : note;
}
