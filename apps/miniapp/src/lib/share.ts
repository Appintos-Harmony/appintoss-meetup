// 합주 공유 클라이언트. 백엔드(apps/api) 호출 + 실패 시 프리로드 폴백(데모 지속).
// API_BASE: 개발=localhost:8080, 배포=VITE_API_BASE(AWS HTTPS) 빌드시 주입.
import type { ChordEvent } from '../audio/chordReducer';
import type { Instrument } from '../audio/events';

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || 'http://localhost:8080';

export interface SessionTrack {
  owner: string;
  events: ChordEvent[];
  createdAt: number;
  instrument?: Instrument; // 녹음 악기(트랙별 재생 기준). 네트워크 라운드트립 전엔 로컬에서만 보존(백엔드 컬럼 추가 전).
  style?: string;
}
export interface Session {
  code: string;
  name: string;
  bpm: number;
  tracks: SessionTrack[];
  likeCount?: number;
  originCode?: string | null; // 파생 출처(원본 code). 서버 GET /sessions/:code 가 반환.
  originName?: string | null;
  originAuthor?: string | null;
}

// 백엔드 불가 시 데모용 프리로드(친구 트랙 — C·G·Am·F 4마디).
export const PRELOAD: Session = {
  code: 'DEMO01',
  name: '데모 합주',
  bpm: 100,
  tracks: [
    {
      owner: '토스밴드',
      createdAt: 0,
      events: [
        { tick: 0, phase: 'on', chord: 'C', source: 'touch' },
        { tick: 16, phase: 'off', chord: 'C', source: 'touch' },
        { tick: 16, phase: 'on', chord: 'G', source: 'touch' },
        { tick: 32, phase: 'off', chord: 'G', source: 'touch' },
        { tick: 32, phase: 'on', chord: 'Am', source: 'touch' },
        { tick: 48, phase: 'off', chord: 'Am', source: 'touch' },
        { tick: 48, phase: 'on', chord: 'F', source: 'touch' },
        { tick: 64, phase: 'off', chord: 'F', source: 'touch' },
      ],
    },
  ],
};

async function req(path: string, init?: RequestInit): Promise<unknown> {
  const r = await fetch(API_BASE + path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!r.ok) throw new Error('http ' + r.status);
  return r.json();
}

export async function createSession(s: {
  name: string;
  bpm: number;
  owner: string;
  events: ChordEvent[];
  instrument?: Instrument;
  style?: string;
}): Promise<string> {
  const res = (await req('/sessions', { method: 'POST', body: JSON.stringify(s) })) as { code: string };
  return res.code;
}

export async function getSession(code: string): Promise<Session> {
  return (await req('/sessions/' + encodeURIComponent(code))) as Session;
}

export async function addTrack(
  code: string,
  owner: string,
  events: ChordEvent[],
  instrument?: Instrument,
  style?: string,
): Promise<void> {
  await req('/sessions/' + encodeURIComponent(code) + '/tracks', {
    method: 'POST',
    body: JSON.stringify({ owner, events, instrument, style }),
  });
}

/** 백엔드 왕복 지연(ms). 개발자 모드 네트워크 표시용. 실패 시 null. */
export async function ping(): Promise<number | null> {
  const t0 = performance.now();
  try {
    const r = await fetch(API_BASE + '/healthz', { cache: 'no-store' });
    if (!r.ok) return null;
    await r.json();
    return Math.round(performance.now() - t0);
  } catch {
    return null;
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function readClipboardCode(): Promise<string | null> {
  try {
    const t = await navigator.clipboard.readText();
    const m = t.match(/\b[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}\b/);
    return m ? m[0] : null;
  } catch {
    return null;
  }
}

// ---- 커뮤니티 공유 보드 (음원 공유 + 합 쌓기 + 코멘트) — 기능명세서 v2 ----
export interface CommunityItem {
  code: string;
  name: string;
  author: string;
  trackCount: number;
  commentCount: number;
  playCount: number;
  forkCount: number;
  likeCount: number;
  liked: boolean; // 호출 시 me(anonKey)를 넘기면 내 좋아요 여부, 아니면 false.
  originCode: string | null;
  originName: string | null;
  originAuthor: string | null;
  createdAt: number;
}
export interface Comment {
  id: number;
  author: string;
  text: string;
  createdAt: number;
}

/** 보드 목록(최근 공유물). me(anonKey)를 넘기면 항목별 내 좋아요 여부(liked)도 채워진다. 실패 시 예외. */
export async function listCommunity(limit = 30, me?: string): Promise<CommunityItem[]> {
  const q = '/community?limit=' + limit + (me ? '&me=' + encodeURIComponent(me) : '');
  const r = (await req(q)) as { items?: CommunityItem[] };
  return r.items ?? [];
}

/** 좋아요 토글(서버 reactions, anon_key당 1회). 반환 = 토글 후 상태와 총 개수. */
export async function toggleLike(code: string, authorKey: string): Promise<{ liked: boolean; count: number }> {
  return (await req('/sessions/' + encodeURIComponent(code) + '/like', {
    method: 'POST',
    body: JSON.stringify({ author_key: authorKey }),
  })) as { liked: boolean; count: number };
}

/** 커뮤니티에 공유(publish). origin_code가 있으면 출처가 강제로 박힌다.
 *  반환: { code, deduped }. deduped=true면 같은 곡이 이미 있어 새로 만들지 않고 기존 code를 돌려준 것(호출부는 추가 트랙 적재를 건너뛴다). */
export async function publishSession(s: {
  name: string;
  bpm: number;
  owner: string;
  author: string;
  authorKey: string;
  events: ChordEvent[];
  instrument?: Instrument;
  style?: string;
  originCode?: string;
  trackCount?: number; // 전체 레이어 수(서버 중복방지 키 — 트랙 구성이 다르면 다른 곡으로 취급)
  idempotencyToken?: string;
}): Promise<{ code: string; deduped: boolean }> {
  const body: Record<string, unknown> = {
    name: s.name,
    bpm: s.bpm,
    owner: s.owner,
    author: s.author,
    author_key: s.authorKey,
    published: true,
    events: s.events,
    instrument: s.instrument,
    style: s.style,
  };
  if (s.originCode) body.origin_code = s.originCode;
  if (typeof s.trackCount === 'number') body.track_count = s.trackCount;
  if (s.idempotencyToken) body.idempotencyToken = s.idempotencyToken;
  const res = (await req('/sessions', { method: 'POST', body: JSON.stringify(body) })) as { code: string; deduped?: boolean };
  return { code: res.code, deduped: !!res.deduped };
}

export async function getComments(code: string): Promise<Comment[]> {
  const r = (await req('/sessions/' + encodeURIComponent(code) + '/comments')) as { comments?: Comment[] };
  return r.comments ?? [];
}
export async function addComment(code: string, text: string, author: string, authorKey: string): Promise<void> {
  await req('/sessions/' + encodeURIComponent(code) + '/comments', {
    method: 'POST',
    body: JSON.stringify({ text, author, author_key: authorKey }),
  });
}
export async function reportComment(code: string, id: number, authorKey: string): Promise<void> {
  await req('/sessions/' + encodeURIComponent(code) + '/comments/' + id + '/report', {
    method: 'POST',
    body: JSON.stringify({ author_key: authorKey }),
  });
}
