// 하모니 코드 입력 reducer (순수함수). DL-019/REVIEW-028 H28-003.
// 입력(제스처/터치)을 받아 tick 기반 noteOn/noteOff 이벤트만 남긴다.
// 규칙: 같은 chord noteOn 중복 금지 / chord 변경·해제 시에만 noteOff /
//       touch 중 gesture 무시 / touch 종료 후 GESTURE_RESUME_MS 동안 gesture 무시.

export type Source = 'gesture' | 'touch';
export type Phase = 'on' | 'off';

export interface ChordEvent {
  /** 세션 공통 tick (벽시계 ms 금지 — 기기 간 정렬). */
  tick: number;
  phase: Phase;
  chord: string;
  source: Source;
}

export interface ChordState {
  activeChord: string | null;
  activeSource: Source | null;
  events: ChordEvent[];
  /** 마지막으로 터치가 해제된 실시간(ms). gesture 재개 게이트용. */
  touchReleasedAtMs: number | null;
}

export type ChordAction =
  | { type: 'down'; chord: string; source: Source; tick: number; nowMs: number }
  | { type: 'up'; source: Source; tick: number; nowMs: number };

/** 터치 종료 후 이 시간(ms) 동안은 제스처 입력을 무시한다(손이 빠져나가며 오발 방지). */
export const GESTURE_RESUME_MS = 200;

export const initialChordState: ChordState = {
  activeChord: null,
  activeSource: null,
  events: [],
  touchReleasedAtMs: null,
};

export function chordReducer(state: ChordState, action: ChordAction): ChordState {
  if (action.type === 'down') {
    // 터치 우선: 터치 연주 중이거나 터치 종료 직후엔 제스처를 무시한다.
    if (action.source === 'gesture') {
      if (state.activeSource === 'touch') return state;
      if (
        state.touchReleasedAtMs !== null &&
        action.nowMs - state.touchReleasedAtMs < GESTURE_RESUME_MS
      ) {
        return state;
      }
    }
    // 같은 코드가 이미 울리는 중이면 noteOn 중복 저장 금지.
    if (state.activeChord === action.chord && state.activeSource !== null) return state;

    const events = state.events.slice();
    // 다른 코드로 전환되면 이전 코드를 먼저 off.
    if (state.activeChord !== null && state.activeSource !== null) {
      events.push({ tick: action.tick, phase: 'off', chord: state.activeChord, source: state.activeSource });
    }
    events.push({ tick: action.tick, phase: 'on', chord: action.chord, source: action.source });
    return { ...state, activeChord: action.chord, activeSource: action.source, events };
  }

  // up: 활성 소스가 해제할 때만 off. (다른 소스의 up은 무시)
  const touchReleasedAtMs = action.source === 'touch' ? action.nowMs : state.touchReleasedAtMs;
  if (state.activeChord === null) {
    return { ...state, touchReleasedAtMs };
  }
  if (action.source !== state.activeSource) {
    return { ...state, touchReleasedAtMs };
  }
  const events = state.events.concat({
    tick: action.tick,
    phase: 'off',
    chord: state.activeChord,
    source: state.activeSource,
  });
  return { ...state, activeChord: null, activeSource: null, events, touchReleasedAtMs };
}
