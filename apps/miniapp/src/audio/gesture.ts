// 카메라 손 제스처 입력 (MediaPipe HandLandmarker). 검증된 스파이크(gesture-spike.html, 커밋 923e545) 로직 이식 + 확장.
// 손 위치 → N개 코드/드럼 존. 활성 판정 2모드: palm(편 손=지속) / finger(검지 1개=지속·드럼 타격).
// 출력은 chordReducer에 source:'gesture'로 공급. 개발자 모드용 landmark(점)도 함께 반환.
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

let landmarker: HandLandmarker | null = null;

export async function initHandTracking(): Promise<void> {
  if (landmarker) return;
  const vision = await FilesetResolver.forVisionTasks(WASM);
  landmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numHands: 2, // 양손 모드 지원(루프에서 1/2 손 제한)
  });
}

/** 카메라 시작. facingMode: 'user'(전면·셀피) / 'environment'(후면). */
export async function startCamera(video: HTMLVideoElement, facingMode: 'user' | 'environment' = 'user'): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode, width: 480, height: 360 },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  return stream;
}

export function stopCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}

export type GestureMode = 'palm' | 'finger';
export interface Pt {
  x: number;
  y: number;
}
export interface GestureFrame {
  present: boolean;
  zone: number | null;
  active: boolean; // 지속음/타격 트리거 상태
  pos: Pt | null; // 기준점(정규화 0..1, 미러 전). 드럼 2D 키트 매핑용
  landmarks: Pt[] | null; // 21점(개발자 모드 스켈레톤)
}
export interface DetectOpts {
  zoneCount: number;
  mode: GestureMode;
  mirror: boolean; // 전면 카메라(셀피)는 x 반전
}

function extended(lm: Pt[], tip: number, pip: number): boolean {
  const w = lm[0];
  const dTip = Math.hypot(lm[tip].x - w.x, lm[tip].y - w.y);
  const dPip = Math.hypot(lm[pip].x - w.x, lm[pip].y - w.y);
  return dTip > dPip;
}

// 편 손: 검지·중지·약지·새끼 중 3개 이상 폄.
function isOpen(lm: Pt[]): boolean {
  const tips = [8, 12, 16, 20];
  const pips = [6, 10, 14, 18];
  let n = 0;
  for (let i = 0; i < tips.length; i++) if (extended(lm, tips[i], pips[i])) n++;
  return n >= 3;
}

// 손가락 1개(검지): 검지 폄 + 나머지(중지·약지·새끼) 1개 이하 폄.
function isPointing(lm: Pt[]): boolean {
  const index = extended(lm, 8, 6);
  const others =
    (extended(lm, 12, 10) ? 1 : 0) + (extended(lm, 16, 14) ? 1 : 0) + (extended(lm, 20, 18) ? 1 : 0);
  return index && others <= 1;
}

/** 감지된 손마다 한 프레임씩(최대 2). 호출부에서 한손/양손으로 제한한다. */
export function detect(video: HTMLVideoElement, tMs: number, opts: DetectOpts): GestureFrame[] {
  if (!landmarker) return [];
  const res = landmarker.detectForVideo(video, tMs);
  if (!res.landmarks || res.landmarks.length === 0) return [];
  return res.landmarks.map((raw) => {
    const lm: Pt[] = raw.map((p) => ({ x: p.x, y: p.y }));
    // 위치 기준점: finger=검지끝(8), palm=중지 MCP(9, 손바닥 중심).
    const ref = opts.mode === 'finger' ? lm[8] : lm[9];
    const x = opts.mirror ? 1 - ref.x : ref.x;
    const zone = Math.min(opts.zoneCount - 1, Math.max(0, Math.floor(x * opts.zoneCount)));
    const active = opts.mode === 'finger' ? isPointing(lm) : isOpen(lm);
    return { present: true, zone, active, pos: { x: ref.x, y: ref.y }, landmarks: lm };
  });
}
