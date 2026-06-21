// 사용자 식별 (DL-016: 토스 로그인/자체 회원가입 금지 → getAnonymousKey 익명 + 닉네임).
// 프로덕션: @apps-in-toss/web-framework 의 getAnonymousKey 로 교체. 현재는 mock fallback.

const KEY_STORE = 'harmony.anonKey';
const NICK_STORE = 'harmony.nickname';

export async function getUserKey(): Promise<string> {
  // TODO(prod): import { getAnonymousKey } from '@apps-in-toss/web-framework' 로 교체.
  // SDK 2.4.5 미만은 undefined 반환 가능 → mock fallback 유지.
  let k = localStorage.getItem(KEY_STORE);
  if (!k) {
    k = 'anon_' + Math.abs(hashString(String(performance.now()) + navigator.userAgent)).toString(36);
    localStorage.setItem(KEY_STORE, k);
  }
  return k;
}

export function getNickname(): string | null {
  return localStorage.getItem(NICK_STORE);
}
export function setNickname(name: string): void {
  localStorage.setItem(NICK_STORE, name.trim());
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
