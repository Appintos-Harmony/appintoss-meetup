// 데이터모델 ERD — DA# 표기(식별자 PK영역 + 일반속성영역, 식별/비식별 관계, 까마귀발)
// 속성·순서·키 표기를 테이블_정의서.md(=apps/api/server.mjs 스키마)와 1:1 일치시킨다.
import fs from 'node:fs';
import path from 'node:path';
const OUTDIR = path.resolve(import.meta.dirname, '..'); // 산출물/04_시스템설계 (이식성: 사용자 경로 하드코딩 제거)
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function fitAttr(s, fs, maxw) { let w = 0; for (const ch of String(s)) { w += (ch.codePointAt(0) > 0x2000 ? fs : fs * 0.56); } return w > maxw ? ` textLength="${Math.max(20, Math.floor(maxw))}" lengthAdjust="spacingAndGlyphs"` : ''; }
const FONT = "'Malgun Gothic','Segoe UI',sans-serif";
const COL = { ink: '#1E293B', sub: '#64748B', line: '#475569', fk: '#2563EB', uq: '#7C3AED' };

function frame(w, h, title, subs) {
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}">`;
  s += `<defs><filter id="sh" x="-3%" y="-3%" width="106%" height="114%"><feDropShadow dx="0" dy="2" stdDeviation="2.6" flood-color="#0F172A" flood-opacity="0.12"/></filter></defs>`;
  s += `<rect width="${w}" height="${h}" fill="#FFFFFF"/>`;
  s += `<text x="44" y="50" font-size="26" font-weight="800" fill="${COL.ink}">${esc(title)}</text>`;
  let yy = 76; for (const ln of subs) { s += `<text x="44" y="${yy}" font-size="13" fill="${COL.sub}">${esc(ln)}</text>`; yy += 19; }
  return s;
}

const RH = 25, HEADH = 46;
function badge(rx, ty, t) { const c = t === 'FK' ? COL.fk : COL.uq; const bw = t.length * 7 + 10; return `<rect x="${rx - bw}" y="${ty}" width="${bw}" height="15" rx="3.5" fill="${c}1A" stroke="${c}" stroke-width="0.7"/><text x="${rx - bw / 2}" y="${ty + 11.5}" font-size="9" font-weight="800" fill="${c}" text-anchor="middle">${t}</text>`; }
function entityDA(x, y, w, ko, en, pks, attrs, accent) {
  const h = HEADH + 8 + pks.length * RH + 8 + attrs.length * RH + 8;
  let s = `<g filter="url(#sh)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#FFFFFF" stroke="${accent}" stroke-width="1.6"/></g>`;
  s += `<path d="M${x + 10},${y} h${w - 20} a10,10 0 0 1 10,10 v${HEADH - 10} h-${w} v-${HEADH - 10} a10,10 0 0 1 10,-10 z" fill="${accent}"/>`;
  s += `<text x="${x + 14}" y="${y + 20}" font-size="14.5" font-weight="800" fill="#FFFFFF"${fitAttr(ko, 14.5, w - 28)}>${esc(ko)}</text>`;
  s += `<text x="${x + 14}" y="${y + 37}" font-size="11" fill="#FFFFFF" opacity="0.92"${fitAttr(en, 11, w - 28)}>${esc(en)}</text>`;
  let ry = y + HEADH + 8;
  s += `<rect x="${x + 1}" y="${ry - 5}" width="${w - 2}" height="${pks.length * RH + 4}" fill="${accent}12"/>`;
  for (const p of pks) {
    s += `<text x="${x + 16}" y="${ry + 14}" font-size="12.5" font-weight="800" fill="${COL.ink}" text-decoration="underline"${fitAttr(p.f, 12.5, w - 96)}>${esc(p.f)}</text>`;
    if (p.tag) s += badge(x + w - 14, ry + 1, p.tag);
    ry += RH;
  }
  s += `<line x1="${x}" y1="${ry + 1}" x2="${x + w}" y2="${ry + 1}" stroke="${accent}" stroke-width="1.4"/>`;
  ry += 9;
  for (const a of attrs) {
    s += `<text x="${x + 16}" y="${ry + 14}" font-size="12" fill="${a.note ? COL.sub : '#334155'}"${fitAttr(a.f, 12, w - 96)}>${esc(a.f)}</text>`;
    if (a.tag) s += badge(x + w - 14, ry + 1, a.tag);
    ry += RH;
  }
  return { svg: s, x, y, w, h, cx: x + w / 2, cy: y + h / 2, right: x + w, bottom: y + h };
}

// 관계: 실선=식별, 점선=비식별 · 부모쪽 바(1) · 자식쪽 까마귀발(N)
function relDA(px, py, cx, cy, identifying, label, lx, ly) {
  const dx = cx - px, dy = cy - py; const L = Math.hypot(dx, dy) || 1; const ux = dx / L, uy = dy / L; const ex = -uy, ey = ux;
  const dash = identifying ? '' : ' stroke-dasharray="6 4"'; const c = COL.line;
  const sx = px + ux * 16, sy = py + uy * 16, lx2 = cx - ux * 17, ly2 = cy - uy * 17;
  let s = `<line x1="${sx}" y1="${sy}" x2="${lx2}" y2="${ly2}" stroke="${c}" stroke-width="1.8"${dash}/>`;
  const bx = px + ux * 15, by = py + uy * 15;
  s += `<line x1="${bx + ex * 7}" y1="${by + ey * 7}" x2="${bx - ex * 7}" y2="${by - ey * 7}" stroke="${c}" stroke-width="1.9"/>`;
  s += `<line x1="${lx2}" y1="${ly2}" x2="${cx}" y2="${cy}" stroke="${c}" stroke-width="1.7"/>`;
  s += `<line x1="${lx2}" y1="${ly2}" x2="${cx + ex * 8}" y2="${cy + ey * 8}" stroke="${c}" stroke-width="1.7"/>`;
  s += `<line x1="${lx2}" y1="${ly2}" x2="${cx - ex * 8}" y2="${cy - ey * 8}" stroke="${c}" stroke-width="1.7"/>`;
  if (label) { const mx = lx ?? (px + cx) / 2, my = ly ?? (py + cy) / 2; const wpx = label.length * 6.6 + 14; s += `<rect x="${mx - wpx / 2}" y="${my - 10}" width="${wpx}" height="18" rx="5" fill="#FFFFFF" stroke="#E2E8F0"/><text x="${mx}" y="${my + 3}" font-size="10.5" fill="#475569" text-anchor="middle">${esc(label)}</text>`; }
  return s;
}

function build() {
  const W = 1720, H = 1130;
  let s = frame(W, H, '하모니 데이터 모델 (ERD · DA# 표기)',
    ['개체 = 식별자(PK) 영역[상단·밑줄] + 일반속성 영역[하단] · 실선 = 식별 관계(FK가 자식 PK 구성) · 점선 = 비식별 관계',
     '까마귀발 = N(다) · 바 = 1(하나) · 복합키(좋아요·신고)는 대리키 없이 식별 관계 · 속성 = 테이블_정의서.md 순서·이름 1:1']);

  // 속성 = 테이블_정의서.md 순서 그대로(컬럼명만, 키/FK 표기). 합쳐 쓰지 않고 1컬럼 1행.
  const ses = entityDA(660, 170, 340, '곡', 'sessions', [{ f: 'code' }], [
    { f: 'name' }, { f: 'bpm' }, { f: 'created_at' }, { f: 'published' }, { f: 'author' }, { f: 'author_key' },
    { f: 'origin_code', tag: 'FK' }, { f: 'play_count' }, { f: 'hidden' }, { f: 'content_hash' }, { f: 'track_count' },
  ], '#4F46E5');
  const trk = entityDA(110, 200, 330, '트랙', 'tracks', [{ f: 'id' }], [
    { f: 'code', tag: 'FK' }, { f: 'owner' }, { f: 'events' }, { f: 'instrument' }, { f: 'style' }, { f: 'author_key' }, { f: 'created_at' },
  ], '#2563EB');
  const rea = entityDA(1250, 175, 330, '좋아요', 'reactions', [{ f: 'code', tag: 'FK' }, { f: 'anon_key' }], [{ f: 'created_at' }], '#DB2777');
  const cmt = entityDA(660, 660, 340, '댓글', 'comments', [{ f: 'id' }], [
    { f: 'code', tag: 'FK' }, { f: 'author_key' }, { f: 'author' }, { f: 'text' }, { f: 'created_at' }, { f: 'reports' }, { f: 'hidden' },
  ], '#0D9488');
  const rep = entityDA(1250, 660, 330, '신고', 'comment_reports', [{ f: 'comment_id', tag: 'FK' }, { f: 'reporter_key' }], [{ f: 'created_at' }], '#D97706');

  // 관계
  let e = '';
  e += relDA(660, 320, 440, 300, false, '비식별 1:N', 540, 296); // 곡 ─< 트랙
  e += relDA(1000, 230, 1250, 228, true, '식별 1:N', 1125, 206);  // 곡 ─< 좋아요
  e += relDA(830, ses.bottom, 830, 660, false, '비식별 1:N', 830, 600); // 곡 ─< 댓글
  e += relDA(1000, 760, 1250, 712, true, '식별 1:N', 1125, 700);  // 댓글 ─< 신고
  // 자기참조(origin_code) — 곡 위 루프, 비식별
  const lcx = ses.cx, top = ses.y;
  e += `<path d="M${lcx + 70},${top} C ${lcx + 70},${top - 52} ${lcx - 70},${top - 52} ${lcx - 70},${top}" fill="none" stroke="${COL.line}" stroke-width="1.8" stroke-dasharray="6 4"/>`;
  // 부모쪽 바(오른쪽), 자식쪽 까마귀발(왼쪽)
  e += `<line x1="${lcx + 63}" y1="${top - 7}" x2="${lcx + 77}" y2="${top - 7}" stroke="${COL.line}" stroke-width="1.9"/>`;
  e += `<line x1="${lcx - 70}" y1="${top - 14}" x2="${lcx - 70}" y2="${top}" stroke="${COL.line}" stroke-width="1.7"/>`;
  e += `<line x1="${lcx - 70}" y1="${top - 14}" x2="${lcx - 78}" y2="${top}" stroke="${COL.line}" stroke-width="1.7"/>`;
  e += `<line x1="${lcx - 70}" y1="${top - 14}" x2="${lcx - 62}" y2="${top}" stroke="${COL.line}" stroke-width="1.7"/>`;
  e += `<rect x="${lcx - 88}" y="${top - 70}" width="176" height="20" rx="6" fill="#F5F3FF" stroke="${COL.uq}"/><text x="${lcx}" y="${top - 56}" font-size="11" font-weight="700" fill="${COL.uq}" text-anchor="middle">origin_code (파생·비식별)</text>`;

  s += e + ses.svg + trk.svg + rea.svg + cmt.svg + rep.svg;

  // users/auth 부재 콜아웃
  const mx = 110, my = 500, mw = 330, mh = 150;
  s += `<rect x="${mx}" y="${my}" width="${mw}" height="${mh}" rx="10" fill="#FFF7ED" stroke="#FB923C" stroke-width="1.5" stroke-dasharray="7 5"/>`;
  s += `<text x="${mx + 14}" y="${my + 26}" font-size="13.5" font-weight="800" fill="#C2410C">⌀ users / auth 개체 — 없음</text>`;
  [' 회원·세션·토큰 개체가 모델에 부재.', ' 식별 = 익명키 컬럼만(author_key ·', ' anon_key · reporter_key) = 자기신고.', ' → 인증 없음 = 의도된 데모 범위.'].forEach((t, i) => { s += `<text x="${mx + 14}" y="${my + 50 + i * 22}" font-size="12" fill="#9A3412">${esc(t)}</text>`; });

  // 범례
  const gy = 960; let gx = 110;
  s += `<rect x="${gx}" y="${gy}" width="1500" height="120" rx="12" fill="#F8FAFC" stroke="#E2E8F0"/>`;
  s += `<text x="${gx + 20}" y="${gy + 28}" font-size="13.5" font-weight="800" fill="${COL.ink}">DA# 표기 범례</text>`;
  // 식별/비식별 선
  s += `<line x1="${gx + 30}" y1="${gy + 56}" x2="${gx + 110}" y2="${gy + 56}" stroke="${COL.line}" stroke-width="1.8"/><text x="${gx + 122}" y="${gy + 60}" font-size="12" fill="#334155">실선 = 식별 관계 (FK가 자식 PK 구성: 좋아요·신고)</text>`;
  s += `<line x1="${gx + 30}" y1="${gy + 84}" x2="${gx + 110}" y2="${gy + 84}" stroke="${COL.line}" stroke-width="1.8" stroke-dasharray="6 4"/><text x="${gx + 122}" y="${gy + 88}" font-size="12" fill="#334155">점선 = 비식별 관계 (FK가 일반속성: 트랙·댓글·자기참조)</text>`;
  // 까마귀발/바
  const kx = gx + 560;
  s += `<line x1="${kx + 40}" y1="${gy + 56}" x2="${kx}" y2="${gy + 56}" stroke="${COL.line}" stroke-width="1.7"/><line x1="${kx}" y1="${gy + 56}" x2="${kx + 10}" y2="${gy + 49}" stroke="${COL.line}" stroke-width="1.7"/><line x1="${kx}" y1="${gy + 56}" x2="${kx + 10}" y2="${gy + 63}" stroke="${COL.line}" stroke-width="1.7"/><text x="${kx + 52}" y="${gy + 60}" font-size="12" fill="#334155">까마귀발 = N (다)</text>`;
  s += `<line x1="${kx}" y1="${gy + 84}" x2="${kx + 40}" y2="${gy + 84}" stroke="${COL.line}" stroke-width="1.7"/><line x1="${kx + 30}" y1="${gy + 77}" x2="${kx + 30}" y2="${gy + 91}" stroke="${COL.line}" stroke-width="1.9"/><text x="${kx + 52}" y="${gy + 88}" font-size="12" fill="#334155">바 = 1 (하나)</text>`;
  // PK/FK 표기
  const bx2 = gx + 980;
  s += `<text x="${bx2}" y="${gy + 60}" font-size="12" fill="#334155"><tspan text-decoration="underline" font-weight="800">밑줄</tspan> = 식별자(PK) · 상단 영역</text>`;
  s += badge(bx2 + 250, gy + 50, 'FK') + `<text x="${bx2 + 258}" y="${gy + 60}" font-size="12" fill="#334155">외래키</text>`;
  s += `<text x="${bx2}" y="${gy + 88}" font-size="12" fill="#334155">개체명: 한글(영문) · 속성 = 테이블_정의서.md 컬럼(순서·이름 1:1)</text>`;

  return s + `</svg>`;
}
const out = build();
fs.writeFileSync(path.join(OUTDIR, '하모니_데이터모델_ERD.svg'), `<?xml version="1.0" encoding="UTF-8"?>\n${out}\n`, 'utf8');
console.log('OK erd(DA#) SVG written ·', path.join(OUTDIR, '하모니_데이터모델_ERD.svg'));
