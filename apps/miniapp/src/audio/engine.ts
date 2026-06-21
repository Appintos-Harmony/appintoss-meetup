// 오디오 엔진 (Tone.js). 스파이크 로직 이식: AudioContext unlock + 음색별 코드 재생.
// DL-019: 고정 4코드(C·Am·F·G), 음색 다중(어쿠스틱/일렉/신스베이스).
import * as Tone from 'tone';

export type Timbre = 'acoustic' | 'electric' | 'synthbass';
export type Chord = 'C' | 'Am' | 'F' | 'G';

export const CHORDS: Chord[] = ['C', 'Am', 'F', 'G'];

const CHORD_NOTES: Record<Chord, string[]> = {
  C: ['C4', 'E4', 'G4'],
  Am: ['A3', 'C4', 'E4'],
  F: ['F3', 'A3', 'C4'],
  G: ['G3', 'B3', 'D4'],
};

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

export function chordOn(chord: Chord): void {
  synth?.triggerAttack(CHORD_NOTES[chord]);
}
export function chordOff(chord: Chord): void {
  synth?.triggerRelease(CHORD_NOTES[chord]);
}
export function allOff(): void {
  synth?.releaseAll();
}
