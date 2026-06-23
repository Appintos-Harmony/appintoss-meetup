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
export interface FxResult {
  hits: FxHit[];
  handWaving: [boolean, boolean]; // 손별 '팔랑팔랑 흔드는 중'(1명 모드에서 연주 억제용)
}

// 한 축의 '흔들림(flutter)' 추적: 짧은 시간 창 안의 방향전환 횟수로 판정 → 우발적 1회 이동은 무시.
interface Flutter {
  v: number;
  dir: number; // -1/0/1
  reversalV: number; // 마지막 방향전환 기준점
  reversals: number[]; // 최근 방향전환 시각들(창 안)
  lastTrig: number;
}
let handF: (Flutter | null)[] = [null, null];
let faceF: Flutter | null = null;
let clapPrevD = 1;
let clapArmed = true;
let clapLast = 0;

const MOVE_EPS = 0.012; // 방향 갱신 최소 이동
// 손 흔들기 = "팔랑팔랑": 창(WINDOW)에서 방향전환 MIN_REV회 이상이어야 인정(엄격).
const WAVE_AMP = 0.045;
const WAVE_WINDOW = 650;
const WAVE_MIN_REV = 3;
const WAVE_GAP = 110;
// 헤드뱅잉 = 위아래 끄덕임 2회+.
const FACE_AMP = 0.03;
const FACE_WINDOW = 750;
const FACE_MIN_REV = 2;
const FACE_GAP = 170;
// 박수 = 양손 근접 엣지.
const CLAP_NEAR = 0.16;
const CLAP_FAR = 0.3;
const CLAP_GAP = 250;

export function resetFx(): void {
  handF = [null, null];
  faceF = null;
  clapPrevD = 1;
  clapArmed = true;
  clapLast = 0;
}

// 한 축의 flutter 갱신. active=흔드는 중, fired=이번 프레임 트리거.
function flutter(
  h: Flutter | null,
  v: number,
  amp: number,
  win: number,
  minRev: number,
  gap: number,
  now: number,
): { hist: Flutter; active: boolean; fired: boolean } {
  if (!h) return { hist: { v, dir: 0, reversalV: v, reversals: [], lastTrig: 0 }, active: false, fired: false };
  const dv = v - h.v;
  let dir = h.dir;
  let reversalV = h.reversalV;
  let lastTrig = h.lastTrig;
  let reversals = h.reversals.filter((t) => now - t < win);
  if (Math.abs(dv) > MOVE_EPS) {
    const nd = dv > 0 ? 1 : -1;
    if (nd !== dir && dir !== 0) {
      if (Math.abs(v - reversalV) > amp) reversals = [...reversals, now]; // 진폭 충분한 반전만 카운트
      reversalV = v;
    }
    dir = nd;
  }
  const active = reversals.length >= minRev;
  let fired = false;
  if (active && now - lastTrig > gap) {
    fired = true;
    lastTrig = now;
  }
  return { hist: { v, dir, reversalV, reversals, lastTrig }, active, fired };
}

/** 손 프레임 + (옵션)얼굴 중심으로 효과 감지. 효과 hit + 손별 흔드는중 상태 반환. */
export function detectFx(frames: { pos: Pt | null }[], face: Pt | null, now: number): FxResult {
  const hits: FxHit[] = [];
  const handWaving: [boolean, boolean] = [false, false];
  // 손 흔들기(손별, flutter) → 탬버린
  for (let i = 0; i < 2; i++) {
    const p = frames[i]?.pos ?? null;
    if (!p) {
      handF[i] = null;
      continue;
    }
    const r = flutter(handF[i], p.x, WAVE_AMP, WAVE_WINDOW, WAVE_MIN_REV, WAVE_GAP, now);
    handF[i] = r.hist;
    handWaving[i] = r.active;
    if (r.fired) hits.push({ kind: 'tambourine', x: p.x, y: p.y });
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
  // 헤드뱅잉(얼굴 상하 끄덕임) → 귀여운 효과음
  if (face) {
    const r = flutter(faceF, face.y, FACE_AMP, FACE_WINDOW, FACE_MIN_REV, FACE_GAP, now);
    faceF = r.hist;
    if (r.fired) hits.push({ kind: 'cute', x: face.x, y: face.y });
  } else {
    faceF = null;
  }
  return { hits, handWaving };
}

export function playFx(kind: FxHit['kind']): void {
  if (kind === 'tambourine') playTambourine();
  else if (kind === 'clap') playClap();
  else playCute();
}
