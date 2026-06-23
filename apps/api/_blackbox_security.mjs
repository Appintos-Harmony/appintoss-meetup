// 보안 회귀 블랙박스(Codex REVIEW-038 P0/MED 재현 차단 확인). 수동/CI 통합 테스트.
// 실행: 임시 DB로 서버 2개 띄운 뒤 이 스크립트 실행(레이트리밋 버킷 격리용 A/B):
//   ( PORT=8091 DB_PATH=bb_a.db node server.mjs & ) ; ( PORT=8092 DB_PATH=bb_b.db node server.mjs & )
//   node _blackbox_security.mjs    # 7 PASS / 0 FAIL 기대. TRUST_PROXY 미설정 = 직접 노출(XFF 무시) 시나리오.
const A = 'http://127.0.0.1:8091';
const B = 'http://127.0.0.1:8092';
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { (cond ? pass++ : fail++); console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' :: ' + extra : '')); };
async function j(base, path, opts) {
  const r = await fetch(base + path, { headers: { 'content-type': 'application/json', ...(opts?.headers || {}) }, ...opts });
  let body = null; try { body = await r.json(); } catch {}
  return { status: r.status, body };
}
const pub = (base, author_key, name = '곡', token) => j(base, '/sessions', { method: 'POST', body: JSON.stringify({ name, bpm: 100, owner: 'o', author: 'a', author_key, published: true, events: [{ tick: 0, phase: 'on', chord: 'C' }, { tick: 16, phase: 'off', chord: 'C' }], trackCount: 2, idempotencyToken: token }) });

// 1. P0 트랙 오염: 공개 세션에 attacker key로 추가 → 403, owner key → 201
const s1 = await pub(A, 'OWNER_K1');
const code1 = s1.body?.code;
const atk = await j(A, `/sessions/${code1}/tracks`, { method: 'POST', body: JSON.stringify({ owner: 'attacker', events: [{ tick: 0, phase: 'on', chord: 'D' }, { tick: 8, phase: 'off', chord: 'D' }], author_key: 'ATTACKER_K2' }) });
ok('P0-1 attacker /tracks on published -> 403', atk.status === 403, 'got ' + atk.status);
const own = await j(A, `/sessions/${code1}/tracks`, { method: 'POST', body: JSON.stringify({ owner: 'owner', events: [{ tick: 0, phase: 'on', chord: 'E' }, { tick: 8, phase: 'off', chord: 'E' }], author_key: 'OWNER_K1' }) });
ok('P0-1 owner /tracks on published -> 201', own.status === 201, 'got ' + own.status);

// 2. P0 신고 자동숨김: 같은 IP에서 author_key 3개 회전 신고 -> 댓글 안 숨겨짐(서버 IP 기준 1신고자)
const s2 = await pub(A, 'SK', '신고테스트');
const code2 = s2.body?.code;
const cm = await j(A, `/sessions/${code2}/comments`, { method: 'POST', body: JSON.stringify({ text: '정상 댓글입니다', author: 'u', author_key: 'CK' }) });
const cid = cm.body?.id;
for (const k of ['rep1', 'rep2', 'rep3']) await j(A, `/sessions/${code2}/comments/${cid}/report`, { method: 'POST', body: JSON.stringify({ author_key: k }) });
const cl = await j(A, `/sessions/${code2}/comments`, {});
ok('P0-2 key-rotation report cannot hide comment', (cl.body?.comments?.length || 0) === 1, 'visible=' + (cl.body?.comments?.length));

// 3. MED 멱등 토큰 스코프: owner token으로 생성 후 attacker가 같은 token -> owner code 못 받음
const tok = 'SHARED-TOKEN-XYZ';
const o1 = await pub(A, 'IDK1', '멱등', tok);
const a1 = await pub(A, 'IDK2_ATTACKER', '멱등공격', tok);
ok('MED idempotency token not cross-author replayable', a1.body?.code !== o1.body?.code || !a1.body?.idempotent, 'owner=' + o1.body?.code + ' attacker=' + JSON.stringify(a1.body));

// 4. MED hidden 세션 direct GET -> 404
const s4 = await pub(A, 'HK', '숨김');
const code4 = s4.body?.code;
await j(A, `/sessions/${code4}/hide`, { method: 'POST', body: JSON.stringify({ author_key: 'HK' }) });
const g4 = await j(A, `/sessions/${code4}`, {});
ok('MED hidden session direct GET -> 404', g4.status === 404, 'got ' + g4.status);

// 5. MED me 헤더: x-anon-key로 liked 조회 동작(쿼리 노출 없이)
const meKey = 'ME_ANON';
await j(A, `/sessions/${code1}/like`, { method: 'POST', body: JSON.stringify({ author_key: meKey }) });
const board = await j(A, '/community?limit=50', { headers: { 'x-anon-key': meKey } });
const likedItem = board.body?.items?.find((it) => it.code === code1);
ok('MED me via x-anon-key header reflects liked', !!likedItem && likedItem.liked === true, 'liked=' + likedItem?.liked);

// 6. P0 XFF 레이트리밋 우회(서버 B, fresh bucket, TRUST_PROXY 미설정): 회전 XFF로도 13/13 성공 불가
const xffResults = [];
for (let i = 0; i < 13; i++) {
  const r = await j(B, '/sessions', { method: 'POST', headers: { 'x-forwarded-for': '9.9.9.' + i }, body: JSON.stringify({ name: 'x', bpm: 100, owner: 'o', author: 'a', author_key: 'XK' + i, published: true, events: [{ tick: 0, phase: 'on', chord: 'C' }, { tick: 16, phase: 'off', chord: 'C' }] }) });
  xffResults.push(r.status);
}
const blocked = xffResults.filter((s) => s === 429).length;
ok('P0-3 rotated XFF cannot bypass rate limit (some 429)', blocked > 0, 'statuses=' + JSON.stringify(xffResults));

console.log(`\n=== ${pass} PASS / ${fail} FAIL ===`);
process.exit(fail ? 1 : 0);
