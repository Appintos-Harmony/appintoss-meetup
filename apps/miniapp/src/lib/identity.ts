// 사용자 식별 (DL-016: 토스 로그인/자체 회원가입 금지 → getAnonymousKey 익명 + 닉네임).
// 2트랙: 토스(WebView/샌드박스)=getAnonymousKey 실제 hash, 일반 브라우저(AWS)=익명 mock 폴백.
import { getAnonymousKey } from '@apps-in-toss/web-framework';
import { isToss } from './platform';

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
  // 토스(WebView/샌드박스): getAnonymousKey 반환은 3갈래다.
  //   { type:'HASH', hash } = 성공 / 'ERROR' = 오류 / undefined = 사용자 토스앱 버전 5.232.0 미만.
  // 주의: 샌드박스에서는 host(토스앱)가 mock hash 를 내려준다(실 per-user 식별 아님). 실사용자 식별은
  //       정식배포/토스앱 QR(intoss-private://) 진입에서만 검증된다.
  // 실패(ERROR·undefined·호출 throw)는 모두 아래 익명 mock 폴백으로 떨어진다. 'toss_' 접두로 출처를 구분한다.
  if (isToss()) {
    try {
      const res = await getAnonymousKey();
      if (res && res !== 'ERROR' && res.type === 'HASH') {
        return 'toss_' + res.hash;
      }
    } catch {
      // 브릿지 호출 실패 → 폴백
    }
  }
  // 일반 브라우저(AWS)·미지원 환경: 암호학적 난수 익명 키(128bit, crypto.getRandomValues).
  // 주의: 엔트로피 상향은 키 추측(사칭으로 hide/dedup 위조)만 줄인다. 서버가 author_key를 검증하지 않으므로
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

/** 멱등 토큰 등 짧은 고유 ID. crypto.randomUUID는 보안 컨텍스트(https/localhost)에서만 노출되므로
 *  LAN http 개발·구형 WebView에서도 안전하도록 getRandomValues(128bit) 폴백을 둔다. */
export function randomId(): string {
  return crypto.randomUUID?.() ?? randomHex(16);
}
