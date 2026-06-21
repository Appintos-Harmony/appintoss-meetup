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
  on(chord: Chord): void;
  off(chord: Chord): void;
  dispose(): void;
}

/** 합주 합쳐듣기용 독립 보이스(트랙별 음색). dispose 후 호출은 무시(no-op). */
export function createVoice(t: Timbre): Voice {
  const s = makeSynth(t);
  let dead = false;
  return {
    on: (c) => {
      if (!dead) s.triggerAttack(CHORD_NOTES[c]);
    },
    off: (c) => {
      if (!dead) s.triggerRelease(CHORD_NOTES[c]);
    },
    dispose: () => {
      if (dead) return;
      dead = true;
      s.releaseAll();
      s.dispose();
    },
  };
}
