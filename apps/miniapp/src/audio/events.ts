// 이벤트 계약 v2: NoteEvent 판별유니온(코드/멜로디/드럼) + TrackMeta + 정규화.
// 와이어/저장 형식은 하위호환을 위해 ChordEvent({tick,phase,chord,source}, kind 없음)를 유지한다.
// NoteEvent는 그 위에 kind를 입힌 '타입 뷰'이며, normalizeEvents가 레거시·교차유저 페이로드를 복원한다.
// 음정값(Hz/구성음)은 audio/tuning.ts(김민혁)가 단일 진실원: 여기서 음정을 만들지 않는다(TASK-030, import만).
import { isChordName } from './tuning';
import type { ChordEvent, Source } from './chordReducer';

export type { Source } from './chordReducer';
export type { ChordEvent } from './chordReducer';

export type Instrument = 'piano' | 'guitar' | 'bass' | 'drum';
export type DrumPiece = 'kick' | 'snare' | 'hihat' | 'ride' | 'crash' | 'hitom' | 'midtom' | 'floortom';

/** 트랙 단위 메타(이벤트에 싣지 않고 트랙/곡에 분리: '스타일=소리만' 원칙). */
export interface TrackMeta {
  owner: string;
  instrument: Instrument;
  style: string;
}

export interface ChordHit {
  kind: 'chord';
  tick: number;
  phase: 'on' | 'off';
  chord: string;
  source: Source;
}
export interface MelodyHit {
  kind: 'melody';
  tick: number;
  phase: 'on' | 'off';
  note: string;
  source: Source;
}
export interface DrumStroke {
  kind: 'drum';
  tick: number;
  phase: 'hit';
  piece: DrumPiece;
  source: Source;
}
export type NoteEvent = ChordHit | MelodyHit | DrumStroke;

// 드럼은 와이어에서 chord='drum:kick' 형태로 흐른다(백엔드/저장 스키마 무변경 통과).
export const DRUM_PREFIX = 'drum:';
export const drumKey = (piece: DrumPiece): string => DRUM_PREFIX + piece;
export const isDrumKey = (v: string): boolean => v.startsWith(DRUM_PREFIX);
export const drumPieceOf = (v: string): DrumPiece => v.slice(DRUM_PREFIX.length) as DrumPiece;

/** 와이어/레거시 ChordEvent 1건 → 타입드 NoteEvent. kind 없는 과거 데이터·교차유저 트랙 복원. */
export function toNoteEvent(e: ChordEvent): NoteEvent {
  if (isDrumKey(e.chord)) {
    return { kind: 'drum', tick: e.tick, phase: 'hit', piece: drumPieceOf(e.chord), source: e.source };
  }
  if (isChordName(e.chord)) {
    return { kind: 'chord', tick: e.tick, phase: e.phase, chord: e.chord, source: e.source };
  }
  // 코드 이름이 아니면 멜로디 단음(C4 등). 음명을 note로 옮긴다.
  return { kind: 'melody', tick: e.tick, phase: e.phase, note: e.chord, source: e.source };
}

/** 와이어/레거시 배열 → NoteEvent 배열(하위호환). undefined/null은 빈 배열. */
export function normalizeEvents(raw: readonly ChordEvent[] | undefined | null): NoteEvent[] {
  if (!raw) return [];
  return raw.map(toNoteEvent);
}

/** NoteEvent → 와이어 chord 키(재생 보이스 키): 코드명 / 음명 / 'drum:piece'. */
export function wireKey(e: NoteEvent): string {
  if (e.kind === 'chord') return e.chord;
  if (e.kind === 'melody') return e.note;
  return drumKey(e.piece);
}
