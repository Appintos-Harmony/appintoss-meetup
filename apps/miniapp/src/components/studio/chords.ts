// 스튜디오 UI/음악 상수: 28코드 매트릭스·색·로마숫자·악기/스타일·멜로디 건반·기타베이스·드럼.
// 음정값(Hz/구성음)은 audio/tuning.ts가 단일 진실원. 여기는 '이름/라벨/색/배치'만 둔다.
// (TASK-030 §5: Chord/CHORDS/ACCENT/ROMAN을 이 파일로 이전.)
import type { Instrument, DrumPiece } from '../../audio/events';

// ---- 28코드: 7 루트 × 4 종류. 라벨이 곧 tuning.notesFor 키(예: 'G7'). ----
export const ROOTS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
export type Root = (typeof ROOTS)[number];

export type Quality = 'maj' | 'm' | '7' | 'm7';
export const QUALITIES: { key: Quality; label: string; suffix: string }[] = [
  { key: 'maj', label: 'maj', suffix: '' },
  { key: 'm', label: 'm', suffix: 'm' },
  { key: '7', label: '7', suffix: '7' },
  { key: 'm7', label: 'm7', suffix: 'm7' },
];

/** (root, quality) → 코드 이름(=tuning 키). 예: ('G','7')→'G7', ('A','m')→'Am', ('C','maj')→'C'. */
export function buildChordName(root: Root, quality: Quality): string {
  const q = QUALITIES.find((x) => x.key === quality);
  return root + (q ? q.suffix : '');
}

/** 종류별 인터벌(반음): 검증/문서용. 실제 음정 산출은 tuning.ts(근음중심 보이싱). */
export const QUALITY_INTERVALS: Record<Quality, number[]> = {
  maj: [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
};

// 빈 화면 방지용 빠른 팝 4코드(라이브 검증된 C·Am·F·G).
export const PRESET_POP: string[] = ['C', 'Am', 'F', 'G'];
export const ROMAN: Record<string, string> = { C: 'I', Am: 'vi', F: 'IV', G: 'V' };

export const MAX_CHORDS = 6;
export const GESTURE_ZONES = 4; // 일반(인라인) 제스처 = 앞 4개 코드
export const GESTURE_ZONES_FULL = 6; // 전체화면 제스처 = 최대 6개 코드

// ---- 색: 4코드는 시그니처, 나머지는 SIG 팔레트 순환 ----
export const ACCENT: Record<string, [string, string]> = {
  C: ['#3182f6', '#1b64da'],
  Am: ['#8b5cf6', '#7c3aed'],
  F: ['#15c47e', '#0fa968'],
  G: ['#ff6b6b', '#ee5253'],
};
export const SIG = ['#3182f6', '#ff6b6b', '#15c47e', '#8b5cf6', '#ff9f1c'];

/** 코드 강조색 [base, pressed]. 4코드는 ACCENT, 그 외는 선택 순서 index로 SIG 순환. */
export function chordColor(name: string, index: number): [string, string] {
  if (ACCENT[name]) return ACCENT[name];
  const c = SIG[index % SIG.length];
  return [c, c];
}

// ---- 악기 / 스타일 콤보(악기→스타일 종속). 스타일은 화면 동일·소리만. ----
export const INSTRUMENTS: { key: Instrument; label: string; emoji: string }[] = [
  { key: 'piano', label: '피아노', emoji: '🎹' },
  { key: 'guitar', label: '기타', emoji: '🎸' },
  { key: 'bass', label: '베이스', emoji: '🎻' },
  { key: 'drum', label: '드럼', emoji: '🥁' },
];

// 스타일 라벨은 '악기 N' 통일(키는 엔진 프리셋 식별자라 유지).
export const STYLE_OPTIONS: Record<Instrument, { key: string; label: string }[]> = {
  piano: [{ key: 'grand', label: '피아노 1' }, { key: 'electric', label: '피아노 2' }],
  guitar: [{ key: 'acoustic', label: '기타 1' }, { key: 'electric', label: '기타 2' }],
  bass: [{ key: 'precision', label: '베이스 1' }, { key: 'jazz', label: '베이스 2' }],
  drum: [{ key: 'analog', label: '드럼 1' }, { key: 'electronic', label: '드럼 2' }],
};

export const INSTRUMENT_LABEL: Record<Instrument, string> = {
  piano: '피아노', guitar: '기타', bass: '베이스', drum: '드럼',
};
export const INSTRUMENT_EMOJI: Record<Instrument, string> = {
  piano: '🎹', guitar: '🎸', bass: '🎻', drum: '🥁',
};

// ---- 멜로디 피아노 한 옥타브: 흰건반 8 + 검은건반 5([음명, 한글계이름, 왼쪽 흰건반 index]) ----
export const WHITE_KEYS: [string, string][] = [
  ['C4', '도'], ['D4', '레'], ['E4', '미'], ['F4', '파'], ['G4', '솔'], ['A4', '라'], ['B4', '시'], ['C5', '도'],
];
export const BLACK_KEYS: [string, string, number][] = [
  ['C#4', '도#', 0], ['D#4', '레#', 1], ['F#4', '파#', 3], ['G#4', '솔#', 4], ['A#4', '라#', 5],
];

// ---- 기타/베이스: 개방현 + 계이름 패드(실제 지판 X). 칸 오프셋 = 개방현 기준 반음 누적. ----
export const STRINGS_GUITAR = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
export const STRINGS_BASS = ['E1', 'A1', 'D2', 'G2'];
// 실제 지판: 한 칸 = 반음(크로매틱, 도 도# 레 레#…). 칸 수는 화면에 따라(일반 6 / 전체화면 13).
export const FRETS_NORMAL = 6;
export const FRETS_FULL = 13;

// ---- 드럼 8피스(실제 드럼킷 구성) ----
export const DRUM_PIECES: { key: DrumPiece; label: string; color: string }[] = [
  { key: 'crash', label: '크래시', color: '#ff9f1c' },
  { key: 'hihat', label: '하이햇', color: '#15c47e' },
  { key: 'ride', label: '라이드', color: '#0fa968' },
  { key: 'hitom', label: '하이탐', color: '#8b5cf6' },
  { key: 'midtom', label: '미드탐', color: '#7c3aed' },
  { key: 'snare', label: '스네어', color: '#ff6b6b' },
  { key: 'kick', label: '킥', color: '#3182f6' },
  { key: 'floortom', label: '플로어탐', color: '#1b64da' },
];

// 드럼 제스처용 키트 배치(가라지밴드 SoCal풍 2D, 정규화 좌표 0..1 + 반경). 손 위치 → 가장 가까운 모양 타격.
export const DRUM_KIT_LAYOUT: { key: DrumPiece; label: string; color: string; x: number; y: number; r: number }[] = [
  { key: 'crash', label: '크래시', color: '#ff9f1c', x: 0.14, y: 0.24, r: 0.13 },
  { key: 'hihat', label: '하이햇', color: '#15c47e', x: 0.16, y: 0.52, r: 0.11 },
  { key: 'ride', label: '라이드', color: '#0fa968', x: 0.86, y: 0.26, r: 0.14 },
  { key: 'hitom', label: '하이탐', color: '#8b5cf6', x: 0.40, y: 0.38, r: 0.11 },
  { key: 'midtom', label: '미드탐', color: '#7c3aed', x: 0.60, y: 0.38, r: 0.11 },
  { key: 'snare', label: '스네어', color: '#ff6b6b', x: 0.26, y: 0.72, r: 0.12 },
  { key: 'kick', label: '킥', color: '#3182f6', x: 0.50, y: 0.75, r: 0.15 },
  { key: 'floortom', label: '플로어탐', color: '#1b64da', x: 0.80, y: 0.72, r: 0.13 },
];

/** 손 위치(정규화 0..1, 화면 표시 좌표)에서 가장 가까운 드럼피스. 너무 멀면 null. */
export function nearestDrumPiece(x: number, y: number): DrumPiece | null {
  let best: DrumPiece | null = null;
  let bestD = Infinity;
  for (const s of DRUM_KIT_LAYOUT) {
    const d = Math.hypot(x - s.x, y - s.y);
    if (d < bestD && d < s.r + 0.07) {
      bestD = d;
      best = s.key;
    }
  }
  return best;
}
