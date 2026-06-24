import fs from 'node:fs';
import path from 'node:path';

const ICONDIR = 'C:/Users/김민혁/Desktop/dev/appintoss-meetup/산출물/04_시스템설계/아키텍처_아이콘';
const OUTDIR = 'C:/Users/김민혁/Desktop/dev/appintoss-meetup/산출물/04_시스템설계';
const TMP = 'C:/Users/Public/arch_tmp';
fs.mkdirSync(TMP, { recursive: true });

// 모델 iconId → 실제 아이콘 파일
const ICON = {
  toss: 'toss.svg', react: 'react_c.svg', vite: 'vite_c.svg', typescript: 'typescript_c.svg',
  tonejs: 'tone.svg', mediapipe: 'mediapipe.svg', webstorage: 'localstorage.svg',
  nginx: 'nginx_c.svg', letsencrypt: 'letsencrypt.svg', cloudflare: 'cloudflare_c.svg',
  nodedotjs: 'node_c.svg', sqlite: 'sqlite_c.svg', systemd: 'systemd.svg', ubuntu: 'ubuntu.svg',
  amazonwebservices: 'aws.svg', githubactions: 'ghactions_c.svg', gnubash: 'terminal.svg',
  shield: 'shield.svg', user: 'user.svg', warning: 'warning.svg', pulse: 'pulse.svg',
};
const _cache = {};
function uri(id) {
  const f = ICON[id]; if (!f) return null;
  if (!_cache[id]) {
    const svg = fs.readFileSync(path.join(ICONDIR, f), 'utf8');
    _cache[id] = 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64');
  }
  return _cache[id];
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// 텍스트 추정폭이 maxw를 넘으면 textLength로 자동 압축(박스 밖 삐져나감 방지)
function fitAttr(s, fs, maxw) { let w = 0; for (const ch of String(s)) { w += (ch.codePointAt(0) > 0x2000 ? fs : fs * 0.56); } return w > maxw ? ` textLength="${Math.max(20, Math.floor(maxw))}" lengthAdjust="spacingAndGlyphs"` : ''; }

const COL = {
  blue: '#3B82F6', green: '#10B981', amber: '#F59E0B', cyan: '#06B6D4',
  purple: '#8B5CF6', gray: '#6B7280', red: '#EF4444', ink: '#1E293B', sub: '#64748B',
};
const KIND2COL = { local: 'cyan', https: 'green', proxy: 'green', writes: 'amber', supervises: 'purple', applies: 'purple', deploy: 'gray', risk: 'red' };

const FONT = "'Malgun Gothic','Segoe UI',sans-serif";

function markers() {
  return Object.entries(COL).map(([k, c]) =>
    `<marker id="ah-${k}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${c}"/></marker>`
  ).join('');
}

function iconTile(x, y, id, size = 46) {
  const u = uri(id);
  const ic = size - 14;
  let s = `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="11" fill="#F8FAFC" stroke="#EEF2F7"/>`;
  if (u) s += `<image x="${x + (size - ic) / 2}" y="${y + (size - ic) / 2}" width="${ic}" height="${ic}" href="${u}"/>`;
  return s;
}

// 카드: 아이콘 + 제목 + 서브라인들
function card({ x, y, w, h, iconId, title, subs = [], fill = '#FFFFFF', stroke = '#E5E7EB', accent, titleSize = 15 }) {
  let s = `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${fill}" stroke="${stroke}" stroke-width="1.5" filter="url(#sh)"/>`;
  if (accent) s += `<rect x="${x}" y="${y + 9}" width="4.5" height="${h - 18}" rx="2.2" fill="${accent}"/>`;
  const ix = x + 18, iy = y + (h - 46) / 2;
  if (iconId) s += iconTile(ix, iy, iconId);
  const tx = x + (iconId ? 82 : 20);
  const totalText = (title ? titleSize + 6 : 0) + subs.length * 17;
  let cy = y + (h - totalText) / 2 + titleSize - 2;
  const availW = x + w - tx - 16;
  if (title) { s += `<text x="${tx}" y="${cy}" font-family="${FONT}" font-size="${titleSize}" font-weight="700" fill="${COL.ink}"${fitAttr(title, titleSize, availW)}>${esc(title)}</text>`; cy += titleSize + 6; }
  for (const ln of subs) { s += `<text x="${tx}" y="${cy + 10}" font-family="${FONT}" font-size="12" fill="${COL.sub}"${fitAttr(ln, 12, availW)}>${esc(ln)}</text>`; cy += 17; }
  s += `</g>`;
  return s;
}

function cluster({ x, y, w, h, title, headFill, bodyFill, stroke, titleColor = '#fff', dashed = false, icons = [] }) {
  const hh = 38;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${bodyFill}" stroke="${stroke}" stroke-width="2"${dashed ? ' stroke-dasharray="7 5"' : ''}/>`;
  s += `<path d="M${x + 18},${y} h${w - 36} a18,18 0 0 1 18,18 v${hh - 18} h-${w} v-${hh - 18} a18,18 0 0 1 18,-18 z" fill="${headFill}"/>`;
  let ix = x + 16;
  for (const ic of icons) { s += `<image x="${ix}" y="${y + (hh - 22) / 2}" width="22" height="22" href="${uri(ic)}"/>`; ix += 27; }
  s += `<text x="${ix + 2}" y="${y + 25}" font-family="${FONT}" font-size="14.5" font-weight="800" fill="${titleColor}"${fitAttr(title, 14.5, x + w - (ix + 2) - 16)}>${esc(title)}</text>`;
  return s;
}

function arrow(x1, y1, x2, y2, { kind = 'local', dashed = false, label, lx, ly, lw } = {}) {
  const c = COL[KIND2COL[kind] || 'gray'];
  const colk = KIND2COL[kind] || 'gray';
  let s = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="2.4"${dashed ? ' stroke-dasharray="6 5"' : ''} marker-end="url(#ah-${colk})"/>`;
  if (label) {
    const mx = lx ?? (x1 + x2) / 2, my = ly ?? (y1 + y2) / 2;
    const wpx = lw ?? (label.length * 6.6 + 14);
    s += `<rect x="${mx - wpx / 2}" y="${my - 11}" width="${wpx}" height="18" rx="6" fill="#FFFFFF" fill-opacity="0.92"/>`;
    s += `<text x="${mx}" y="${my + 2.5}" font-family="${FONT}" font-size="11" font-weight="600" fill="${c}" text-anchor="middle">${esc(label)}</text>`;
  }
  return s;
}
function elbow(x1, y1, x2, y2, midx, { kind = 'local', dashed = false, label, ly } = {}) {
  const c = COL[KIND2COL[kind] || 'gray']; const colk = KIND2COL[kind] || 'gray';
  const d = `M${x1},${y1} H${midx} V${y2} H${x2}`;
  let s = `<path d="${d}" fill="none" stroke="${c}" stroke-width="2.4"${dashed ? ' stroke-dasharray="6 5"' : ''} marker-end="url(#ah-${colk})"/>`;
  if (label) { const my = ly ?? (y1 + y2) / 2; const wpx = label.length * 6.6 + 14; s += `<rect x="${midx - wpx / 2}" y="${my - 11}" width="${wpx}" height="18" rx="6" fill="#fff" fill-opacity="0.92"/><text x="${midx}" y="${my + 2.5}" font-family="${FONT}" font-size="11" font-weight="600" fill="${c}" text-anchor="middle">${esc(label)}</text>`; }
  return s;
}

function frame(w, h, title, subs) {
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}">`;
  s += `<defs><filter id="sh" x="-4%" y="-4%" width="108%" height="118%"><feDropShadow dx="0" dy="1.5" stdDeviation="2.2" flood-color="#0F172A" flood-opacity="0.10"/></filter>${markers()}</defs>`;
  s += `<rect x="0" y="0" width="${w}" height="${h}" fill="#FFFFFF"/>`;
  s += `<text x="48" y="52" font-size="27" font-weight="800" fill="${COL.ink}">${esc(title)}</text>`;
  let yy = 78;
  for (const ln of subs) { s += `<text x="48" y="${yy}" font-size="13.5" fill="${COL.sub}">${esc(ln)}</text>`; yy += 19; }
  return s;
}

function legend(x, y, items) {
  let s = `<g>`;
  let cx = x;
  for (const it of items) {
    const c = COL[it.c];
    s += `<line x1="${cx}" y1="${y}" x2="${cx + 26}" y2="${y}" stroke="${c}" stroke-width="3.4"${it.dash ? ' stroke-dasharray="5 4"' : ''} marker-end="url(#ah-${it.c})"/>`;
    s += `<text x="${cx + 34}" y="${y + 4}" font-size="11.5" fill="#475569">${esc(it.t)}</text>`;
    cx += 34 + it.t.length * 7.2 + 26;
  }
  s += `</g>`;
  return s;
}

/* ============================ 시스템 아키텍처 ============================ */
function buildSystem() {
  const W = 1740, H = 1180;
  let s = frame(W, H,
    '하모니(Harmony) 전체 시스템 아키텍처',
    ['단일 AWS Ubuntu 인스턴스 · Node 무의존(node:http+node:sqlite) · 인증 없음(코드=접근권한, 데모 범위)',
     '신뢰경계 4겹: 기기(untrusted) → nginx(443 TLS 종단·유일 public 면) → 127.0.0.1:8080 loopback API → SQLite 단일 파일']);

  // --- 상단 CI/배포 밴드 ---
  s += cluster({ x: 48, y: 108, w: 1644, h: 104, title: 'CI · 배포 파이프라인 — 사람 게이트 (코드 파이프라인은 prod 자격증명 미접촉)', headFill: COL.gray, bodyFill: '#F9FAFB', stroke: COL.gray, dashed: true });
  s += card({ x: 70, y: 156, w: 360, h: 44, iconId: 'githubactions', title: 'GitHub Actions CI', subs: ['verify-docs(문서·비밀값) · verify-code(tsc+vitest)'], titleSize: 13.5 });
  s += arrow(436, 178, 486, 178, { kind: 'deploy' });
  s += card({ x: 492, y: 156, w: 330, h: 44, iconId: 'gnubash', title: 'deploy/deploy.sh (사람 전용)', subs: ['scp 복사 → systemctl enable --now'], titleSize: 13.5 });
  s += arrow(828, 178, 878, 178, { kind: 'deploy' });
  s += card({ x: 884, y: 156, w: 300, h: 44, iconId: 'pulse', title: 'GET /healthz 검증', subs: ['배포 후 기동 확인 게이트'], titleSize: 13.5 });
  // 밴드 → EC2 로 내려가는 점선
  s += elbow(1240, 200, 1240, 244, 1240, { kind: 'deploy', dashed: true, label: 'SSH 게이트', ly: 226 });

  // --- 좌: 클라이언트 ---
  const cx = 48, cy = 244, cw = 520, ch = 812;
  s += cluster({ x: cx, y: cy, w: cw, h: ch, title: '클라이언트 신뢰경계 · 토스 WebView (untrusted)', headFill: COL.blue, bodyFill: '#EFF6FF', stroke: COL.blue, icons: ['toss'] });
  s += card({ x: cx + 22, y: cy + 54, w: cw - 44, h: 58, iconId: 'user', title: '사용자 (토스 앱 이용자)', subs: ['로그인/회원가입 없음 · 익명 식별만'] });
  s += card({ x: cx + 22, y: cy + 122, w: cw - 44, h: 70, iconId: 'react', title: '미니앱 프론트 (Granite SPA)', subs: ['React 18.3 · TS · Vite 6 · TDS', 'VITE_API_BASE=<https> 주입'] });
  s += card({ x: cx + 22, y: cy + 200, w: cw - 44, h: 64, iconId: 'mediapipe', title: '입력 캡처 → chordReducer', subs: ['MediaPipe 4코드존 · 터치 폴백', 'tick 기록(벽시계 ms 금지)'] });
  s += card({ x: cx + 22, y: cy + 272, w: cw - 44, h: 60, iconId: 'tonejs', title: '오디오 엔진 (Tone.js — 클라 완결)', subs: ['PolySynth 합성·메트로놈·트랙별 음색 동시재생'] });
  s += card({ x: cx + 22, y: cy + 340, w: cw - 44, h: 58, iconId: 'webstorage', title: 'localStorage (내 곡)', subs: ['솔로 오프라인 완결 · 단일기기·무동기화'], accent: COL.cyan });
  // 제약 노트
  s += `<rect x="${cx + 22}" y="${cy + 410}" width="${cw - 44}" height="92" rx="12" fill="#FFFFFF" stroke="#DBEAFE" stroke-width="1.5"/>`;
  s += `<text x="${cx + 36}" y="${cy + 434}" font-size="12.5" font-weight="800" fill="${COL.blue}">WebView 호스트 제약 (신뢰경계 밖)</text>`;
  [' · HTTPS 강제 · 핀치줌 비활성', ' · 자체 뒤로가기 금지 · 인라인 카메라', ' · 익명키 = 식별일 뿐(신원 아님)'].forEach((t, i) => {
    s += `<text x="${cx + 34}" y="${cy + 456 + i * 18}" font-size="11.5" fill="#475569">${esc(t)}</text>`;
  });

  // --- 우: AWS EC2 단일 인스턴스 ---
  const ex = 600, ey = 244, ew = 1092, eh = 812;
  s += cluster({ x: ex, y: ey, w: ew, h: eh, title: 'AWS EC2 · 단일 Ubuntu 인스턴스 (HA / LB 없음 · 단일 장애 도메인)', headFill: '#7C3AED', bodyFill: '#Faf9Ff', stroke: '#7C3AED', icons: ['amazonwebservices', 'ubuntu'] });

  // 엣지 서브박스
  const gx = ex + 22, gy = ey + 54, gw = 332, gh = 540;
  s += `<rect x="${gx}" y="${gy}" width="${gw}" height="${gh}" rx="14" fill="#ECFDF5" stroke="${COL.green}" stroke-width="1.6"/>`;
  s += `<text x="${gx + 16}" y="${gy + 24}" font-size="13" font-weight="800" fill="#047857"${fitAttr('엣지 · TLS 종단 (유일 public 노출면)', 13, gw - 32)}>엣지 · TLS 종단 (유일 public 노출면)</text>`;
  s += card({ x: gx + 14, y: gy + 38, w: gw - 28, h: 78, iconId: 'nginx', title: 'nginx — TLS 종단 · 프록시', subs: ['443 TLS 종단 · nip.io · 정적 SPA', '/sessions · /community → 8080 (+XFF)'] });
  s += card({ x: gx + 14, y: gy + 128, w: gw - 28, h: 58, iconId: 'letsencrypt', title: 'certbot / Let’s Encrypt', subs: ['certbot.timer 인증서 자동 갱신'] });
  s += card({ x: gx + 14, y: gy + 200, w: gw - 28, h: 70, iconId: 'cloudflare', title: 'cloudflared 터널 (대체·임시)', subs: ['harmony-tunnel.service · CDN 아님'] });
  s += card({ x: gx + 14, y: gy + 284, w: gw - 28, h: 58, iconId: 'pulse', title: 'GET /healthz (관측 단일 신호)', subs: ['메트릭·로그집계·대시보드 없음'], accent: COL.purple });

  // 앱 서브박스
  const ax = gx + gw + 22, ay = gy, aw = 326, ah = 300;
  s += `<rect x="${ax}" y="${ay}" width="${aw}" height="${ah}" rx="14" fill="#FFFBEB" stroke="${COL.amber}" stroke-width="1.6"/>`;
  s += `<text x="${ax + 16}" y="${ay + 24}" font-size="13" font-weight="800" fill="#B45309"${fitAttr('애플리케이션 · loopback 전용 (127.0.0.1)', 13, aw - 32)}>애플리케이션 · loopback 전용 (127.0.0.1)</text>`;
  s += card({ x: ax + 14, y: ay + 38, w: aw - 28, h: 96, iconId: 'nodedotjs', title: 'harmony-api (Node 단일 프로세스)', subs: ['node:http + node:sqlite · 의존성 0', '127.0.0.1:8080 · 9경로 / 10 오퍼레이션'] });
  s += card({ x: ax + 14, y: ay + 146, w: aw - 28, h: 132, iconId: 'shield', title: '인프로세스 보안 (미들웨어 0)', subs: ['IP 레이트리밋 · 입력검증 · 멱등', '신고 자동숨김 · 코드 = 접근권한'] });

  // 데이터 서브박스
  const dx = ax, dy = ay + ah + 18, dw = aw, dh = 222;
  s += `<rect x="${dx}" y="${dy}" width="${dw}" height="${dh}" rx="14" fill="#FEF2F2" stroke="${COL.red}" stroke-width="1.6"/>`;
  s += `<text x="${dx + 16}" y="${dy + 24}" font-size="13" font-weight="800" fill="#B91C1C"${fitAttr('데이터 · SQLite 단일 파일 (단일 진실원천)', 13, dw - 32)}>데이터 · SQLite 단일 파일 (단일 진실원천)</text>`;
  s += card({ x: dx + 14, y: dy + 36, w: dw - 28, h: 80, iconId: 'sqlite', title: 'SQLite (harmony.db)', subs: ['node:sqlite 임베디드 · 단일 라이터', '5개 테이블 · 단일 진실원천'] });
  s += card({ x: dx + 14, y: dy + 126, w: dw - 28, h: 80, iconId: 'warning', title: '백업 공백 (미존재 · 명시)', subs: ['복제 · 스냅샷 · 백업 없음', '파일 손실 = 전손 · 1순위 보강'], accent: COL.red, fill: '#FFFFFF', stroke: '#FECACA' });

  // systemd 감독 바 (엣지/앱/데이터 하단 가로)
  const sy = gy + gh + 14;
  s += `<rect x="${gx}" y="${sy}" width="${ax + aw - gx}" height="64" rx="13" fill="#F5F3FF" stroke="${COL.purple}" stroke-width="1.6"/>`;
  s += `<image x="${gx + 16}" y="${sy + 17}" width="30" height="30" href="${uri('systemd')}"/>`;
  s += `<text x="${gx + 56}" y="${sy + 27}" font-size="13.5" font-weight="800" fill="#6D28D9">systemd — 감독 · 자동복구 · 권한격리</text>`;
  s += `<text x="${gx + 56}" y="${sy + 46}" font-size="11.5" fill="#5B21B6"${fitAttr('Restart=on-failure · User=harmony · NoNewPrivileges · ProtectSystem=full · certbot.timer 자동갱신', 11.5, ax + aw - (gx + 56) - 14)}>Restart=on-failure · User=harmony · NoNewPrivileges · ProtectSystem=full · certbot.timer 자동갱신</text>`;

  // --- 엣지(화살표) ---
  // 클라 SPA → nginx (HTTPS)
  s += arrow(cx + cw - 22, cy + 157, gx + 14, gy + 70, { kind: 'https', label: 'HTTPS (합주/공유만)', lx: 585, ly: 360, lw: 142 });
  // nginx → api (proxy)
  s += arrow(gx + gw - 14, gy + 70, ax + 14, ay + 80, { kind: 'proxy', label: '프록시 +XFF', lx: gx + gw + 8, ly: gy + 30 });
  // certbot → nginx (supervises, 위로)
  s += arrow(gx + 30, gy + 128, gx + 30, gy + 118, { kind: 'supervises' });
  // cloudflared → api (대체, 점선)
  s += elbow(gx + gw - 14, gy + 235, ax + 6, ay + 110, ax - 8, { kind: 'proxy', dashed: true });
  // api → sqlite (writes)
  s += arrow(ax + aw / 2, ay + ah, dx + dw / 2, dy + 36, { kind: 'writes', label: '파일 R/W(단일 라이터)', lx: ax + aw / 2, ly: dy + 12, lw: 158 });
  // sqlite → backup (risk)
  s += arrow(dx + 40, dy + 116, dx + 40, dy + 126, { kind: 'risk' });
  // systemd 감독 (바 → 위 박스들로 짧은 보라 화살표)
  s += arrow(gx + gw / 2, sy, gx + gw / 2, gy + gh + 2, { kind: 'supervises' });
  s += arrow(ax + aw / 2, sy, ax + aw / 2, dy + dh + 2, { kind: 'supervises' });

  // 범례
  s += legend(56, H - 92, [
    { c: 'blue', t: '앱 로드/정적 서빙' }, { c: 'green', t: 'API·프록시(HTTPS→loopback)' },
    { c: 'amber', t: 'DB 접근(SQLite R/W)' }, { c: 'cyan', t: '로컬 완결(솔로)' },
    { c: 'purple', t: '감독·자동복구·인증서갱신' }, { c: 'gray', t: '배포·CI(사람 게이트)', dash: true }, { c: 'red', t: '데이터 손실 리스크' },
  ]);
  // 핵심 노트 3 pill
  const notes = ['HTTPS 필수 — 잘못된 base = 전체 네트워크 마비', '인증 없음 = 데모 범위(코드=접근권한)', '무의존·단일 인스턴스 = 의도된 트레이드오프(공급망 최소·HA 없음)'];
  let nx = 56;
  notes.forEach((t) => { const wpx = t.length * 7.0 + 28; s += `<rect x="${nx}" y="${H - 64}" width="${wpx}" height="30" rx="15" fill="#F1F5F9" stroke="#E2E8F0"/><text x="${nx + 14}" y="${H - 44}" font-size="12" fill="#334155">${esc(t)}</text>`; nx += wpx + 14; });

  s += `</svg>`;
  return s;
}

/* ============================ 합주 공유 흐름도 ============================ */
function buildFlow() {
  const W = 1740, H = 1020;
  let s = frame(W, H,
    '하모니 합주 공유 서비스 데이터 흐름',
    ['연주 기록 → 공유(코드 발급) → 받기/레이어 얹기 → 합주 듣기 + 커뮤니티 출처 루프',
     '솔로=클라 완결(서버 0) · 합주/공유만 nginx(443)→127.0.0.1:8080→SQLite · 동기화는 1.5초 폴링(실시간 아님) · 가져오기 시 origin_code 강제 + 부모 forkCount+1']);

  // 레인
  const laneX = 48, laneW = 1644, tabW = 92;
  const lanes = [
    { id: 'A', y: 150, h: 224, fill: '#EFF6FF', tab: COL.blue, l1: '사용자', l2: 'A' },
    { id: 'S', y: 398, h: 196, fill: '#ECFDF5', tab: COL.green, l1: '엣지', l2: '서버' },
    { id: 'B', y: 618, h: 286, fill: '#ECFEFF', tab: COL.cyan, l1: '사용자', l2: 'B' },
  ];
  for (const ln of lanes) {
    s += `<rect x="${laneX}" y="${ln.y}" width="${laneW}" height="${ln.h}" rx="14" fill="${ln.fill}" stroke="#E2E8F0" stroke-width="1.5"/>`;
    s += `<path d="M${laneX},${ln.y + 14} a14,14 0 0 1 14,-14 h${tabW - 14} v${ln.h} h-${tabW - 14} a14,14 0 0 1 -14,-14 z" fill="${ln.tab}"/>`;
    const cyc = ln.y + ln.h / 2;
    s += `<text x="${laneX + tabW / 2}" y="${cyc - 6}" font-size="14.5" font-weight="800" fill="#fff" text-anchor="middle">${esc(ln.l1)}</text>`;
    s += `<text x="${laneX + tabW / 2}" y="${cyc + 15}" font-size="14.5" font-weight="800" fill="#fff" text-anchor="middle">${esc(ln.l2)}</text>`;
  }

  // 스텝 좌표 (center x, lane y-center)
  const SW = 182, SH = 88;
  const yA = 262, yS = 496, yB = 761;
  const C = { c1: 250, c2: 452, c3: 654, c4: 856, c5: 1058, c6: 1260, c7: 1500 };
  const steps = {
    a_play: { cx: C.c1, cy: yA, icon: 'mediapipe', t: '① 연주(터치/제스처)', s: ['4코드존 · 터치 폴백'] },
    a_record: { cx: C.c2, cy: yA, icon: 'react', t: '② chordReducer 기록', s: ['tick 이벤트(ms 금지)'] },
    a_local: { cx: C.c3, cy: yA, icon: 'webstorage', t: '③ localStorage 저장', s: ['솔로 완결·서버 0'] },
    a_share: { cx: C.c4, cy: yA, icon: 'react', t: '④ 공유 POST /sessions', s: ['익명키 부착(인증X)'] },
    a_clip: { cx: C.c7, cy: yA, icon: 'react', t: '⑧ 코드→클립보드', s: ['out-of-band 전달'] },
    f_nginx: { cx: C.c5, cy: yS, icon: 'nginx', t: '⑤ nginx TLS 종단', s: ['443→8080 ·XFF'] },
    f_api: { cx: C.c6, cy: yS, icon: 'nodedotjs', t: '⑥ harmony-api', s: ['레이트리밋·검증·멱등'] },
    f_db: { cx: C.c7, cy: yS, icon: 'sqlite', t: '⑦ 코드 발급→SQLite', s: ['sessions INSERT'] },
    b_browse: { cx: C.c1, cy: yB, icon: 'react', t: '⑨ 커뮤니티 보드', s: ['GET /community'] },
    b_receive: { cx: C.c3, cy: yB, icon: 'sqlite', t: '⑩ 받기 GET /:code', s: ['친구 트랙·origin 박힘'] },
    b_layer: { cx: C.c4, cy: yB, icon: 'sqlite', t: '⑪ 레이어 얹기', s: ['POST /tracks·forkCount+1'] },
    b_poll: { cx: C.c5, cy: yB, icon: 'react', t: '⑫ 1.5초 폴링', s: ['실시간 아님·pull'] },
    b_ensemble: { cx: C.c6, cy: yB, icon: 'tonejs', t: '⑬ 합주 듣기(Tone.js)', s: ['트랙별 음색 동시재생'] },
  };
  // 엣지 (스텝 간) — 먼저 그려서 카드가 위에 오게
  const P = (id) => steps[id];
  function sEdge(a, b, kind, label, opt = {}) {
    const A = P(a), B = P(b);
    let x1 = A.cx, y1 = A.cy, x2 = B.cx, y2 = B.cy;
    // 가장자리 보정
    if (Math.abs(A.cy - B.cy) < 4) { // 수평
      if (B.cx > A.cx) { x1 = A.cx + SW / 2; x2 = B.cx - SW / 2; } else { x1 = A.cx - SW / 2; x2 = B.cx + SW / 2; }
    } else { // 수직 위주
      if (B.cy > A.cy) { y1 = A.cy + SH / 2; y2 = B.cy - SH / 2; } else { y1 = A.cy - SH / 2; y2 = B.cy + SH / 2; }
    }
    return arrow(x1, y1, x2, y2, { kind, label, ...opt });
  }
  // A 로컬 체인
  s += sEdge('a_play', 'a_record', 'local');
  s += sEdge('a_record', 'a_local', 'local');
  s += sEdge('a_local', 'a_share', 'local');
  // 공유 서버행
  s += sEdge('a_share', 'f_nginx', 'https', 'HTTPS', { lw: 56 });
  s += sEdge('f_nginx', 'f_api', 'proxy');
  s += sEdge('f_api', 'f_db', 'writes');
  s += sEdge('f_db', 'a_clip', 'https', '코드 응답', { lw: 72 });
  // out-of-band 코드 전달 (A clip → B browse) 대각 점선
  s += arrow(P('a_clip').cx - SW / 2, P('a_clip').cy + SH / 2 - 10, P('b_browse').cx, P('b_browse').cy - SH / 2, { kind: 'deploy', dashed: true, label: '코드/링크 외부 전달(out-of-band)', lx: 800, ly: 470, lw: 240 });
  // B 로컬/서버
  s += sEdge('b_browse', 'b_receive', 'local');
  s += sEdge('b_receive', 'f_nginx', 'https', 'GET /:code', { lw: 84 });
  s += sEdge('b_receive', 'b_layer', 'local');
  s += sEdge('b_layer', 'f_api', 'https', 'POST /tracks', { lw: 96 });
  s += sEdge('b_layer', 'b_poll', 'local');
  s += sEdge('b_poll', 'f_nginx', 'https', '폴링 GET', { lw: 72 });
  s += sEdge('b_poll', 'b_ensemble', 'local');
  // 출처 루프 (ensemble → layer) 보라 곡선
  const el = P('b_ensemble'), bl = P('b_layer');
  s += `<path d="M${el.cx},${el.cy + SH / 2} C ${el.cx},${el.cy + 78} ${bl.cx},${bl.cy + 78} ${bl.cx},${bl.cy + SH / 2}" fill="none" stroke="${COL.purple}" stroke-width="2.4" stroke-dasharray="6 5" marker-end="url(#ah-purple)"/>`;
  s += `<rect x="${(el.cx + bl.cx) / 2 - 78}" y="${el.cy + 70}" width="156" height="18" rx="6" fill="#fff" fill-opacity="0.92"/><text x="${(el.cx + bl.cx) / 2}" y="${el.cy + 83}" font-size="11" font-weight="700" fill="${COL.purple}" text-anchor="middle">출처 루프 순환(재공유)</text>`;

  // 스텝 카드
  for (const k of Object.keys(steps)) {
    const st = steps[k];
    s += card({ x: st.cx - SW / 2, y: st.cy - SH / 2, w: SW, h: SH, iconId: st.icon, title: st.t, subs: st.s, titleSize: 13 });
  }

  // 범례
  s += legend(56, H - 64, [
    { c: 'cyan', t: '로컬(클라 완결)' }, { c: 'green', t: 'HTTPS API' }, { c: 'amber', t: 'DB 기록' },
    { c: 'gray', t: '앱 밖 코드 전달', dash: true }, { c: 'purple', t: '출처 파생 루프', dash: true },
  ]);
  s += `<text x="${W - 48}" y="${H - 60}" font-size="11.5" fill="#94A3B8" text-anchor="end">서버 노드(⑤⑥⑦)는 A·B가 공유 — 화살표는 각 사용자가 동일 인프라를 호출함을 의미</text>`;

  s += `</svg>`;
  return s;
}

function htmlWrap(svg, w, h) {
  return `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#fff}svg{display:block}</style>${svg}`;
}

const sys = buildSystem();
const flow = buildFlow();
fs.writeFileSync(path.join(TMP, 'system.html'), htmlWrap(sys), 'utf8');
fs.writeFileSync(path.join(TMP, 'flow.html'), htmlWrap(flow), 'utf8');
console.log('OK system + flow svg/html written');
