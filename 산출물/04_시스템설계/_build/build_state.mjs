import fs from 'node:fs';
import path from 'node:path';
const OUTDIR = 'C:/Users/김민혁/Desktop/dev/appintoss-meetup/산출물/04_시스템설계';
const TMP = 'C:/Users/Public/arch_tmp'; fs.mkdirSync(TMP, { recursive: true });
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function fitAttr(s, fs, maxw) { let w = 0; for (const ch of String(s)) { w += (ch.codePointAt(0) > 0x2000 ? fs : fs * 0.56); } return w > maxw ? ` textLength="${Math.max(20, Math.floor(maxw))}" lengthAdjust="spacingAndGlyphs"` : ''; }
const FONT = "'Malgun Gothic','Segoe UI',sans-serif";
const C = { ink: '#1E293B', sub: '#64748B', line: '#475569', red: '#EF4444', purple: '#7C3AED' };

function frame(w, h, title, subs) {
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}">`;
  s += `<defs><filter id="sh" x="-5%" y="-5%" width="110%" height="122%"><feDropShadow dx="0" dy="2" stdDeviation="2.6" flood-color="#0F172A" flood-opacity="0.12"/></filter>`;
  for (const [k, c] of [['n', C.line], ['r', C.red], ['p', C.purple]]) s += `<marker id="m-${k}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7.5" markerHeight="7.5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${c}"/></marker>`;
  s += `</defs><rect width="${w}" height="${h}" fill="#FFFFFF"/>`;
  s += `<text x="44" y="50" font-size="26" font-weight="800" fill="${C.ink}">${esc(title)}</text>`;
  let yy = 76; for (const ln of subs) { s += `<text x="44" y="${yy}" font-size="13.5" fill="${C.sub}">${esc(ln)}</text>`; yy += 19; }
  return s;
}
function state(x, y, w, h, title, sub, color = '#334155', fill = '#FFFFFF') {
  let s = `<g filter="url(#sh)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${fill}" stroke="${color}" stroke-width="2.2"/></g>`;
  s += `<text x="${x + w / 2}" y="${y + (sub ? h / 2 - 4 : h / 2 + 5)}" font-size="15" font-weight="800" fill="${C.ink}" text-anchor="middle"${fitAttr(title, 15, w - 24)}>${esc(title)}</text>`;
  if (sub) s += `<text x="${x + w / 2}" y="${y + h / 2 + 17}" font-size="11.5" fill="${C.sub}" text-anchor="middle"${fitAttr(sub, 11.5, w - 24)}>${esc(sub)}</text>`;
  return { svg: s, x, y, w, h, cx: x + w / 2, cy: y + h / 2, right: x + w, bottom: y + h };
}
function dot(x, y) { return `<circle cx="${x}" cy="${y}" r="9" fill="${C.line}"/><circle cx="${x}" cy="${y}" r="14" fill="none" stroke="${C.line}" stroke-width="1.5"/>`; }
function trans(x1, y1, x2, y2, lines, kind = 'n') {
  const c = kind === 'r' ? C.red : kind === 'p' ? C.purple : C.line;
  let s = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${kind === 'r' ? 2.8 : 2.2}" marker-end="url(#m-${kind})"/>`;
  if (lines && lines.length) { const mx = (x1 + x2) / 2, my = (y1 + y2) / 2; const wpx = Math.max(...lines.map((t) => t.length)) * 6.4 + 16; const bh = lines.length * 15 + 8; s += `<rect x="${mx - wpx / 2}" y="${my - bh / 2}" width="${wpx}" height="${bh}" rx="6" fill="#FFFFFF" stroke="${c}66"/>`; lines.forEach((t, i) => { s += `<text x="${mx}" y="${my - bh / 2 + 16 + i * 15}" font-size="11" font-weight="${i === 0 ? 700 : 400}" fill="${c}" text-anchor="middle">${esc(t)}</text>`; }); }
  return s;
}
function selfLoop(st, lines, kind = 'n') {
  const c = kind === 'r' ? C.red : kind === 'p' ? C.purple : C.line;
  const x1 = st.cx - 40, x2 = st.cx + 40, ty = st.y;
  let s = `<path d="M${x1},${ty} C ${x1 - 6},${ty - 56} ${x2 + 6},${ty - 56} ${x2},${ty}" fill="none" stroke="${c}" stroke-width="2.2" marker-end="url(#m-${kind})"/>`;
  const wpx = Math.max(...lines.map((t) => t.length)) * 6.2 + 16, bh = lines.length * 15 + 8;
  s += `<rect x="${st.cx - wpx / 2}" y="${ty - 52 - bh / 2}" width="${wpx}" height="${bh}" rx="6" fill="#FFFFFF" stroke="${c}66"/>`;
  lines.forEach((t, i) => { s += `<text x="${st.cx}" y="${ty - 52 - bh / 2 + 16 + i * 15}" font-size="11" font-weight="${i === 0 ? 700 : 400}" fill="${c}" text-anchor="middle">${esc(t)}</text>`; });
  return s;
}

function build() {
  const W = 1640, H = 940;
  let s = frame(W, H, '하모니 라이프사이클 상태도 (곡 · 댓글 모더레이션)',
    ['UML 상태머신 2개 — 상태 ◻ · 전이 라벨 = 이벤트 [가드] / 동작 · 채워진 점 = 시작 · 빨강 = 유일한 자동 전이',
     '솔로는 업로드 전이 없음(로컬 초안에 머묾) · 폴링(1.5초)이 클라가 상태 변화를 인지하는 유일 수단']);

  // ── ① 곡(세션) 라이프사이클 ──
  s += `<rect x="44" y="108" width="300" height="30" rx="8" fill="#EEF2FF"/><text x="60" y="128" font-size="14" font-weight="800" fill="#4338CA">① 곡(세션) 라이프사이클</text>`;
  s += dot(108, 250);
  const draft = state(150, 208, 220, 86, '로컬 초안', '클라 전용 · localStorage · 서버 0', '#0EA5E9', '#F0F9FF');
  const pub = state(500, 202, 240, 98, '게시됨', 'published=1 · 보드 노출', '#16A34A', '#F0FDF4');
  const fork = state(910, 202, 250, 98, '파생 곡 (자식)', '자식 세션 · 부모 forkCount+1', '#4F46E5', '#EEF2FF');
  const shid = state(500, 372, 240, 76, '숨김 (소유자 수동)', 'hidden=1 · seed 거부', '#DC2626', '#FEF2F2');
  s += trans(122, 250, draft.x, draft.cy);
  s += trans(draft.right, draft.cy, pub.x, pub.cy, ['POST /sessions', '[published] / code 발급']);
  s += selfLoop(pub, ['GET /:code', '/ play_count++']);
  s += trans(pub.right, pub.cy, fork.x, fork.cy, ['타인 publish', '[origin_code=this] / fork+1'], 'p');
  s += trans(pub.cx, pub.bottom, shid.cx, shid.y, ['POST /:code/hide', '[author_key 일치·≠seed]']);

  // ── 구분선 ──
  s += `<line x1="44" y1="498" x2="${W - 44}" y2="498" stroke="#E2E8F0" stroke-width="1.5" stroke-dasharray="6 5"/>`;

  // ── ② 댓글 모더레이션 ──
  s += `<rect x="44" y="540" width="330" height="30" rx="8" fill="#F0FDFA"/><text x="60" y="560" font-size="14" font-weight="800" fill="#0F766E">② 댓글 모더레이션 라이프사이클</text>`;
  s += dot(108, 690);
  const shown = state(500, 648, 240, 86, '표시됨', 'hidden=0 · 목록 노출', '#0D9488', '#F0FDFA');
  const autohide = state(930, 642, 270, 98, '자동 숨김', 'hidden=1 · 자동 모더레이션', '#DC2626', '#FEF2F2');
  s += trans(122, 690, shown.x, shown.cy);
  s += selfLoop(shown, ['POST .../report', '[distinct reporter] / reports+1']);
  s += trans(shown.right, shown.cy, autohide.x, autohide.cy, ['reports ≥ 3 (THRESHOLD)', '/ hidden=1  ★유일 자동전이'], 'r');

  // 상태 박스(화살표 위에 그림)
  s += draft.svg + pub.svg + fork.svg + shid.svg + shown.svg + autohide.svg;

  // ── 메모 ──
  const ax = 44, ay = 800, aw = W - 88, ah = 110;
  s += `<rect x="${ax}" y="${ay}" width="${aw}" height="${ah}" rx="14" fill="#F8FAFC" stroke="#E2E8F0"/>`;
  s += `<text x="${ax + 20}" y="${ay + 28}" font-size="14" font-weight="800" fill="${C.ink}">읽는 법</text>`;
  const notes = [
    ['#4F46E5', 'origin_code 자기참조 = "파생 곡 생성" 전이. 자식도 게시됨 상태이며 부모의 forkCount만 +1 → 데이터모델 ERD의 파생 트리와 동일.'],
    ['#DC2626', '자동 전이는 단 하나 — 댓글 신고 3건(REPORT_HIDE_THRESHOLD)에서 자동 숨김. 곡(세션) 숨김은 소유자 수동(seed 거부)으로, 자동 아님.'],
    ['#0EA5E9', '솔로 연주는 "로컬 초안"에 머물며 어떤 서버 전이도 일으키지 않음(업로드=게시 전이는 사용자가 명시적으로 공유할 때만).'],
  ];
  notes.forEach((n, i) => { s += `<circle cx="${ax + 24}" cy="${ay + 48 + i * 20 - 4}" r="4.5" fill="${n[0]}"/><text x="${ax + 36}" y="${ay + 48 + i * 20}" font-size="12" fill="#334155">${esc(n[1])}</text>`; });

  return s + `</svg>`;
}
const out = build();
fs.writeFileSync(path.join(TMP, 'state.html'), `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#fff}svg{display:block}</style>${out}`, 'utf8');
console.log('OK state svg/html written');
