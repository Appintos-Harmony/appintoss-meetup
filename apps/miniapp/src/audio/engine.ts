// 오디오 엔진 (Tone.js). 스파이크 로직 이식: AudioContext unlock + 음색별 코드 재생.
// DL-019: 고정 4코드(C·Am·F·G), 음색 다중(어쿠스틱/일렉/신스베이스).
import * as Tone from 'tone';

export type Timbre = 'acoustic' | 'electric' | 'synthbass';
export type Chord = 'C' | 'Am' | 'F' | 'G';

export const CHORDS: Chord[] = ['C', 'Am', 'F', 'G'];

// 코드(C/Am/F/G…) → 음 배열. 멜로디 개별음(C4 등)은 그대로 단일음으로 재생.
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

function notesFor(v: string): string[] {
  return CHORD_NOTES[v] ?? [v];
}

let synth: Tone.PolySynth | null = null;
let timbre: Timbre = 'acoustic';
let unlocked = false;

function makeSynth(t: Timbre): Tone.PolySynth {
  const opts = {
    acoustic: { oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.8 } },
    electric: { oscillator: { type: 'fmsine' }, envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 1.2 } },
    synthbass: { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.02, decay: 0.2, sustain: 0.6, release: 0.6 } },
  } as const;
  const s = new Tone.PolySynth(Tone.Synth, opts[t]).toDestination();
  s.volume.value = -8;
  return s;
}

/** 첫 사용자 제스처에서 호출해야 소리가 난다(AudioContext unlock). */
export async function unlockAudio(): Promise<void> {
  if (unlocked) return;
  await Tone.start();
  synth = makeSynth(timbre);
  unlocked = true;
}

export function isUnlocked(): boolean {
  return unlocked;
}

export function setTimbre(t: Timbre): void {
  timbre = t;
  if (unlocked) {
    synth?.releaseAll();
    synth?.dispose();
    synth = makeSynth(t);
  }
}

export function getTimbre(): Timbre {
  return timbre;
}

// chord(C/Am…) 또는 개별음(C4) 모두 재생.
export function chordOn(v: string): void {
  synth?.triggerAttack(notesFor(v));
}
export function chordOff(v: string): void {
  synth?.triggerRelease(notesFor(v));
}
export function allOff(): void {
  synth?.releaseAll();
}

let click: Tone.Synth | null = null;
/** 메트로놈 클릭. accent=다운비트(첫 박). time은 Tone 스케줄 시각(정확한 타이밍). */
export function playClick(accent: boolean, time?: number): void {
  if (!click) {
    click = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 },
    }).toDestination();
    click.volume.value = -16;
  }
  click.triggerAttackRelease(accent ? 'C6' : 'G5', '32n', time);
}

export const TIMBRES: Timbre[] = ['acoustic', 'electric', 'synthbass'];

export interface Voice {
  on(v: string): void;
  off(v: string): void;
  dispose(): void;
}

/** 합주 합쳐듣기용 독립 보이스(트랙별 음색). dispose 후 호출은 무시(no-op). */
export function createVoice(t: Timbre): Voice {
  const s = makeSynth(t);
  let dead = false;
  return {
    on: (c) => {
      if (!dead) s.triggerAttack(notesFor(c));
    },
    off: (c) => {
      if (!dead) s.triggerRelease(notesFor(c));
    },
    dispose: () => {
      if (dead) return;
      dead = true;
      s.releaseAll();
      s.dispose();
    },
  };
}
