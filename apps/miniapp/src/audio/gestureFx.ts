// 제스처 재미 효과(모든 제스처 모드 공통): 손 흔들기→탬버린, 박수→박수, 헤드뱅잉→귀여운 효과음.
// 손/얼굴 랜드마크의 '모션'으로 감지(위치 무관) → 효과음 + (Studio가) 스파클 표시.
// 음악과 별개 레이어. 임계값은 실기 튜닝 대상.
import * as Tone from 'tone';
import type { Pt } from './gesture';

// ---------- 효과음(합성, 무의존) ----------
let fxOut: Tone.Volume | null = null;
function out(): Tone.Volume {
  if (!fxOut) fxOut = new Tone.Volume(-4).toDestination();
  return fxOut;
}
let tamb: Tone.NoiseSynth | null = null;
let clapN: Tone.NoiseSynth | null = null;
let cute: Tone.Synth | null = null;

export function playTambourine(): void {
  if (!tamb) {
    const hp = new Tone.Filter(6500, 'highpass').connect(out());
    tamb = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.13, sustain: 0 } }).connect(hp);
    tamb.volume.value = -6;
  }
  tamb.triggerAttackRelease('16n');
}
export function playClap(): void {
  if (!clapN) {
    const bp = new Tone.Filter({ frequency: 1400, type: 'bandpass', Q: 1.2 }).connect(out());
    clapN = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.09, sustain: 0 } }).connect(bp);
    clapN.volume.value = -3;
  }
  clapN.triggerAttackRelease('32n');
}
export function playCute(): void {
  if (!cute) {
    cute = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.18, sustain: 0, release: 0.05 } }).connect(out());
    cute.volume.value = -8;
  }
  cute.triggerAttackRelease('C6', '16n');
  cute.triggerAttackRelease('G6', '16n', '+0.08');
}

// ---------- 모션 감지 ----------
export interface FxHit {
  kind: 'tambourine' | 'clap' | 'cute';
  x: number; // 카메라 정규화 좌표(미러 전)
  y: number;
}

interface AxisHist {
  v: number;
  dir: number; // -1/0/1
  reversalV: number; // 마지막 방향전환 지점
  lastTrig: number;
}
let handX: (AxisHist | null)[] = [null, null];
let clapPrevD = 1;
let clapArmed = true;
let clapLast = 0;
let faceY: AxisHist | null = null;

const MOVE_EPS = 0.012; // 방향 갱신 최소 이동
const WAVE_AMP = 0.06; // 흔들기 진폭(반전 사이)
const WAVE_GAP = 110; // ms, 탬버린 최소 간격
const CLAP_NEAR = 0.16; // 두 손 가까움
const CLAP_FAR = 0.3; // 재무장 거리
const CLAP_GAP = 250;
const FACE_AMP = 0.035; // 헤드뱅잉 상하 진폭
const FACE_GAP = 200;

export function resetFx(): void {
  handX = [null, null];
  clapPrevD = 1;
  clapArmed = true;
  clapLast = 0;
  faceY = null;
}

// 한 축(가로 손 x / 세로 얼굴 y) 흔들림 → 방향전환마다 트리거.
function axisShake(h: AxisHist | null, v: number, amp: number, gap: number, now: number): { hist: AxisHist; trig: boolean } {
  if (!h) return { hist: { v, dir: 0, reversalV: v, lastTrig: 0 }, trig: false };
  const dv = v - h.v;
  let dir = h.dir;
  let trig = false;
  let reversalV = h.reversalV;
  let lastTrig = h.lastTrig;
  if (Math.abs(dv) > MOVE_EPS) {
    const nd = dv > 0 ? 1 : -1;
    if (nd !== h.dir && h.dir !== 0) {
      // 방향 전환 — 직전 전환점 대비 진폭 충분 + 간격 충분이면 트리거
      if (Math.abs(v - h.reversalV) > amp && now - h.lastTrig > gap) {
        trig = true;
        lastTrig = now;
      }
      reversalV = v;
    }
    dir = nd;
  }
  return { hist: { v, dir, reversalV, lastTrig }, trig };
}

/** 손 프레임 + (옵션)얼굴 중심으로 효과 감지. 트리거된 효과 목록 반환. */
export function detectFx(frames: { pos: Pt | null }[], face: Pt | null, now: number): FxHit[] {
  const hits: FxHit[] = [];
  // 손 흔들기(손별) → 탬버린
  for (let i = 0; i < 2; i++) {
    const p = frames[i]?.pos ?? null;
    if (!p) {
      handX[i] = null;
      continue;
    }
    const r = axisShake(handX[i], p.x, WAVE_AMP, WAVE_GAP, now);
    handX[i] = r.hist;
    if (r.trig) hits.push({ kind: 'tambourine', x: p.x, y: p.y });
  }
  // 박수(양손 근접) → 박수
  const a = frames[0]?.pos ?? null;
  const b = frames[1]?.pos ?? null;
  if (a && b) {
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (clapArmed && d < CLAP_NEAR && clapPrevD >= CLAP_NEAR && now - clapLast > CLAP_GAP) {
      hits.push({ kind: 'clap', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      clapArmed = false;
      clapLast = now;
    }
    if (d > CLAP_FAR) clapArmed = true;
    clapPrevD = d;
  } else {
    clapPrevD = 1;
    clapArmed = true;
  }
  // 헤드뱅잉(얼굴 상하) → 귀여운 효과음
  if (face) {
    const r = axisShake(faceY, face.y, FACE_AMP, FACE_GAP, now);
    faceY = r.hist;
    if (r.trig) hits.push({ kind: 'cute', x: face.x, y: face.y });
  } else {
    faceY = null;
  }
  return hits;
}

export function playFx(kind: FxHit['kind']): void {
  if (kind === 'tambourine') playTambourine();
  else if (kind === 'clap') playClap();
  else playCute();
}
