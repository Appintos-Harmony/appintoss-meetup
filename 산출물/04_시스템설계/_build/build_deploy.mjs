import fs from 'node:fs';
import path from 'node:path';

const ICONDIR = 'C:/Users/김민혁/Desktop/dev/appintoss-meetup/산출물/04_시스템설계/아키텍처_아이콘';
const OUTDIR = 'C:/Users/김민혁/Desktop/dev/appintoss-meetup/산출물/04_시스템설계';
const TMP = 'C:/Users/Public/arch_tmp';
fs.mkdirSync(TMP, { recursive: true });

const ICON = {
  github: 'github_c.svg', ghactions: 'ghactions_c.svg', vite: 'vite_c.svg', terminal: 'terminal.svg',
  nginx: 'nginx_c.svg', nodedotjs: 'node_c.svg', sqlite: 'sqlite_c.svg', systemd: 'systemd.svg',
  letsencrypt: 'letsencrypt.svg', toss: 'toss.svg', user: 'user.svg', ec2: 'aws_ec2.svg',
  react: 'react_c.svg', tonejs: 'tone.svg', mediapipe: 'mediapipe.svg', warning: 'warning.svg',
};
const _c = {};
function uri(id) { const f = ICON[id]; if (!f) return null; if (!_c[id]) _c[id] = 'data:image/svg+xml;base64,' + Buffer.from(fs.readFileSync(path.join(ICONDIR, f), 'utf8'), 'utf8').toString('base64'); return _c[id]; }
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function fitAttr(s, fs, maxw) { let w = 0; for (const ch of String(s)) { w += (ch.codePointAt(0) > 0x2000 ? fs : fs * 0.56); } return w > maxw ? ` textLength="${Math.max(20, Math.floor(maxw))}" lengthAdjust="spacingAndGlyphs"` : ''; }
const COL = { blue: '#3B82F6', green: '#10B981', amber: '#F59E0B', cyan: '#06B6D4', purple: '#8B5CF6', gray: '#6B7280', red: '#EF4444', teal: '#0D9488', toss: '#3182F6', ink: '#1E293B', sub: '#64748B' };
const KIND2COL = { internal: 'ink', https: 'green', deploy: 'gray', writes: 'amber', enter: 'toss', cert: 'teal' };
const FONT = "'Malgun Gothic','Segoe UI',sans-serif";
const MK = { ...COL, ink: '#334155' };

function markers() { return Object.entries(MK).map(([k, c]) => `<marker id="ah-${k}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${c}"/></marker>`).join(''); }
function iconTile(x, y, id, size = 46) { const u = uri(id); const ic = size - 14; let s = `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="11" fill="#F8FAFC" stroke="#EEF2F7"/>`; if (u) s += `<image x="${x + (size - ic) / 2}" y="${y + (size - ic) / 2}" width="${ic}" height="${ic}" href="${u}"/>`; return s; }
function card({ x, y, w, h, iconId, title, subs = [], fill = '#FFFFFF', stroke = '#E5E7EB', accent, titleSize = 14.5 }) {
  let s = `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="13" fill="${fill}" stroke="${stroke}" stroke-width="1.5" filter="url(#sh)"/>`;
  if (accent) s += `<rect x="${x}" y="${y + 9}" width="4.5" height="${h - 18}" rx="2.2" fill="${accent}"/>`;
  if (iconId) s += iconTile(x + 16, y + (h - 46) / 2, iconId, 46);
  const tx = x + (iconId ? 80 : 18);
  const tot = (title ? titleSize + 6 : 0) + subs.length * 18; let cy = y + (h - tot) / 2 + titleSize - 2;
  const availW = x + w - tx - 16;
  if (title) { s += `<text x="${tx}" y="${cy}" font-family="${FONT}" font-size="${titleSize}" font-weight="700" fill="${COL.ink}"${fitAttr(title, titleSize, availW)}>${esc(title)}</text>`; cy += titleSize + 6; }
  for (const ln of subs) { s += `<text x="${tx}" y="${cy + 10}" font-family="${FONT}" font-size="12" fill="${COL.sub}"${fitAttr(ln, 12, availW)}>${esc(ln)}</text>`; cy += 18; }
  return s + `</g>`;
}
function arrow(x1, y1, x2, y2, { kind = 'internal', dashed = false, label, lx, ly, lw, width = 2.6 } = {}) {
  const colk = KIND2COL[kind] || 'ink'; const c = MK[colk];
  let s = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${width}"${dashed ? ' stroke-dasharray="7 5"' : ''} marker-end="url(#ah-${colk})"/>`;
  if (label) { const mx = lx ?? (x1 + x2) / 2, my = ly ?? (y1 + y2) / 2; const wpx = lw ?? (label.length * 6.9 + 16); s += `<rect x="${mx - wpx / 2}" y="${my - 12}" width="${wpx}" height="20" rx="7" fill="#fff" fill-opacity="0.96" stroke="${c}44"/><text x="${mx}" y="${my + 2.5}" font-family="${FONT}" font-size="11.5" font-weight="700" fill="${c}" text-anchor="middle">${esc(label)}</text>`; }
  return s;
}
function elbowDown(x1, y1, x2, y2, { col = 'gray', dashed = true, label } = {}) {
  const c = MK[col]; const midy = (y1 + y2) / 2;
  let s = `<path d="M${x1},${y1} V${midy} H${x2} V${y2}" fill="none" stroke="${c}" stroke-width="2.6"${dashed ? ' stroke-dasharray="7 5"' : ''} marker-end="url(#ah-${col})"/>`;
  if (label) { const wpx = label.length * 6.9 + 16; s += `<rect x="${x2 - wpx / 2}" y="${midy - 12}" width="${wpx}" height="20" rx="7" fill="#fff" fill-opacity="0.96" stroke="${c}44"/><text x="${x2}" y="${midy + 2.5}" font-family="${FONT}" font-size="11.5" font-weight="700" fill="${c}" text-anchor="middle">${esc(label)}</text>`; }
  return s;
}
function container({ x, y, w, h, label, sublabel, stroke, fill = '#fff', dashed = false, iconId, labelColor }) {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${fill}" stroke="${stroke}" stroke-width="2.4"${dashed ? ' stroke-dasharray="8 5"' : ''}/>`;
  let tx = x + 20; if (iconId) { s += `<image x="${x + 18}" y="${y + 16}" width="30" height="30" href="${uri(iconId)}"/>`; tx = x + 56; }
  s += `<text x="${tx}" y="${y + 30}" font-family="${FONT}" font-size="16" font-weight="800" fill="${labelColor || stroke}"${fitAttr(label, 16, x + w - tx - 16)}>${esc(label)}</text>`;
  if (sublabel) s += `<text x="${tx}" y="${y + 49}" font-family="${FONT}" font-size="11.5" fill="${COL.sub}"${fitAttr(sublabel, 11.5, x + w - tx - 16)}>${esc(sublabel)}</text>`;
  return s;
}

function build() {
  const W = 1840, H = 1040;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">`;
  s += `<defs><filter id="sh" x="-4%" y="-4%" width="108%" height="120%"><feDropShadow dx="0" dy="1.5" stdDeviation="2.4" flood-color="#0F172A" flood-opacity="0.10"/></filter>${markers()}</defs>`;
  s += `<rect width="${W}" height="${H}" fill="#FFFFFF"/>`;
  s += `<text x="52" y="54" font-size="28" font-weight="800" fill="${COL.ink}">하모니: 배포 · 서비스 구성도 (Apps-in-Toss 프로덕션)</text>`;
  s += `<text x="52" y="84" font-size="14" fill="${COL.sub}">프론트(미니앱)는 Apps-in-Toss로 유통 → 토스 슈퍼앱 WebView에서 실행 · 백엔드 API는 AWS(HTTPS) · 무의존·단일 인스턴스</text>`;
  s += `<text x="52" y="106" font-size="14" fill="${COL.sub}">사용자는 토스 앱 안에서 하모니를 연다 · 자체 도메인·앱 없음(토스가 런타임·유통·익명식별을 제공)</text>`;

  // ===== CI · 배포 밴드 (두 갈래) =====
  s += container({ x: 52, y: 140, w: 1736, h: 196, label: 'CI · 배포: GitHub Actions 검증 후 두 갈래(프론트=Apps-in-Toss / 백엔드=AWS)', stroke: '#93C5FD', fill: '#EFF6FF', labelColor: '#1D4ED8' });
  s += card({ x: 84, y: 210, w: 196, h: 64, iconId: 'github', title: '① GitHub', subs: ['소스'], titleSize: 14 });
  s += arrow(280, 242, 326, 242, { kind: 'deploy', width: 2.4 });
  s += card({ x: 332, y: 210, w: 250, h: 64, iconId: 'ghactions', title: '② GitHub Actions', subs: ['검증 tsc·vitest·비밀값'], titleSize: 14 });
  // 프론트 갈래
  s += card({ x: 700, y: 168, w: 430, h: 64, iconId: 'vite', title: '③a 프론트: ait build → ait deploy', subs: ['토스 개발자 콘솔 → 심사 제출 → 유통'], titleSize: 13.5 });
  // 백엔드 갈래
  s += card({ x: 700, y: 256, w: 430, h: 64, iconId: 'terminal', title: '③b 백엔드: deploy.sh (사람)', subs: ['scp + systemctl → AWS 재기동'], titleSize: 13.5 });
  s += arrow(582, 230, 700, 200, { kind: 'deploy', width: 2.2 });
  s += arrow(582, 254, 700, 288, { kind: 'deploy', width: 2.2 });
  // 갈래 → 타겟 (아래로)
  s += elbowDown(915, 232, 610, 410, { col: 'toss', dashed: true, label: '콘솔 등록·심사·유통' });
  s += elbowDown(1130, 288, 1430, 410, { col: 'gray', dashed: true, label: 'scp + systemctl' });

  // ===== 사용자 =====
  s += card({ x: 52, y: 590, w: 196, h: 150, iconId: 'user', title: '사용자', subs: ['실제 토스 앱 이용자(폰)', '토스 앱에서 하모니 실행', '익명 · 로그인 없음'] });

  // ===== Apps-in-Toss 플랫폼 (프론트 런타임·유통) =====
  const px = 300, py = 410, pw = 700, ph = 470;
  s += container({ x: px, y: py, w: pw, h: ph, label: 'Apps-in-Toss · 토스 슈퍼앱', sublabel: '미니앱 런타임 · 유통 · 익명식별 제공 (자체 서버 아님)', stroke: COL.toss, fill: '#EFF5FF', iconId: 'toss', labelColor: '#1D4ED8' });
  s += card({ x: px + 36, y: py + 80, w: pw - 72, h: 92, iconId: 'react', title: '하모니 미니앱 (WebView 정적 번들)', subs: ['React 18 · Granite · TDS (토스가 유통·로딩)', 'appName=harmony 콘솔 등록(현재 meetup-lite 임시)'] });
  s += card({ x: px + 36, y: py + 192, w: pw - 72, h: 84, iconId: 'toss', title: 'getAnonymousKey (익명 식별 SDK)', subs: ['로그인 없음 · 닉네임 · ⚠ 실연동은 출시 전(현재 mock)'], accent: COL.amber });
  s += card({ x: px + 36, y: py + 296, w: pw - 72, h: 92, iconId: 'tonejs', title: 'Tone.js 오디오 · 카메라 제스처(MediaPipe)', subs: ['솔로 연주 = WebView에서 완결(서버 호출 0)', 'localStorage에 내 곡 저장'] });

  // ===== AWS 프로덕션 서버 (백엔드 API) =====
  const ax = 1140, ay = 410, aw = 648, ah = 470;
  s += container({ x: ax, y: ay, w: aw, h: ah, label: 'AWS EC2 (Ubuntu): 합주·공유 API', sublabel: 'systemd 24/7 · 무의존(node:http + node:sqlite)', stroke: COL.amber, fill: '#FFF7ED', iconId: 'ec2', labelColor: '#B45309' });
  s += card({ x: ax + 36, y: ay + 80, w: aw - 72, h: 84, iconId: 'nginx', title: 'nginx: HTTPS 443 (Let’s Encrypt)', subs: ['3.39.167.74.nip.io · 리버스 프록시 · 인증서 자동갱신'] });
  s += card({ x: ax + 36, y: ay + 178, w: aw - 72, h: 84, iconId: 'nodedotjs', title: 'harmony-api (Node 단일 프로세스)', subs: ['node:http + node:sqlite · 의존성 0 · 127.0.0.1:8080'] });
  s += card({ x: ax + 36, y: ay + 276, w: aw - 72, h: 80, iconId: 'sqlite', title: 'SQLite · harmony.db', subs: ['단일 파일 · 5 테이블 · ⚠ 백업 없음(1순위 보강)'], accent: COL.red });
  s += `<rect x="${ax + 36}" y="${ay + 370}" width="${aw - 72}" height="44" rx="11" fill="#F5F3FF" stroke="${COL.purple}" stroke-width="1.4"/>`;
  s += `<image x="${ax + 48}" y="${ay + 379}" width="26" height="26" href="${uri('systemd')}"/>`;
  s += `<text x="${ax + 82}" y="${ay + 397}" font-size="12.5" font-weight="700" fill="#6D28D9">systemd: 감독·자동복구·권한격리 · certbot.timer</text>`;

  // ===== 흐름 =====
  // 사용자 → Apps-in-Toss
  s += arrow(248, 650, px, 600, { kind: 'enter', label: '토스 앱 진입', lx: 274, ly: 575, lw: 92 });
  // 미니앱(Apps-in-Toss) → AWS nginx : 핵심 HTTPS (넓은 간격에 큼직하게)
  s += arrow(px + pw, py + 126, ax, ay + 122, { kind: 'https', width: 3.4, label: 'HTTPS (합주/공유만) · VITE_API_BASE=운영 URL', lx: (px + pw + ax) / 2, ly: py + 96, lw: 312 });
  // AWS 내부
  s += arrow(ax + aw / 2, ay + 164, ax + aw / 2, ay + 178, { kind: 'internal', label: '8080', lw: 44, lx: ax + aw / 2 + 40, ly: ay + 171 });
  s += arrow(ax + aw / 2, ay + 262, ax + aw / 2, ay + 276, { kind: 'writes', label: 'R/W', lw: 44, lx: ax + aw / 2 + 40, ly: ay + 269 });

  // ===== 범례 + 각주 =====
  const ly2 = 916;
  s += `<rect x="52" y="${ly2}" width="900" height="50" rx="12" fill="#fff" stroke="#E5E7EB"/>`;
  s += `<text x="72" y="${ly2 + 20}" font-size="12" font-weight="800" fill="${COL.sub}">범례</text>`;
  const leg = [['toss', '토스 앱/유통', false], ['https', 'HTTPS API(합주/공유)', false], ['ink', '내부 호출', false], ['gray', '배포(점선)', true]];
  let lx = 72; const lyy = ly2 + 38;
  for (const [c, t, d] of leg) { s += `<line x1="${lx}" y1="${lyy}" x2="${lx + 28}" y2="${lyy}" stroke="${MK[c]}" stroke-width="3.2"${d ? ' stroke-dasharray="5 4"' : ''} marker-end="url(#ah-${c})"/><text x="${lx + 36}" y="${lyy + 4}" font-size="11.5" fill="#475569">${esc(t)}</text>`; lx += 36 + t.length * 7.4 + 30; }
  s += `<text x="52" y="${H - 34}" font-size="12" font-style="italic" fill="#94A3B8">* 프로덕션(인앱토스 서비스) 기준. 로컬 개발은 granite dev(localhost:5173) + mock 익명키 · 본 도면과 별개. 현재 테스트는 AWS nginx가 정적앱도 함께 서빙(nip.io).</text>`;
  s += `<text x="52" y="${H - 14}" font-size="12" font-style="italic" fill="#94A3B8">* 출시 전 차단: harmony appName 콘솔 등록 · getAnonymousKey 실연동(현재 mock) · 실기기 검수. · cloudflared 터널은 nip.io 장애용 백업(현재 비활성).</text>`;

  return s + `</svg>`;
}

const out = build();
fs.writeFileSync(path.join(TMP, 'deploy.html'), `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#fff}svg{display:block}</style>${out}`, 'utf8');
console.log('OK deploy(production) svg/html written');
