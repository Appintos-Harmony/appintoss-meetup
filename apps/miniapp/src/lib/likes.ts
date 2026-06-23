// 커뮤니티 좋아요(로컬). 백엔드 소셜 집계가 아니라 데모용 — 내가 누른 좋아요만 localStorage에 저장하고,
// 표시 개수 = 결정적 기본값(아이디 해시) + 내가 누름(±1). 실제 networked 집계는 후속(apps/api).
const LIKE_STORE = 'harmony.likes';

function load(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(LIKE_STORE) || '[]') as string[]);
  } catch {
    return new Set();
  }
}
function save(s: Set<string>): void {
  try {
    localStorage.setItem(LIKE_STORE, JSON.stringify([...s]));
  } catch {
    /* 저장 실패 무시 */
  }
}

export function isLiked(id: string): boolean {
  return load().has(id);
}

/** 좋아요 토글. 누른 후 상태 반환(true=좋아요됨). */
export function toggleLike(id: string): boolean {
  const s = load();
  if (s.has(id)) s.delete(id);
  else s.add(id);
  save(s);
  return s.has(id);
}

/** 데모용 기본 좋아요 수(아이디 해시로 결정적, 3~42). 실제 집계 아님. */
export function baseLikes(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 40) + 3;
}
