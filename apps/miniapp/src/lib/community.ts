// 커뮤니티 API 클라이언트. 백엔드(apps/api) 호출 + 식별=X-Anon-Key(getUserKey). share.ts와 동일 API_BASE 규칙.
import { getUserKey } from './identity';

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || 'http://localhost:8080';

// 재생 이벤트(앞으로 v2 NoteEvent와 호환되도록 느슨하게). 백엔드엔 opaque JSON으로 저장됨.
export type PlayEvent = {
  tick: number;
  phase: 'on' | 'off' | 'hit';
  chord?: string;
  note?: string;
  piece?: string;
  source?: string;
};

export interface FeedItem {
  id: number;
  name: string;
  bpm: number;
  owner: string;
  likesCount: number;
  durationTicks: number | null;
  createdAt: number;
  liked: boolean;
}
export interface Publication extends FeedItem {
  events: PlayEvent[];
}

class HttpError extends Error {
  status: number;
  constructor(status: number) {
    super('http ' + status);
    this.status = status;
  }
}

async function req(path: string, init?: RequestInit, withKey = false): Promise<unknown> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (withKey) headers['x-anon-key'] = await getUserKey();
  const r = await fetch(API_BASE + path, { ...init, headers });
  if (!r.ok) throw new HttpError(r.status);
  return r.status === 204 ? null : r.json();
}

export async function getFeed(sort: 'recent' | 'popular' = 'recent', limit = 30): Promise<FeedItem[]> {
  const res = (await req(`/feed?sort=${sort}&limit=${limit}`, undefined, true)) as { items: FeedItem[] };
  return res.items;
}
export async function getPublication(id: number): Promise<Publication> {
  return (await req(`/publications/${id}`, undefined, true)) as Publication;
}
export async function publish(p: {
  name: string;
  bpm: number;
  events: PlayEvent[];
  durationTicks?: number;
  owner?: string;
}): Promise<number> {
  const res = (await req('/publications', { method: 'POST', body: JSON.stringify(p) }, true)) as { id: number };
  return res.id;
}
export async function setLike(id: number, liked: boolean): Promise<{ likesCount: number; liked: boolean }> {
  return (await req(`/publications/${id}/like`, { method: liked ? 'POST' : 'DELETE' }, true)) as {
    likesCount: number;
    liked: boolean;
  };
}
export async function report(id: number, reason: string): Promise<void> {
  await req(`/publications/${id}/report`, { method: 'POST', body: JSON.stringify({ reason }) }, true);
}
export async function myPublications(): Promise<{ count: number; limit: number; items: FeedItem[] }> {
  return (await req('/me/publications', undefined, true)) as { count: number; limit: number; items: FeedItem[] };
}
export async function removePublication(id: number): Promise<void> {
  await req(`/publications/${id}`, { method: 'DELETE' }, true);
}
