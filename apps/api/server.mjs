// 하모니 백엔드 (합주 "얹기" + 커뮤니티 피드). Node 내장 모듈만 — node:http + node:sqlite (무의존성).
// 합주:   GET /healthz · POST /sessions · GET /sessions/:code · POST /sessions/:code/tracks
// 커뮤니티: GET /feed · GET /publications/:id · POST /publications · (POST|DELETE) /publications/:id/like
//          · POST /publications/:id/report · GET /me/publications · DELETE /publications/:id
// 식별: 합주=코드(접근권한) / 커뮤니티 쓰기=익명키 헤더 X-Anon-Key(getAnonymousKey). 키 없으면 503(페일클로즈드).
// 실시간 아님 — 클라 polling + optimistic UI. 게시물은 원본 세션과 분리된 "불변 스냅샷".
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';

const PORT = Number(process.env.PORT) || 8080;
const db = new DatabaseSync(process.env.DB_PATH || 'harmony.db');
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS sessions (code TEXT PRIMARY KEY, name TEXT, bpm INTEGER, created_at INTEGER);
  CREATE TABLE IF NOT EXISTS tracks (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT, owner TEXT, events TEXT, created_at INTEGER);
  CREATE INDEX IF NOT EXISTS idx_tracks_code ON tracks(code);
  CREATE TABLE IF NOT EXISTS publications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_key TEXT NOT NULL, owner_name TEXT NOT NULL,
    name TEXT NOT NULL, bpm INTEGER NOT NULL DEFAULT 100,
    snapshot TEXT NOT NULL, duration_ticks INTEGER,
    status TEXT NOT NULL DEFAULT 'public',
    likes_count INTEGER NOT NULL DEFAULT 0, reported_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pub_recent ON publications(status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_pub_popular ON publications(status, likes_count DESC);
  CREATE INDEX IF NOT EXISTS idx_pub_owner ON publications(owner_key);
  CREATE TABLE IF NOT EXISTS likes (pub_id INTEGER NOT NULL, user_key TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (pub_id, user_key));
  CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, pub_id INTEGER NOT NULL, reporter_key TEXT NOT NULL, reason TEXT, created_at INTEGER, UNIQUE (pub_id, reporter_key));
`);

const MAX_PUBLIC_PER_USER = 5; // 개인당 공개곡 한도
const REPORT_HIDE_THRESHOLD = 3; // 신고 N건 → 자동 hidden
const MAX_EVENTS = 4000;
const MAX_NAME = 80;

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 혼동문자(0/O/1/I) 제외
function genCode() {
  let c = '';
  for (let i = 0; i < 6; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return c;
}

function send(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type, x-anon-key',
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

// 익명키(X-Anon-Key) — 커뮤니티 쓰기 식별. 없거나 형식 불량이면 null → 호출부가 503(페일클로즈드).
function anonKey(req) {
  const k = req.headers['x-anon-key'];
  if (typeof k !== 'string') return null;
  const t = k.trim();
  return t.length >= 8 && t.length <= 200 ? t : null;
}

// 간단 in-memory rate limit (키 단위, 분당 한도) — 데모/소규모용. 단일 프로세스 전제.
const rl = new Map();
function rateLimited(idKey) {
  const now = Date.now();
  const e = rl.get(idKey);
  if (!e || now - e.start > 60_000) {
    rl.set(idKey, { start: now, n: 1 });
    return false;
  }
  e.n += 1;
  return e.n > 60;
}

// 공개 응답 행(메타만 — events/owner_key 비노출).
function feedRow(r, liked) {
  return {
    id: r.id,
    name: r.name,
    bpm: r.bpm,
    owner: r.owner_name,
    likesCount: r.likes_count,
    durationTicks: r.duration_ticks,
    createdAt: r.created_at,
    liked: !!liked,
  };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  if (req.method === 'OPTIONS') return send(res, 204, {});

  const mTracks = path.match(/^\/sessions\/([^/]+)\/tracks$/);
  const mSession = path.match(/^\/sessions\/([^/]+)$/);
  const mPub = path.match(/^\/publications\/(\d+)$/);
  const mLike = path.match(/^\/publications\/(\d+)\/like$/);
  const mReport = path.match(/^\/publications\/(\d+)\/report$/);

  try {
    if (req.method === 'GET' && path === '/healthz') {
      return send(res, 200, { ok: true, time: Date.now() });
    }

    // ===== 합주 (기존 — 불변) =====
    if (req.method === 'POST' && path === '/sessions') {
      const { name, bpm, owner, events } = await readBody(req);
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
        db.prepare('INSERT INTO tracks (code, owner, events, created_at) VALUES (?, ?, ?, ?)').run(
          code,
          owner || '익명',
          JSON.stringify(events),
          now,
        );
      }
      return send(res, 201, { code });
    }

    if (req.method === 'POST' && mTracks) {
      const code = mTracks[1];
      if (!db.prepare('SELECT 1 FROM sessions WHERE code = ?').get(code)) {
        return send(res, 404, { error: 'session not found' });
      }
      const { owner, events } = await readBody(req);
      if (!Array.isArray(events)) return send(res, 400, { error: 'events array required' });
      const info = db
        .prepare('INSERT INTO tracks (code, owner, events, created_at) VALUES (?, ?, ?, ?)')
        .run(code, owner || '익명', JSON.stringify(events), Date.now());
      return send(res, 201, { ok: true, trackId: Number(info.lastInsertRowid) });
    }

    if (req.method === 'GET' && mSession) {
      const code = mSession[1];
      const sess = db.prepare('SELECT code, name, bpm, created_at FROM sessions WHERE code = ?').get(code);
      if (!sess) return send(res, 404, { error: 'session not found' });
      const tracks = db
        .prepare('SELECT owner, events, created_at FROM tracks WHERE code = ? ORDER BY id')
        .all(code)
        .map((t) => ({ owner: t.owner, events: JSON.parse(t.events), createdAt: t.created_at }));
      return send(res, 200, { code: sess.code, name: sess.name, bpm: sess.bpm, tracks });
    }

    // ===== 커뮤니티 피드 =====
    // 목록(메타만, events 미포함 — lazy-load). sort=recent|popular
    if (req.method === 'GET' && path === '/feed') {
      const order =
        url.searchParams.get('sort') === 'popular'
          ? 'likes_count DESC, id DESC'
          : 'created_at DESC, id DESC';
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 30, 1), 100);
      const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);
      const owner = url.searchParams.get('owner'); // 작성자 필터(선택)
      const key = anonKey(req); // 좋아요 표시용(선택)
      const where = owner ? "status='public' AND owner_name=?" : "status='public'";
      const filterArgs = owner ? [owner] : [];
      const total = db.prepare(`SELECT COUNT(*) AS c FROM publications WHERE ${where}`).get(...filterArgs).c;
      const rows = db
        .prepare(`SELECT * FROM publications WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`)
        .all(...filterArgs, limit, offset);
      const items = rows.map((r) => {
        const liked = key ? !!db.prepare('SELECT 1 FROM likes WHERE pub_id=? AND user_key=?').get(r.id, key) : false;
        return feedRow(r, liked);
      });
      return send(res, 200, { items, total });
    }

    // 단건(events 포함 — 들어보기/가져오기)
    if (req.method === 'GET' && mPub) {
      const r = db.prepare("SELECT * FROM publications WHERE id=? AND status='public'").get(Number(mPub[1]));
      if (!r) return send(res, 404, { error: 'not found' });
      const key = anonKey(req);
      const liked = key ? !!db.prepare('SELECT 1 FROM likes WHERE pub_id=? AND user_key=?').get(r.id, key) : false;
      return send(res, 200, { ...feedRow(r, liked), events: JSON.parse(r.snapshot) });
    }

    // 게시(스냅샷 복사) — 쓰기=키 필요(페일클로즈드)
    if (req.method === 'POST' && path === '/publications') {
      const key = anonKey(req);
      if (!key) return send(res, 503, { error: 'identity unavailable' });
      if (rateLimited('w:' + key)) return send(res, 429, { error: 'rate limited' });
      const { name, bpm, events, durationTicks, owner } = await readBody(req);
      if (!Array.isArray(events) || events.length === 0) return send(res, 400, { error: 'events required' });
      if (events.length > MAX_EVENTS) return send(res, 400, { error: 'too many events' });
      const cnt = db.prepare("SELECT COUNT(*) AS c FROM publications WHERE owner_key=? AND status='public'").get(key).c;
      if (cnt >= MAX_PUBLIC_PER_USER) return send(res, 409, { error: 'publish limit (5) reached' });
      const info = db
        .prepare('INSERT INTO publications (owner_key, owner_name, name, bpm, snapshot, duration_ticks, created_at) VALUES (?,?,?,?,?,?,?)')
        .run(
          key,
          String(owner || '익명 연주자').slice(0, MAX_NAME),
          String(name || '무제').slice(0, MAX_NAME),
          Number(bpm) || 100,
          JSON.stringify(events),
          Number.isFinite(Number(durationTicks)) ? Number(durationTicks) : null,
          Date.now(),
        );
      return send(res, 201, { id: Number(info.lastInsertRowid) });
    }

    // 좋아요 토글(POST=좋아요 / DELETE=취소) — 쓰기=키 필요, 중복은 UNIQUE PK가 보장
    if (mLike && (req.method === 'POST' || req.method === 'DELETE')) {
      const key = anonKey(req);
      if (!key) return send(res, 503, { error: 'identity unavailable' });
      const id = Number(mLike[1]);
      if (!db.prepare("SELECT 1 FROM publications WHERE id=? AND status='public'").get(id)) {
        return send(res, 404, { error: 'not found' });
      }
      if (req.method === 'POST') {
        const r = db.prepare('INSERT OR IGNORE INTO likes (pub_id, user_key, created_at) VALUES (?,?,?)').run(id, key, Date.now());
        if (r.changes > 0) db.prepare('UPDATE publications SET likes_count = likes_count + 1 WHERE id=?').run(id);
      } else {
        const r = db.prepare('DELETE FROM likes WHERE pub_id=? AND user_key=?').run(id, key);
        if (r.changes > 0) db.prepare('UPDATE publications SET likes_count = MAX(0, likes_count - 1) WHERE id=?').run(id);
      }
      const likesCount = db.prepare('SELECT likes_count FROM publications WHERE id=?').get(id).likes_count;
      return send(res, 200, { likesCount, liked: req.method === 'POST' });
    }

    // 신고 — 임계 N건 자동 hidden
    if (req.method === 'POST' && mReport) {
      const key = anonKey(req);
      if (!key) return send(res, 503, { error: 'identity unavailable' });
      const id = Number(mReport[1]);
      const { reason } = await readBody(req);
      const r = db
        .prepare('INSERT OR IGNORE INTO reports (pub_id, reporter_key, reason, created_at) VALUES (?,?,?,?)')
        .run(id, key, String(reason || '').slice(0, 200), Date.now());
      if (r.changes > 0) {
        db.prepare('UPDATE publications SET reported_count = reported_count + 1 WHERE id=?').run(id);
        const rc = db.prepare('SELECT reported_count FROM publications WHERE id=?').get(id);
        if (rc && rc.reported_count >= REPORT_HIDE_THRESHOLD) {
          db.prepare("UPDATE publications SET status='hidden' WHERE id=?").run(id);
        }
      }
      return send(res, 201, { ok: true });
    }

    // 내 공개곡(5개 한도 표시) — 키 필요
    if (req.method === 'GET' && path === '/me/publications') {
      const key = anonKey(req);
      if (!key) return send(res, 503, { error: 'identity unavailable' });
      const rows = db.prepare("SELECT * FROM publications WHERE owner_key=? AND status != 'deleted' ORDER BY created_at DESC").all(key);
      return send(res, 200, { count: rows.length, limit: MAX_PUBLIC_PER_USER, items: rows.map((r) => feedRow(r, false)) });
    }

    // 삭제(내 것만) — 키 필요
    if (req.method === 'DELETE' && mPub) {
      const key = anonKey(req);
      if (!key) return send(res, 503, { error: 'identity unavailable' });
      const id = Number(mPub[1]);
      const r = db.prepare('DELETE FROM publications WHERE id=? AND owner_key=?').run(id, key);
      if (r.changes === 0) return send(res, 403, { error: 'not owner or not found' });
      db.prepare('DELETE FROM likes WHERE pub_id=?').run(id);
      return send(res, 200, { ok: true });
    }

    return send(res, 404, { error: 'not found' });
  } catch (e) {
    return send(res, 400, { error: e instanceof Error ? e.message : String(e) });
  }
});

server.listen(PORT, () => console.log(`harmony-api listening on :${PORT}`));
