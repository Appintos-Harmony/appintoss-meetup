// 사용자 식별 (DL-016: 토스 로그인/자체 회원가입 금지 → getAnonymousKey 익명 + 닉네임).
// 프로덕션: @apps-in-toss/web-framework 의 getAnonymousKey 로 교체. 현재는 mock fallback.

const KEY_STORE = 'harmony.anonKey';
const NICK_STORE = 'harmony.nickname';
const EMOJI_STORE = 'harmony.emoji';

// 이모지 프로필 선택지(설정에서 사용자가 고름).
export const EMOJI_CHOICES = ['🎵', '🎸', '🎹', '🥁', '🎤', '🎧', '😎', '🤩', '🥳', '😺', '🐶', '🐰', '🦊', '🐼', '🐸', '🦁', '🌈', '⭐', '🔥', '🍀', '🍓', '🌸', '👾', '🚀'];

export function getEmoji(): string {
  return localStorage.getItem(EMOJI_STORE) || '🎵';
}
export function setEmoji(e: string): void {
  localStorage.setItem(EMOJI_STORE, e);
}

export async function getUserKey(): Promise<string> {
  // TODO(prod): import { getAnonymousKey } from '@apps-in-toss/web-framework' 로 교체.
  // SDK 2.4.5 미만은 undefined 반환 가능 → 암호학적 난수 키로 폴백(128bit, crypto.getRandomValues).
  // 주의: 엔트로피 상향은 키 추측(타인 키 사칭으로 hide/dedup 위조)만 줄인다. 서버가 author_key를 검증하지 않으므로
  //       레이트리밋·스팸 방어는 서버 IP 기준에 의존한다(server.mjs).
  let k = localStorage.getItem(KEY_STORE);
  if (!k) {
    k = 'anon_' + randomHex(16); // 16바이트 = 128bit
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

// 암호학적 난수 hex(브라우저/WebView crypto). 익명키 폴백용.
function randomHex(bytes: number): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}
