// 오디오 엔진 (Tone.js). 스파이크 로직 이식: AudioContext unlock + 음색별 코드 재생.
// DL-019: 고정 4코드(C·Am·F·G), 음색 다중(어쿠스틱/일렉/신스베이스).
// 음정(음이름→주파수)은 tuning.ts(평균율 A4=440, 순수함수·단위테스트)를 단일 진실원으로 따른다.
// Tone 내부 파서 대신 검증된 Hz 값을 직접 넘겨 출력 음정을 보장한다. TASK-20260622-029.
import * as Tone from 'tone';
import { chordVoicing, noteToFreq } from './tuning';

// 피아노 음색(스타일). A안(합성): 그랜드·업라이트는 합성으로 구분이 약해 '어쿠스틱'으로 통합.
// 추후 B안(실제 샘플)으로 격상 가능(Salamander 등 무료, 출처표기만).
export type Timbre = 'acoustic' | 'electric';
export type Chord = 'C' | 'Am' | 'F' | 'G';

export const CHORDS: Chord[] = ['C', 'Am', 'F', 'G'];

let synth: Tone.PolySynth | null = null;
let timbre: Timbre = 'acoustic';
let unlocked = false;

function makeSynth(t: Timbre): Tone.PolySynth {
  const opts = {
    // 어쿠스틱 피아노: 빠른 어택 + 긴 디케이 + 낮은 서스테인 → 눌러도 서서히 줄어드는 피아노 감.
    acoustic: { oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.9, sustain: 0.15, release: 1.2 } },
    // 전자 피아노: FM(사인) → 종/일렉 피아노(Rhodes)풍 음색.
    electric: { oscillator: { type: 'fmsine' }, envelope: { attack: 0.005, decay: 0.6, sustain: 0.3, release: 0.9 } },
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

// chord(C/Am…) 또는 개별음(C4) 모두 재생. tuning.ts 보이싱(근음 중심·음별 게인)으로 발음.
export function chordOn(v: string): void {
  for (const { freq, gain } of chordVoicing(v)) synth?.triggerAttack(freq, undefined, gain);
}
export function chordOff(v: string): void {
  for (const { freq } of chordVoicing(v)) synth?.triggerRelease(freq);
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
  click.triggerAttackRelease(noteToFreq(accent ? 'C6' : 'G5'), '32n', time);
}

export const TIMBRES: Timbre[] = ['acoustic', 'electric'];

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
      if (!dead) for (const { freq, gain } of chordVoicing(c)) s.triggerAttack(freq, undefined, gain);
    },
    off: (c) => {
      if (!dead) for (const { freq } of chordVoicing(c)) s.triggerRelease(freq);
    },
    dispose: () => {
      if (dead) return;
      dead = true;
      s.releaseAll();
      s.dispose();
    },
  };
}
