// 사용자 식별. 운영(앱인토스 WebView)에서는 SDK의 getAnonymousKey(비게임 익명 식별키)를 쓴다.
// 개발/데모(일반 브라우저)에서는 localStorage에 안정적 mock hash를 만들어 재사용한다.
// 한계: 익명키는 "클라이언트 식별값"이라 신뢰 경계가 아니다 → 민감 권한은 서버 capability 토큰으로 보강한다(DL-016 / NFR-001).
//
// 운영 전환 시(앱인토스 SDK 설치 후) 아래 mock 분기를 다음으로 교체한다:
//   import { getAnonymousKey } from '@apps-in-toss/web-framework';
//   const r = await getAnonymousKey();
//   if (r && typeof r === 'object' && r.type === 'HASH') return r.hash;

const MOCK_KEY_STORAGE = 'meetup-lite.anonKey';

function makeMockKey(): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `mock-${rnd}`;
}

/** 현재 사용자의 익명 식별자(hash)를 반환한다. 데모에서는 브라우저별 mock 키. */
export async function getUserKey(): Promise<string> {
  const existing = localStorage.getItem(MOCK_KEY_STORAGE);
  if (existing) return existing;
  const created = makeMockKey();
  localStorage.setItem(MOCK_KEY_STORAGE, created);
  return created;
}

/** 데모/테스트에서 다른 사용자로 전환(다른 hash 발급). */
export function resetUserKeyForDemo(): string {
  const created = makeMockKey();
  localStorage.setItem(MOCK_KEY_STORAGE, created);
  return created;
}
