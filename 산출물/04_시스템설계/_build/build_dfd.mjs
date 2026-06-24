import fs from 'node:fs';
import path from 'node:path';
const ICONDIR = 'C:/Users/김민혁/Desktop/dev/appintoss-meetup/산출물/04_시스템설계/아키텍처_아이콘';
const OUTDIR = 'C:/Users/김민혁/Desktop/dev/appintoss-meetup/산출물/04_시스템설계';
const TMP = 'C:/Users/Public/arch_tmp'; fs.mkdirSync(TMP, { recursive: true });
const ICON = { user: 'user.svg', nginx: 'nginx_c.svg', node: 'node_c.svg', sqlite: 'sqlite_c.svg', store: 'localstorage.svg', warning: 'warning.svg' };
const _c = {}; const uri = (id) => { if (!ICON[id]) return null; if (!_c[id]) _c[id] = 'data:image/svg+xml;base64,' + Buffer.from(fs.readFileSync(path.join(ICONDIR, ICON[id]), 'utf8'), 'utf8').toString('base64'); return _c[id]; };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function fitAttr(s, fs, maxw) { let w = 0; for (const ch of String(s)) { w += (ch.codePointAt(0) > 0x2000 ? fs : fs * 0.56); } return w > maxw ? ` textLength="${Math.max(20, Math.floor(maxw))}" lengthAdjust="spacingAndGlyphs"` : ''; }
const FONT = "'Malgun Gothic','Segoe UI',sans-serif";
const C = { ink: '#1E293B', sub: '#64748B', flow: '#334155', cap: '#7C3AED', risk: '#EF4444', ok: '#0D9488' };

function frame(w, h, title, subs) {
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}">`;
  s += `<defs><filter id="sh" x="-6%" y="-6%" width="112%" height="124%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0F172A" flood-opacity="0.12"/></filter>`;
  for (const [k, c] of [['flow', C.flow], ['cap', C.cap], ['risk', C.risk], ['ok', C.ok]]) s += `<marker id="a-${k}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7.5" markerHeight="7.5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${c}"/></marker>`;
  s += `</defs><rect width="${w}" height="${h}" fill="#FFFFFF"/>`;
  s += `<text x="44" y="50" font-size="26" font-weight="800" fill="${C.ink}">${esc(title)}</text>`;
  let yy = 76; for (const ln of subs) { s += `<text x="44" y="${yy}" font-size="13.5" fill="${C.sub}">${esc(ln)}</text>`; yy += 19; }
  return s;
}
function zone(x, y, w, h, label, color) {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${color}0D" stroke="${color}" stroke-width="2" stroke-dasharray="9 6"/>`;
  s += `<rect x="${x + 16}" y="${y - 14}" width="${label.length * 8.4 + 24}" height="28" rx="8" fill="#FFFFFF" stroke="${color}"/>`;
  s += `<text x="${x + 28}" y="${y + 5}" font-size="13" font-weight="800" fill="${color}">${esc(label)}</text>`;
  return s;
}
function icon(x, y, id, sz = 26) { const u = uri(id); return u ? `<image x="${x}" y="${y}" width="${sz}" height="${sz}" href="${u}"/>` : ''; }
function ext(x, y, w, h, title, sub, ic) { // external entity = 사각형
  let s = `<g filter="url(#sh)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#FFFFFF" stroke="#475569" stroke-width="2"/></g>`;
  if (ic) s += icon(x + 14, y + h / 2 - 15, ic, 30);
  s += `<text x="${x + (ic ? 58 : 16)}" y="${y + h / 2 - 4}" font-size="14.5" font-weight="800" fill="${C.ink}"${fitAttr(title, 14.5, w - (ic ? 58 : 16) - 14)}>${esc(title)}</text>`;
  if (sub) s += `<text x="${x + (ic ? 58 : 16)}" y="${y + h / 2 + 16}" font-size="11.5" fill="${C.sub}"${fitAttr(sub, 11.5, w - (ic ? 58 : 16) - 14)}>${esc(sub)}</text>`;
  return s;
}
function proc(cx, cy, r, title, sub, ic, color = '#2563EB') { // process = 원
  let s = `<g filter="url(#sh)"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#FFFFFF" stroke="${color}" stroke-width="2.4"/></g>`;
  if (ic) s += icon(cx - 16, cy - r + 20, ic, 32);
  s += `<text x="${cx}" y="${cy + 6}" font-size="14.5" font-weight="800" fill="${C.ink}" text-anchor="middle"${fitAttr(title, 14.5, 2 * r - 22)}>${esc(title)}</text>`;
  if (sub) s += `<text x="${cx}" y="${cy + 26}" font-size="11" fill="${C.sub}" text-anchor="middle"${fitAttr(sub, 11, 2 * r - 22)}>${esc(sub)}</text>`;
  return s;
}
function store(x, y, w, h, title, sub, ic) { // data store = 양끝 열린 사각형
  let s = `<g filter="url(#sh)"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#FFFFFF" stroke="none"/></g>`;
  s += `<line x1="${x}" y1="${y}" x2="${x + w}" y2="${y}" stroke="#475569" stroke-width="2.2"/><line x1="${x}" y1="${y + h}" x2="${x + w}" y2="${y + h}" stroke="#475569" stroke-width="2.2"/>`;
  s += `<rect x="${x}" y="${y}" width="6" height="${h}" fill="#F1F5F9"/>`;
  if (ic) s += icon(x + 16, y + h / 2 - 13, ic, 26);
  s += `<text x="${x + (ic ? 52 : 16)}" y="${y + h / 2 - 2}" font-size="13.5" font-weight="800" fill="${C.ink}"${fitAttr(title, 13.5, w - (ic ? 52 : 16) - 14)}>${esc(title)}</text>`;
  if (sub) s += `<text x="${x + (ic ? 52 : 16)}" y="${y + h / 2 + 15}" font-size="11" fill="${C.sub}"${fitAttr(sub, 11, w - (ic ? 52 : 16) - 14)}>${esc(sub)}</text>`;
  return s;
}
function flow(x1, y1, x2, y2, label, kind = 'flow', dashed = false, lines) {
  const c = C[kind] || C.flow;
  let s = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="2.4"${dashed ? ' stroke-dasharray="6 5"' : ''} marker-end="url(#a-${kind})"/>`;
  const arr = lines || (label ? [label] : []);
  if (arr.length) { const mx = (x1 + x2) / 2, my = (y1 + y2) / 2; const wpx = Math.max(...arr.map((t) => t.length)) * 6.5 + 16; const bh = arr.length * 15 + 8; s += `<rect x="${mx - wpx / 2}" y="${my - bh / 2}" width="${wpx}" height="${bh}" rx="6" fill="#FFFFFF" stroke="${c}55"/>`; arr.forEach((t, i) => { s += `<text x="${mx}" y="${my - bh / 2 + 16 + i * 15}" font-size="11" font-weight="${i === 0 ? 700 : 400}" fill="${c}" text-anchor="middle">${esc(t)}</text>`; }); }
  return s;
}

function build() {
  const W = 1660, H = 940;
  let s = frame(W, H, '하모니 신뢰경계 데이터 흐름 (DFD)',
    ['무의존·단일 프로세스라 신뢰경계가 2~3겹뿐 = 공격면이 좁다(의도된 설계) · 외부 엔티티 □ / 프로세스 ○ / 데이터스토어 ▭',
     '코드 = 접근권한(capability) · 익명키 = 약한 자기신고 식별 · 인증 없음 = 의도된 데모 범위 · 솔로 = 경계 안 완결(서버 미도달)']);

  // 신뢰경계 존
  s += zone(60, 150, 470, 590, '① 기기 · 토스 WebView (untrusted)', '#EF4444');
  s += zone(610, 300, 300, 300, '② 엣지 · 유일 public 면 (443)', '#0D9488');
  s += zone(990, 250, 600, 430, '③ 앱 · loopback 127.0.0.1', '#F59E0B');

  // 노드
  s += ext(100, 250, 390, 96, '익명 클라이언트', '토스 WebView · 미니앱(SPA)', 'user');
  s += store(150, 540, 300, 76, 'localStorage', '내 곡 (솔로)', 'store');
  s += proc(760, 450, 78, 'nginx', 'TLS 종단 · 443', 'nginx', '#0D9488');
  s += proc(1150, 420, 86, 'Node API', 'node:http · 무의존', 'node', '#F59E0B');
  s += store(1360, 380, 200, 84, 'SQLite .db', '5 테이블', 'sqlite');

  // 솔로 루프(경계 안)
  s += flow(295, 346, 295, 540, '', 'ok');
  s += `<rect x="170" y="424" width="252" height="44" rx="9" fill="#ECFDF5" stroke="${C.ok}"/><text x="296" y="442" font-size="11.5" font-weight="800" fill="${C.ok}" text-anchor="middle">솔로 연주 = 경계 안 완결</text><text x="296" y="458" font-size="10.5" fill="${C.ok}" text-anchor="middle">서버로 흐름 0 (오프라인)</text>`;

  // 합주/공유 흐름 (경계 횡단)
  s += flow(490, 320, 690, 430, '', 'cap', false, ['HTTPS 443 (합주/공유만)', 'author_key · origin_code = capability']);
  s += flow(836, 444, 1066, 424, '', 'flow', false, ['loopback proxy', '+ X-Forwarded-For']);
  s += flow(1236, 420, 1360, 420, 'R / W', 'flow');
  // 응답
  s += flow(1064, 462, 838, 478, '보드·트랙 응답', 'flow', true);

  // 잔여 위험(빨강) — nginx 아래 별도 주석으로 분리(capability 라벨과 겹침 방지)
  s += `<rect x="632" y="556" width="256" height="44" rx="9" fill="#FEF2F2" stroke="${C.risk}"/>`;
  s += `<text x="760" y="575" font-size="11" font-weight="800" fill="${C.risk}" text-anchor="middle">잔여위험 (Known Limitation)</text>`;
  s += `<text x="760" y="591" font-size="10.5" fill="${C.risk}" text-anchor="middle">code 추측·열거 · reporter_key 회전 신고위조</text>`;
  s += `<line x1="760" y1="556" x2="760" y2="530" stroke="${C.risk}" stroke-width="2.4" stroke-dasharray="5 4" marker-end="url(#a-risk)"/>`;

  // 주석 박스
  const ax = 60, ay = 786, aw = 1530, ah = 120;
  s += `<rect x="${ax}" y="${ay}" width="${aw}" height="${ah}" rx="14" fill="#F8FAFC" stroke="#E2E8F0"/>`;
  s += `<text x="${ax + 20}" y="${ay + 28}" font-size="14" font-weight="800" fill="${C.ink}">읽는 법 — "작아서 안전하다"는 의도</text>`;
  const notes = [
    ['#0D9488', '솔로(연주·내 곡)는 신뢰경계 ①을 절대 안 넘는다 → 서버에 의도적으로 "없는 것"을 그린 표기.'],
    ['#7C3AED', '익명키(author_key·anon_key·reporter_key)와 공유코드(origin_code)가 사실상 capability 토큰. 서버는 origin 실재만 검증.'],
    ['#F59E0B', '인증 미도입 = 버그 아님 = 데모 범위 결정. 레이트리밋(IP 버킷)+신고 자동숨김(3건)이 유일한 남용 통제.'],
    ['#EF4444', 'Known Limitation: code 열거·익명키 회전으로 distinct 신고자 위조 가능 — 공개배포 전 보강 대상(정책준수표).'],
  ];
  notes.forEach((n, i) => { const col = i % 2, row = Math.floor(i / 2); const nx = ax + 20 + col * 760, ny = ay + 54 + row * 28; s += `<circle cx="${nx + 4}" cy="${ny - 4}" r="4.5" fill="${n[0]}"/><text x="${nx + 16}" y="${ny}" font-size="12" fill="#334155">${esc(n[1])}</text>`; });

  return s + `</svg>`;
}
const out = build();
fs.writeFileSync(path.join(TMP, 'dfd.html'), `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#fff}svg{display:block}</style>${out}`, 'utf8');
console.log('OK dfd svg/html written');
