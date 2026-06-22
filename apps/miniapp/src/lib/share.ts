// 합주 공유 클라이언트. 백엔드(apps/api) 호출 + 실패 시 프리로드 폴백(데모 지속).
// API_BASE: 개발=localhost:8080, 배포=VITE_API_BASE(AWS HTTPS) 빌드시 주입.
import type { ChordEvent } from '../audio/chordReducer';

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || 'http://localhost:8080';

export interface SessionTrack {
  owner: string;
  events: ChordEvent[];
  createdAt: number;
}
export interface Session {
  code: string;
  name: string;
  bpm: number;
  tracks: SessionTrack[];
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
}): Promise<string> {
  const res = (await req('/sessions', { method: 'POST', body: JSON.stringify(s) })) as { code: string };
  return res.code;
}

export async function getSession(code: string): Promise<Session> {
  return (await req('/sessions/' + encodeURIComponent(code))) as Session;
}

export async function addTrack(code: string, owner: string, events: ChordEvent[]): Promise<void> {
  await req('/sessions/' + encodeURIComponent(code) + '/tracks', {
    method: 'POST',
    body: JSON.stringify({ owner, events }),
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
