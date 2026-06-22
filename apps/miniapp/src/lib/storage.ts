// 로컬 곡 저장/복구 (localStorage). 멀티트랙(여러 악기 레이어) 지원 + 구버전 단일 take 호환.
import type { ChordEvent } from '../audio/chordReducer';
import type { Instrument } from '../audio/events';
import type { SessionTrack } from './share';

export interface Song {
  id: string;
  name: string;
  bpm: number;
  createdAt: number;
  tracks?: SessionTrack[]; // 멀티트랙(신규). 각 트랙 = owner·events·instrument·style.
  // ↓ 구버전 단일 take 호환(읽기 전용). 신규 저장은 tracks 사용.
  events?: ChordEvent[];
  instrument?: Instrument;
  style?: string;
}

/** Song → 트랙 배열(구버전 단일 take는 트랙 1개로 변환). 없으면 빈 배열. */
export function songTracks(s: Song): SessionTrack[] {
  if (s.tracks && s.tracks.length) return s.tracks;
  if (s.events && s.events.length) {
    return [{ owner: '나', events: s.events, instrument: s.instrument, style: s.style, createdAt: s.createdAt }];
  }
  return [];
}

const KEY = 'harmony.songs';

export function listSongs(): Song[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const songs = JSON.parse(raw) as Song[];
    return songs.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return []; // 손상된 데이터는 빈 목록으로 복구
  }
}

export function saveSong(song: Song): void {
  const songs = listSongs().filter((s) => s.id !== song.id);
  songs.push(song);
  localStorage.setItem(KEY, JSON.stringify(songs));
}

export function deleteSong(id: string): void {
  localStorage.setItem(KEY, JSON.stringify(listSongs().filter((s) => s.id !== id)));
}

export function newSongId(): string {
  return 's_' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
}
