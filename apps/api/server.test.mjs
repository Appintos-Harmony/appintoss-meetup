// 커뮤니티 백엔드 통합 테스트 — Node 내장(node:test, 무의존). 임시 DB+포트로 서버를 띄워 실제 HTTP 왕복.
// 실행: node --test apps/api/server.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = 8137;
const BASE = `http://localhost:${PORT}`;
let proc, dir;

const J = { 'content-type': 'application/json' };
const withKey = (k) => ({ ...J, 'x-anon-key': k });
const post = (p, body, headers = J) => fetch(BASE + p, { method: 'POST', headers, body: JSON.stringify(body ?? {}) });
const del = (p, headers = J) => fetch(BASE + p, { method: 'DELETE', headers });
const ev = (n = 1) => Array.from({ length: n }, (_, i) => ({ kind: 'chord', tick: i, phase: 'on', chord: 'C', source: 'touch' }));

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'harmony-api-'));
  proc = spawn(process.execPath, ['server.mjs'], {
    cwd: here,
    env: { ...process.env, PORT: String(PORT), DB_PATH: join(dir, 'test.db') },
    stdio: 'ignore',
  });
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(BASE + '/healthz')).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not start');
});
after(() => { try { proc?.kill(); } catch {} try { rmSync(dir, { recursive: true, force: true }); } catch {} });

test('페일클로즈드: 키 없는 게시 → 503', async () => {
  const r = await post('/publications', { name: 'x', events: ev() });
  assert.equal(r.status, 503);
});

test('게시 → 피드(메타만, events 미포함) → 단건(events 포함)', async () => {
  const k = withKey('user-one-1111');
  let r = await post('/publications', { name: '곡1', bpm: 100, owner: '토스밴드', events: ev(3) }, k);
  assert.equal(r.status, 201);
  const { id } = await r.json();
  assert.ok(id > 0);

  r = await fetch(BASE + '/feed');
  const feed = await r.json();
  assert.ok(feed.items.length >= 1);
  assert.equal(feed.items[0].events, undefined); // ★ 피드엔 events 없음(lazy-load)
  assert.equal(feed.items[0].owner, '토스밴드'); // owner_key가 아니라 표시명

  r = await fetch(BASE + '/publications/' + id);
  const det = await r.json();
  assert.ok(Array.isArray(det.events)); // ★ 단건엔 events 있음
  assert.equal(det.events.length, 3);
});

test('좋아요 멱등 + 카운트 + 취소', async () => {
  const k = withKey('liker-aaaa');
  const { id } = await (await post('/publications', { name: 'L', events: ev() }, withKey('owner-bbbb'))).json();
  let r = await post(`/publications/${id}/like`, {}, k);
  assert.deepEqual(await r.json(), { likesCount: 1, liked: true });
  r = await post(`/publications/${id}/like`, {}, k); // 중복
  assert.equal((await r.json()).likesCount, 1); // 안 늘어남
  r = await del(`/publications/${id}/like`, k);
  assert.deepEqual(await r.json(), { likesCount: 0, liked: false });
});

test('개인당 5곡 한도 → 6번째 409, /me 카운트', async () => {
  const k = withKey('limit-user-5');
  for (let i = 0; i < 5; i++) {
    const r = await post('/publications', { name: 'c' + i, events: ev() }, k);
    assert.equal(r.status, 201);
  }
  const over = await post('/publications', { name: 'over', events: ev() }, k);
  assert.equal(over.status, 409);
  const me = await (await fetch(BASE + '/me/publications', { headers: k })).json();
  assert.equal(me.limit, 5);
  assert.equal(me.count, 5);
});

test('신고 3건 → 자동 hidden(공개 조회 404)', async () => {
  const { id } = await (await post('/publications', { name: 'R', events: ev() }, withKey('rep-owner-1'))).json();
  for (const rk of ['reporter-1', 'reporter-2', 'reporter-3']) {
    const r = await post(`/publications/${id}/report`, { reason: '부적절' }, withKey(rk));
    assert.equal(r.status, 201);
  }
  assert.equal((await fetch(BASE + '/publications/' + id)).status, 404); // hidden → 비공개
});

test('회귀: 기존 합주 엔드포인트(sessions/tracks) 정상', async () => {
  let r = await post('/sessions', { name: 's', bpm: 100, owner: 'a', events: ev() });
  assert.equal(r.status, 201);
  const { code } = await r.json();
  r = await fetch(BASE + '/sessions/' + code);
  assert.equal(r.status, 200);
  const s = await r.json();
  assert.equal(s.tracks.length, 1);
  r = await post(`/sessions/${code}/tracks`, { owner: 'b', events: ev(2) });
  assert.equal(r.status, 201);
});

test('페이징(offset/limit/total) + 작성자 필터(owner)', async () => {
  const ka = withKey('page-userA-1');
  const kb = withKey('page-userB-2');
  for (let i = 0; i < 3; i++) assert.equal((await post('/publications', { name: `A${i}`, owner: 'A밴드', events: ev() }, ka)).status, 201);
  for (let i = 0; i < 3; i++) assert.equal((await post('/publications', { name: `B${i}`, owner: 'B밴드', events: ev() }, kb)).status, 201);

  let r = await (await fetch(BASE + '/feed?limit=4&offset=0')).json();
  assert.equal(r.items.length, 4); // limit 적용
  assert.ok(r.total >= 6); // 전체 공개곡 수
  const firstIds = r.items.map((x) => x.id);

  r = await (await fetch(BASE + '/feed?limit=4&offset=4')).json();
  assert.ok(r.items.length >= 2);
  assert.ok(r.items.every((x) => !firstIds.includes(x.id))); // offset 페이지 비중복

  r = await (await fetch(BASE + '/feed?owner=' + encodeURIComponent('A밴드'))).json();
  assert.equal(r.total, 3); // 작성자 필터 정확
  assert.ok(r.items.length === 3 && r.items.every((x) => x.owner === 'A밴드'));
});
