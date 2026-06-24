// 하모니 공유 백엔드 (비동기 합주 "얹기" + 커뮤니티 공유 보드). Node 내장 모듈만 — node:http + node:sqlite (무의존성).
// 친구공유(code=접근) + 커뮤니티 보드(published 공개 목록 + 출처 강제 파생 + 코멘트).
// 엔드포인트: GET /healthz · GET /community · POST /sessions · GET /sessions/:code · POST /sessions/:code/tracks
//             · GET|POST /sessions/:code/comments · POST /sessions/:code/comments/:id/report · POST /sessions/:code/hide
// 인증 없음(code=접근, author_key=클라 자기신고 약한 소유권 — 데모 한정). 식별=클라 getAnonymousKey/닉네임. 실시간 아님(1.5s polling).
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';

const PORT = Number(process.env.PORT) || 8080;
const db = new DatabaseSync(process.env.DB_PATH || 'harmony.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (code TEXT PRIMARY KEY, name TEXT, bpm INTEGER, created_at INTEGER);
  CREATE TABLE IF NOT EXISTS tracks (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT, owner TEXT, events TEXT, created_at INTEGER);
  CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT, author_key TEXT, author TEXT, text TEXT, created_at INTEGER, reports INTEGER DEFAULT 0, hidden INTEGER DEFAULT 0);
  CREATE TABLE IF NOT EXISTS comment_reports (comment_id INTEGER, reporter_key TEXT, created_at INTEGER, UNIQUE(comment_id, reporter_key));
  CREATE TABLE IF NOT EXISTS reactions (code TEXT, anon_key TEXT, created_at INTEGER, UNIQUE(code, anon_key));
`);
// 멱등 컬럼 추가(기존 DB 호환: 없으면 추가, 있으면 무시).
const MIGRATIONS = [
  'ALTER TABLE tracks ADD COLUMN instrument TEXT',
  'ALTER TABLE tracks ADD COLUMN style TEXT',
  'ALTER TABLE tracks ADD COLUMN author_key TEXT',
  'ALTER TABLE sessions ADD COLUMN published INTEGER DEFAULT 0',
  'ALTER TABLE sessions ADD COLUMN author TEXT',
  'ALTER TABLE sessions ADD COLUMN author_key TEXT',
  'ALTER TABLE sessions ADD COLUMN origin_code TEXT',
  'ALTER TABLE sessions ADD COLUMN play_count INTEGER DEFAULT 0',
  'ALTER TABLE sessions ADD COLUMN hidden INTEGER DEFAULT 0',
  'ALTER TABLE sessions ADD COLUMN content_hash TEXT', // 콘텐츠 중복방지(첫 트랙 해시). origin 없는 원곡 publish에만 사용.
  'ALTER TABLE sessions ADD COLUMN track_count INTEGER', // 중복방지 키 보강 — 트랙 수가 다르면 다른 곡(멀티트랙 collapse 방지).
];
for (const m of MIGRATIONS) {
  try { db.exec(m); } catch { /* 이미 존재 */ }
}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_board ON sessions(published, created_at)'); } catch { /* noop */ }
try { db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_dedup ON sessions(author_key, content_hash, published, hidden)'); } catch { /* noop */ }

// 혼동 문자(0/O/1/I) 제외한 코드.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genCode() {
  let c = '';
  for (let i = 0; i < 6; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return c;
}

// 입력 검증(데모는 무인증 — code=접근권한. 최소 방어로 오염 payload 차단).
const VALID_INSTRUMENTS = new Set(['piano', 'guitar', 'bass', 'drum']);
const MAX_TRACKS = 16;
// 서로 다른 신고자 N명 누적 시 댓글 자동 숨김. 변경은 신규 신고부터 적용(기존 누적 소급 없음).
// 신고자 식별 = 서버 도출 IP(XFF 하드닝 전제)라 클라 author_key 회전으로 1인이 distinct N명을 위조할 수 없다(Codex P0 수정).
// 한계: 프록시 뒤 공유 IP에선 다른 사용자가 한 버킷으로 묶일 수 있음(OQ-B·DECISION-001 정책 판정 대상).
const REPORT_HIDE_THRESHOLD = 3;
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

// 콘텐츠 해시(중복방지용). 키 순서·표현 차이에 무관하도록 결정적 직렬화 후 sha1 prefix.
// 첫 트랙 events + instrument + style 기준(리허설 FB2: 실DB상 사용자의 '같은 곡'은 첫 트랙 동일).
function stableStringify(v) {
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
  return JSON.stringify(v);
}
function firstTrackHash(events, instrument, style) {
  const norm = stableStringify({ events: events ?? [], instrument: instrument ?? null, style: style ?? null });
  return createHash('sha1').update(norm).digest('hex').slice(0, 16);
}

// UGC 텍스트 최소 정화: trim·제어문자 제거·길이 제한. 링크/연락처는 거부(PII·스팸 최소 방어).
const URL_RE = /(https?:\/\/|www\.)/i;
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE_RE = /\d[\d\s-]{8,}\d/;
function cleanText(s, max) {
  if (typeof s !== 'string') return { ok: false };
  const t = s.replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  if (!t) return { ok: false, reason: 'empty' };
  if (URL_RE.test(t) || EMAIL_RE.test(t) || PHONE_RE.test(t)) return { ok: false, reason: 'pii' };
  return { ok: true, text: t };
}

// 클라이언트 IP(레이트리밋 버킷). 기본은 소켓 주소만 사용 — 클라가 X-Forwarded-For를 위조해도
// 레이트리밋을 우회할 수 없다(Codex P0). 신뢰 프록시(TRUST_PROXY=1, 로컬 nginx 뒤) 환경에서만
// 프록시가 세팅한 X-Real-IP / nginx가 remote_addr로 덮어쓴 단일 XFF의 마지막 값을 신뢰한다.
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
function clientIp(req) {
  if (TRUST_PROXY) {
    const real = req.headers['x-real-ip'];
    if (typeof real === 'string' && real.trim()) return real.trim();
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length) return xff.split(',').pop().trim();
  }
  return req.socket.remoteAddress || 'anon';
}
// 레이트리밋(데모 한정, 메모리). IP당 분당 N건. 자기신고 author_key가 아니라 IP로 버킷팅해 키 회전 우회를 막는다.
const RATE = new Map();
function rateOk(key, limit) {
  const now = Date.now();
  const arr = (RATE.get(key) || []).filter((t) => now - t < 60_000);
  if (arr.length >= limit) { RATE.set(key, arr); return false; }
  arr.push(now);
  RATE.set(key, arr);
  return true;
}
// 멱등 토큰(데모 한정, 메모리). token -> {code, at}.
const IDEMP = new Map();
// 메모리 바운드: 만료 레이트버킷(60s)·멱등토큰(10분)을 주기적으로 정리(데모 한정).
setInterval(() => {
  const now = Date.now();
  for (const [k, arr] of RATE) {
    const live = arr.filter((t) => now - t < 60_000);
    if (live.length) RATE.set(k, live); else RATE.delete(k);
  }
  for (const [t, v] of IDEMP) {
    if (now - v.at > 10 * 60_000) IDEMP.delete(t);
  }
}, 5 * 60_000).unref();

function send(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*', // 데모 한정 — production은 오리진 allowlist(사람 게이트)
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type, x-anon-key',
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const len = Number(req.headers['content-length'] || 0);
    if (len > 1_000_000) { req.destroy(); return reject(new Error('payload too large')); } // 선검사 후 즉시 연결 종료
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1_000_000) { req.destroy(); reject(new Error('payload too large')); }
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

const sessionExists = (code) => !!db.prepare('SELECT 1 FROM sessions WHERE code = ?').get(code);
const trackCount = (code) => db.prepare('SELECT COUNT(*) n FROM tracks WHERE code = ?').get(code).n;

// 콜드스타트 시드곡(보드 빈 화면 방지). 고정 code라 재기동 시 중복 안 됨.
function seed() {
  const SEED = [
    { code: 'SEED01', name: '여름밤 코드', author: '토스밴드',
      events: [
        { tick: 0, phase: 'on', chord: 'C', source: 'touch' }, { tick: 16, phase: 'off', chord: 'C', source: 'touch' },
        { tick: 16, phase: 'on', chord: 'G', source: 'touch' }, { tick: 32, phase: 'off', chord: 'G', source: 'touch' },
        { tick: 32, phase: 'on', chord: 'Am', source: 'touch' }, { tick: 48, phase: 'off', chord: 'Am', source: 'touch' },
        { tick: 48, phase: 'on', chord: 'F', source: 'touch' }, { tick: 64, phase: 'off', chord: 'F', source: 'touch' },
      ] },
    { code: 'SEED02', name: '느린 발라드 4코드', author: '하모니',
      events: [
        { tick: 0, phase: 'on', chord: 'Am', source: 'touch' }, { tick: 16, phase: 'off', chord: 'Am', source: 'touch' },
        { tick: 16, phase: 'on', chord: 'F', source: 'touch' }, { tick: 32, phase: 'off', chord: 'F', source: 'touch' },
        { tick: 32, phase: 'on', chord: 'C', source: 'touch' }, { tick: 48, phase: 'off', chord: 'C', source: 'touch' },
        { tick: 48, phase: 'on', chord: 'G', source: 'touch' }, { tick: 64, phase: 'off', chord: 'G', source: 'touch' },
      ] },
  ];
  const now = Date.now();
  for (const s of SEED) {
    if (sessionExists(s.code)) continue;
    db.prepare('INSERT INTO sessions (code, name, bpm, created_at, published, author, author_key) VALUES (?, ?, ?, ?, 1, ?, ?)')
      .run(s.code, s.name, 100, now, s.author, 'seed');
    db.prepare('INSERT INTO tracks (code, owner, events, instrument, style, author_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(s.code, s.author, JSON.stringify(s.events), 'piano', 'grand', 'seed', now);
  }
}
seed();

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const ip = clientIp(req);
  if (req.method === 'OPTIONS') return send(res, 204, {});

  try {
    if (req.method === 'GET' && path === '/healthz') {
      return send(res, 200, { ok: true, time: Date.now() });
    }

    // 커뮤니티 보드: published & 안숨김, 최신순, 커서 (created_at, code) 복합, 메타만(events 제외).
    if (req.method === 'GET' && path === '/community') {
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 20, 1), 50);
      const beforeAt = url.searchParams.get('beforeAt');
      const beforeCode = url.searchParams.get('beforeCode');
      // 내 좋아요 여부(liked)용 익명키. x-anon-key 헤더 우선(URL 쿼리·프록시 로그 노출 방지), ?me=는 호환용.
      const meHeader = req.headers['x-anon-key'];
      const me = (typeof meHeader === 'string' && meHeader) ? meHeader : url.searchParams.get('me');
      const meKey = typeof me === 'string' && me ? me.slice(0, 80) : null;
      let rows;
      if (beforeAt && beforeCode) {
        rows = db.prepare(
          `SELECT code, name, author, origin_code, play_count, created_at FROM sessions
           WHERE published = 1 AND hidden = 0 AND (created_at < ? OR (created_at = ? AND code < ?))
           ORDER BY created_at DESC, code DESC LIMIT ?`,
        ).all(Number(beforeAt), Number(beforeAt), beforeCode, limit);
      } else {
        rows = db.prepare(
          `SELECT code, name, author, origin_code, play_count, created_at FROM sessions
           WHERE published = 1 AND hidden = 0 ORDER BY created_at DESC, code DESC LIMIT ?`,
        ).all(limit);
      }
      const items = rows.map((s) => {
        const origin = s.origin_code ? db.prepare('SELECT name, author FROM sessions WHERE code = ?').get(s.origin_code) : null;
        return {
          code: s.code, name: s.name, author: s.author || '익명',
          trackCount: trackCount(s.code),
          commentCount: db.prepare('SELECT COUNT(*) n FROM comments WHERE code = ? AND hidden = 0').get(s.code).n,
          playCount: s.play_count || 0,
          forkCount: db.prepare('SELECT COUNT(*) n FROM sessions WHERE origin_code = ? AND published = 1 AND hidden = 0').get(s.code).n,
          likeCount: db.prepare('SELECT COUNT(*) n FROM reactions WHERE code = ?').get(s.code).n,
          liked: meKey ? !!db.prepare('SELECT 1 FROM reactions WHERE code = ? AND anon_key = ?').get(s.code, meKey) : false,
          originCode: s.origin_code || null,
          originName: origin ? origin.name : null,
          originAuthor: origin ? (origin.author || '익명') : null,
          createdAt: s.created_at,
        };
      });
      return send(res, 200, { items });
    }

    if (req.method === 'POST' && path === '/sessions') {
      const body = await readBody(req);
      const { name, bpm, owner, events, instrument, style, published, author, author_key, origin_code, track_count, idempotencyToken } = body;
      const key = (typeof author_key === 'string' && author_key) ? author_key.slice(0, 80) : ip;

      // 멱등 토큰은 요청 주체(author_key/IP)별로 스코프 → 타인이 같은 토큰을 재사용해 내 code를 받지 못한다(Codex MED).
      const idemKey = (typeof idempotencyToken === 'string' && idempotencyToken) ? key + ':' + idempotencyToken.slice(0, 120) : null;
      if (idemKey && IDEMP.has(idemKey)) {
        return send(res, 200, { code: IDEMP.get(idemKey).code, idempotent: true });
      }
      if (!rateOk('pub:' + ip, 12)) return send(res, 429, { error: 'rate limited' });
      if (events !== undefined && badEvents(events)) return send(res, 400, { error: 'invalid events' });
      if (!okInstrument(instrument)) return send(res, 400, { error: 'invalid instrument' });
      const isPublished = published ? 1 : 0;
      if (isPublished && !(Array.isArray(events) && events.length)) return send(res, 400, { error: 'published needs events' });
      // 출처 강제: origin_code가 오면 실재 검증(없으면 400). INSERT-only(여기서만 기록).
      let origin = null;
      if (origin_code != null) {
        if (typeof origin_code !== 'string' || !sessionExists(origin_code)) return send(res, 400, { error: 'invalid origin_code' });
        origin = origin_code;
      }
      let nm = '하모니 세션';
      if (isPublished) {
        const c = cleanText(name, 40);
        if (!c.ok) return send(res, 400, { error: 'invalid name', reason: c.reason });
        nm = c.text;
      } else {
        nm = clip(name, 40, '하모니 세션');
      }
      // 콘텐츠 중복방지(FB2): origin 없는 원곡 publish + 실제 클라 키일 때만. 같은 (author_key, 첫트랙 해시)가
      // 이미 published·미숨김으로 있으면 새 세션을 만들지 않고 기존 code를 멱등 반환. 파생(origin 있음)은 우회.
      // SELECT~INSERT~COMMIT 사이에 await가 없어 node:sqlite 동기 API로 원자적이다(레이스 없음).
      const hasClientKey = typeof author_key === 'string' && !!author_key;
      const contentHash = isPublished ? firstTrackHash(events, instrument, style) : null;
      const tc = Number.isInteger(track_count) && track_count > 0 ? track_count : 1; // 클라가 알려주는 전체 레이어 수
      if (isPublished && origin === null && hasClientKey) {
        // 첫 트랙 해시 + 트랙 수까지 같아야 dedup → 레이어를 더 얹어 재게시한 곡(트랙 수 다름)은 collapse되지 않음(#6/#7).
        const dup = db.prepare(
          'SELECT code FROM sessions WHERE author_key = ? AND content_hash = ? AND track_count = ? AND published = 1 AND hidden = 0 AND origin_code IS NULL LIMIT 1',
        ).get(key, contentHash, tc);
        if (dup) {
          if (idemKey) IDEMP.set(idemKey, { code: dup.code, at: Date.now() }); // dedup 경로도 멱등토큰 등록(#15)
          return send(res, 200, { code: dup.code, deduped: true });
        }
      }
      let code = genCode();
      while (sessionExists(code)) code = genCode();
      const now = Date.now();
      db.exec('BEGIN');
      try {
        db.prepare('INSERT INTO sessions (code, name, bpm, created_at, published, author, author_key, origin_code, content_hash, track_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(code, nm, Number(bpm) || 100, now, isPublished, clip(author, 60, '익명'), key, origin, contentHash, isPublished ? tc : null);
        if (Array.isArray(events) && events.length) {
          db.prepare('INSERT INTO tracks (code, owner, events, instrument, style, author_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(code, clip(owner, 60, '익명'), JSON.stringify(events), instrument || null, clip(style, 40, null), key, now);
        }
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
      if (idemKey) IDEMP.set(idemKey, { code, at: now });
      return send(res, 201, { code });
    }

    // 신고: (id AND code) 검증, 신고자당 1회(UNIQUE), 누적 3건 자동 숨김.
    const mReport = path.match(/^\/sessions\/([^/]+)\/comments\/(\d+)\/report$/);
    if (req.method === 'POST' && mReport) {
      const code = mReport[1];
      const cid = Number(mReport[2]);
      if (!rateOk('rpt:' + ip, 30)) return send(res, 429, { error: 'rate limited' });
      await readBody(req); // body 소비. 자기신고 author_key는 신고자 식별에 쓰지 않는다.
      // 신고자 = 서버 도출 IP. 클라 author_key 회전으로 distinct 신고자를 위조해 자동숨김을 트리거하지 못한다(Codex P0).
      const reporter = ip;
      const c = db.prepare('SELECT id FROM comments WHERE id = ? AND code = ?').get(cid, code);
      if (!c) return send(res, 404, { error: 'comment not found' });
      const ins = db.prepare('INSERT OR IGNORE INTO comment_reports (comment_id, reporter_key, created_at) VALUES (?, ?, ?)').run(cid, reporter, Date.now());
      if (ins.changes) {
        const n = db.prepare('SELECT COUNT(*) n FROM comment_reports WHERE comment_id = ?').get(cid).n;
        db.prepare('UPDATE comments SET reports = ?, hidden = ? WHERE id = ?').run(n, n >= REPORT_HIDE_THRESHOLD ? 1 : 0, cid);
      }
      return send(res, 200, { ok: true });
    }

    const mComments = path.match(/^\/sessions\/([^/]+)\/comments$/);
    if (mComments) {
      const code = mComments[1];
      const cs = db.prepare('SELECT hidden FROM sessions WHERE code = ?').get(code);
      if (!cs || cs.hidden) return send(res, 404, { error: 'session not found' }); // 숨김 세션엔 코멘트 비공개
      if (req.method === 'GET') {
        const rows = db.prepare('SELECT id, author, text, created_at FROM comments WHERE code = ? AND hidden = 0 ORDER BY created_at DESC LIMIT 100').all(code);
        return send(res, 200, { comments: rows.map((r) => ({ id: r.id, author: r.author || '익명', text: r.text, createdAt: r.created_at })) });
      }
      if (req.method === 'POST') {
        const { text, author, author_key } = await readBody(req);
        const key = (typeof author_key === 'string' && author_key) ? author_key.slice(0, 80) : ip;
        if (!rateOk('cmt:' + ip, 20)) return send(res, 429, { error: 'rate limited' });
        const c = cleanText(text, 200);
        if (!c.ok) return send(res, 400, { error: 'invalid text', reason: c.reason });
        // 멱등: 같은 author_key+text 60초 내 중복 무시.
        const dup = db.prepare('SELECT id FROM comments WHERE code = ? AND author_key = ? AND text = ? AND created_at > ?').get(code, key, c.text, Date.now() - 60_000);
        if (dup) return send(res, 200, { id: dup.id, deduped: true });
        const info = db.prepare('INSERT INTO comments (code, author_key, author, text, created_at) VALUES (?, ?, ?, ?, ?)')
          .run(code, key, clip(author, 60, '익명'), c.text, Date.now());
        return send(res, 201, { id: Number(info.lastInsertRowid) });
      }
    }

    const mTracks = path.match(/^\/sessions\/([^/]+)\/tracks$/);
    if (req.method === 'POST' && mTracks) {
      const code = mTracks[1];
      const sess = db.prepare('SELECT author_key, published, hidden FROM sessions WHERE code = ?').get(code);
      if (!sess || sess.hidden) return send(res, 404, { error: 'session not found' });
      if (trackCount(code) >= MAX_TRACKS) return send(res, 409, { error: 'too many tracks' });
      const { owner, events, instrument, style, author_key } = await readBody(req);
      const key = (typeof author_key === 'string' && author_key) ? author_key.slice(0, 80) : ip;
      if (!rateOk('trk:' + ip, 30)) return send(res, 429, { error: 'rate limited' });
      // 공개(published) 세션은 소유자만 트랙 추가 가능 — 공개 code로 타인 곡을 오염시키지 못한다(Codex P0).
      // 파생은 새 POST /sessions + origin_code로. 비공개(친구공유 code=접근)는 '얹기' 협업 유지.
      if (sess.published && (sess.author_key === 'seed' || !sess.author_key || sess.author_key !== key)) {
        return send(res, 403, { error: 'published sessions: only owner can add tracks; fork via origin_code' });
      }
      if (badEvents(events)) return send(res, 400, { error: 'invalid events' });
      if (!okInstrument(instrument)) return send(res, 400, { error: 'invalid instrument' });
      const info = db.prepare('INSERT INTO tracks (code, owner, events, instrument, style, author_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(code, clip(owner, 60, '익명'), JSON.stringify(events), instrument || null, clip(style, 40, null), key, Date.now());
      return send(res, 201, { ok: true, trackId: Number(info.lastInsertRowid) });
    }

    // 좋아요 토글: anon_key당 1회(UNIQUE), 토글 INSERT/DELETE. IP 레이트리밋. 반환 {liked, count}.
    const mLike = path.match(/^\/sessions\/([^/]+)\/like$/);
    if (req.method === 'POST' && mLike) {
      const code = mLike[1];
      if (!rateOk('like:' + ip, 60)) return send(res, 429, { error: 'rate limited' });
      const { author_key } = await readBody(req);
      const key = (typeof author_key === 'string' && author_key) ? author_key.slice(0, 80) : ip;
      const ls = db.prepare('SELECT hidden FROM sessions WHERE code = ?').get(code);
      if (!ls || ls.hidden) return send(res, 404, { error: 'session not found' }); // 숨김 세션엔 좋아요 불가
      const existing = db.prepare('SELECT 1 FROM reactions WHERE code = ? AND anon_key = ?').get(code, key);
      let liked;
      if (existing) {
        db.prepare('DELETE FROM reactions WHERE code = ? AND anon_key = ?').run(code, key);
        liked = false;
      } else {
        db.prepare('INSERT OR IGNORE INTO reactions (code, anon_key, created_at) VALUES (?, ?, ?)').run(code, key, Date.now());
        liked = true;
      }
      const count = db.prepare('SELECT COUNT(*) n FROM reactions WHERE code = ?').get(code).n;
      return send(res, 200, { liked, count });
    }

    // 작성자 best-effort 숨김(세션·이름도 신고/내림 대상).
    const mHide = path.match(/^\/sessions\/([^/]+)\/hide$/);
    if (req.method === 'POST' && mHide) {
      const code = mHide[1];
      const { author_key } = await readBody(req);
      const s = db.prepare('SELECT author_key FROM sessions WHERE code = ?').get(code);
      if (!s) return send(res, 404, { error: 'session not found' });
      if (s.author_key === 'seed') return send(res, 403, { error: 'cannot hide seed' });
      if (s.author_key && author_key && s.author_key === author_key) {
        db.prepare('UPDATE sessions SET hidden = 1 WHERE code = ?').run(code);
        return send(res, 200, { ok: true });
      }
      return send(res, 403, { error: 'not owner' });
    }

    const mSession = path.match(/^\/sessions\/([^/]+)$/);
    if (req.method === 'GET' && mSession) {
      const code = mSession[1];
      const sess = db.prepare('SELECT code, name, bpm, created_at, origin_code, hidden FROM sessions WHERE code = ?').get(code);
      if (!sess || sess.hidden) return send(res, 404, { error: 'session not found' }); // 숨김 세션은 공개 GET 차단(Codex MED)
      db.prepare('UPDATE sessions SET play_count = COALESCE(play_count, 0) + 1 WHERE code = ?').run(code);
      const tracks = db
        .prepare('SELECT owner, events, instrument, style, created_at FROM tracks WHERE code = ? ORDER BY id')
        .all(code)
        .map((t) => ({ owner: t.owner, events: JSON.parse(t.events), instrument: t.instrument || undefined, style: t.style || undefined, createdAt: t.created_at }));
      const origin = sess.origin_code ? db.prepare('SELECT name, author FROM sessions WHERE code = ?').get(sess.origin_code) : null;
      return send(res, 200, {
        code: sess.code, name: sess.name, bpm: sess.bpm, tracks,
        likeCount: db.prepare('SELECT COUNT(*) n FROM reactions WHERE code = ?').get(code).n,
        originCode: sess.origin_code || null,
        originName: origin ? origin.name : null,
        originAuthor: origin ? (origin.author || '익명') : null,
      });
    }

    return send(res, 404, { error: 'not found' });
  } catch (e) {
    return send(res, 400, { error: e instanceof Error ? e.message : String(e) });
  }
});

// 기본 바인드는 127.0.0.1 — 같은 호스트의 nginx 리버스프록시만 접근 가능(8080 외부 직접 노출·X-Real-IP spoof 차단, Codex R039 조건).
// 다른 토폴로지가 필요하면 HOST로 명시(예: HOST=0.0.0.0). production은 127.0.0.1 유지 권장.
const HOST = process.env.HOST || '127.0.0.1';
server.listen(PORT, HOST, () => console.log(`harmony-api listening on ${HOST}:${PORT}`));
