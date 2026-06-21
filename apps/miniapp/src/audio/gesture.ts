// 카메라 손 제스처 입력 (MediaPipe HandLandmarker). 검증된 스파이크(gesture-spike.html, 커밋 923e545) 로직 이식.
// 손 위치 → 4코드 존, 편 손 = 지속음 / 주먹 = 멈춤. 출력은 chordReducer에 source:'gesture'로 공급.
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
    numHands: 1,
  });
}

export async function startCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: 480, height: 360 },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  return stream;
}

export function stopCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}

export interface GestureFrame {
  present: boolean;
  zone: number | null; // 0..3 (왼→오)
  open: boolean;
}

type Pt = { x: number; y: number };

// 손가락 펴짐 판정: 지문끝이 손목에서 PIP보다 멀면 폄. 3개 이상 = 편 손.
function isOpen(lm: Pt[]): boolean {
  const tips = [8, 12, 16, 20];
  const pips = [6, 10, 14, 18];
  const wrist = lm[0];
  let extended = 0;
  for (let i = 0; i < tips.length; i++) {
    const tip = lm[tips[i]];
    const pip = lm[pips[i]];
    const dTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
    const dPip = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
    if (dTip > dPip) extended++;
  }
  return extended >= 3;
}

// 거울(셀피) 표시 기준: 화면에 보이는 위치와 맞추려 x를 반전해 존 계산.
export function detect(video: HTMLVideoElement, tMs: number): GestureFrame {
  if (!landmarker) return { present: false, zone: null, open: false };
  const res = landmarker.detectForVideo(video, tMs);
  if (!res.landmarks || res.landmarks.length === 0) return { present: false, zone: null, open: false };
  const lm = res.landmarks[0] as Pt[];
  const cx = lm[9].x; // 중지 MCP ≈ 손바닥 중심 x (0..1)
  const zone = Math.min(3, Math.max(0, Math.floor((1 - cx) * 4)));
  return { present: true, zone, open: isOpen(lm) };
}
