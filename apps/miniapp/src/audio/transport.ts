// 음악 클럭 (Tone.Transport). 메트로놈·카운트인·녹음 tick 기준.
// DL-019: BPM 100, 4/4. 벽시계 ms 금지. Transport 초를 tick으로 환산.
import * as Tone from 'tone';
import { playClick } from './engine';

// 템포·박자는 런타임 설정(메트로놈 시트). tick은 박(=4분음표) 기준: BPM이 박 템포.
export let BPM = 100;
export let BEATS_PER_BAR = 4; // 박자 분자(3/4→3, 4/4→4, 6/8→6). 클릭 수/바.
export const TICKS_PER_BEAT = 4;

/** 템포(박/분) 설정. 진행 중이면 즉시 반영. */
export function setTempo(bpm: number): void {
  BPM = bpm;
  Tone.Transport.bpm.value = bpm;
}
/** 박자(바당 박 수) 설정. */
export function setBeatsPerBar(beats: number): void {
  BEATS_PER_BAR = beats;
  Tone.Transport.timeSignature = beats;
}

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
