// 로컬 곡 저장/복구 (localStorage). 합주 백엔드는 Phase 4(조건부).
import type { ChordEvent } from '../audio/chordReducer';

export interface Song {
  id: string;
  name: string;
  bpm: number;
  events: ChordEvent[];
  createdAt: number;
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
