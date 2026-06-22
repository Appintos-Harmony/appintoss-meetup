// 하모니 공유 백엔드 (비동기 합주 "얹기"). Node 내장 모듈만 — node:http + node:sqlite (무의존성).
// 엔드포인트: GET /healthz · POST /sessions · GET /sessions/:code · POST /sessions/:code/tracks
// 인증 없음(코드=접근권한) — 해커톤 데모용. 식별은 클라 getAnonymousKey/닉네임. 실시간 아님(클라 1~2s polling).
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';

const PORT = Number(process.env.PORT) || 8080;
const db = new DatabaseSync(process.env.DB_PATH || 'harmony.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (code TEXT PRIMARY KEY, name TEXT, bpm INTEGER, created_at INTEGER);
  CREATE TABLE IF NOT EXISTS tracks (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT, owner TEXT, events TEXT, created_at INTEGER);
`);
// 트랙별 악기/스타일 컬럼(기존 DB 호환: 없으면 추가, 있으면 무시). 옛 행은 NULL → 클라가 추론.
for (const col of ['instrument', 'style']) {
  try {
    db.exec(`ALTER TABLE tracks ADD COLUMN ${col} TEXT`);
  } catch {
    /* 이미 존재 */
  }
}

// 혼동 문자(0/O/1/I) 제외한 코드.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genCode() {
  let c = '';
  for (let i = 0; i < 6; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return c;
}

// 입력 검증(데모는 무인증 — 코드=접근권한. 최소 방어로 오염 payload 차단). 잘못되면 400.
const VALID_INSTRUMENTS = new Set(['piano', 'guitar', 'bass', 'drum']);
function badEvents(events) {
  if (!Array.isArray(events) || events.length > 5000) return true;
  for (const e of events) {
    if (!e || typeof e !== 'object') return true;
    if (typeof e.tick !== 'number' || !Number.isFinite(e.tick) || e.tick < 0 || e.tick > 1e7) return true;
    if (e.phase !== 'on' && e.phase !== 'off') return true;
    if (typeof e.chord !== 'string' || e.chord.length > 40) return true;
  }
  return false;
}
const okInstrument = (i) => i == null || (typeof i === 'string' && VALID_INSTRUMENTS.has(i));
const clip = (s, n, dflt) => (typeof s === 'string' ? s.slice(0, n) : dflt);

function send(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1_000_000) reject(new Error('payload too large'));
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  const path = new URL(req.url, `http://${req.headers.host}`).pathname;
  if (req.method === 'OPTIONS') return send(res, 204, {});

  try {
    if (req.method === 'GET' && path === '/healthz') {
      return send(res, 200, { ok: true, time: Date.now() });
    }

    if (req.method === 'POST' && path === '/sessions') {
      const { name, bpm, owner, events, instrument, style } = await readBody(req);
      if (events !== undefined && badEvents(events)) return send(res, 400, { error: 'invalid events' });
      if (!okInstrument(instrument)) return send(res, 400, { error: 'invalid instrument' });
      let code = genCode();
      while (db.prepare('SELECT 1 FROM sessions WHERE code = ?').get(code)) code = genCode();
      const now = Date.now();
      db.prepare('INSERT INTO sessions (code, name, bpm, created_at) VALUES (?, ?, ?, ?)').run(
        code,
        name || '하모니 세션',
        Number(bpm) || 100,
        now,
      );
      if (Array.isArray(events) && events.length) {
        db.prepare('INSERT INTO tracks (code, owner, events, instrument, style, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
          code,
          clip(owner, 60, '익명'),
          JSON.stringify(events),
          instrument || null,
          clip(style, 40, null),
          now,
        );
      }
      return send(res, 201, { code });
    }

    const mTracks = path.match(/^\/sessions\/([^/]+)\/tracks$/);
    if (req.method === 'POST' && mTracks) {
      const code = mTracks[1];
      if (!db.prepare('SELECT 1 FROM sessions WHERE code = ?').get(code)) {
        return send(res, 404, { error: 'session not found' });
      }
      const { owner, events, instrument, style } = await readBody(req);
      if (badEvents(events)) return send(res, 400, { error: 'invalid events' });
      if (!okInstrument(instrument)) return send(res, 400, { error: 'invalid instrument' });
      const info = db
        .prepare('INSERT INTO tracks (code, owner, events, instrument, style, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(code, clip(owner, 60, '익명'), JSON.stringify(events), instrument || null, clip(style, 40, null), Date.now());
      return send(res, 201, { ok: true, trackId: Number(info.lastInsertRowid) });
    }

    const mSession = path.match(/^\/sessions\/([^/]+)$/);
    if (req.method === 'GET' && mSession) {
      const code = mSession[1];
      const sess = db.prepare('SELECT code, name, bpm, created_at FROM sessions WHERE code = ?').get(code);
      if (!sess) return send(res, 404, { error: 'session not found' });
      const tracks = db
        .prepare('SELECT owner, events, instrument, style, created_at FROM tracks WHERE code = ? ORDER BY id')
        .all(code)
        .map((t) => ({ owner: t.owner, events: JSON.parse(t.events), instrument: t.instrument || undefined, style: t.style || undefined, createdAt: t.created_at }));
      return send(res, 200, { code: sess.code, name: sess.name, bpm: sess.bpm, tracks });
    }

    return send(res, 404, { error: 'not found' });
  } catch (e) {
    return send(res, 400, { error: e instanceof Error ? e.message : String(e) });
  }
});

server.listen(PORT, () => console.log(`harmony-api listening on :${PORT}`));
