// 음악 클럭 (Tone.Transport). 메트로놈·카운트인·녹음 tick 기준.
// DL-019: BPM 100, 4/4. 벽시계 ms 금지 — Transport 초를 tick으로 환산.
import * as Tone from 'tone';
import { playClick } from './engine';

export const BPM = 100;
export const BEATS_PER_BAR = 4;
export const TICKS_PER_BEAT = 4;

export const msToTick = (ms: number) => Math.round((ms / 1000) * (BPM / 60) * TICKS_PER_BEAT);
export const tickToMs = (tick: number) => (tick / TICKS_PER_BEAT) * (60 / BPM) * 1000;

let scheduled = false;
let beatHandler: ((beatInBar: number, bar: number) => void) | null = null;

/** 매 박 콜백 등록(시각 표시·카운트인 판정용). */
export function onBeat(handler: (beatInBar: number, bar: number) => void): void {
  beatHandler = handler;
}

export function startMetronome(): void {
  Tone.Transport.bpm.value = BPM;
  Tone.Transport.timeSignature = BEATS_PER_BAR;
  if (!scheduled) {
    Tone.Transport.scheduleRepeat((time) => {
      const [barStr, beatStr] = Tone.Transport.position.toString().split(':');
      const bar = parseInt(barStr, 10);
      const beat = parseInt(beatStr, 10);
      playClick(beat === 0, time);
      Tone.Draw.schedule(() => beatHandler?.(beat, bar), time);
    }, '4n');
    scheduled = true;
  }
  Tone.Transport.position = 0;
  Tone.Transport.start();
}

export function stopMetronome(): void {
  Tone.Transport.stop();
  Tone.Transport.position = 0;
}

/** 현재 Transport 경과 초. 녹음 tick 환산 기준. */
export function transportSeconds(): number {
  return Tone.Transport.seconds;
}
