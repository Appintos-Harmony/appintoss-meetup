import fs from 'node:fs';
import path from 'node:path';

const ICONDIR = 'C:/Users/김민혁/Desktop/dev/appintoss-meetup/산출물/04_시스템설계/아키텍처_아이콘';
const OUTDIR = 'C:/Users/김민혁/Desktop/dev/appintoss-meetup/산출물/04_시스템설계';
const TMP = 'C:/Users/Public/arch_tmp';
fs.mkdirSync(TMP, { recursive: true });

const ICON = {
  ec2: 'aws_ec2.svg', vpc: 'aws_vpc.svg', aws: 'aws.svg', nginx: 'nginx_c.svg',
  nodedotjs: 'node_c.svg', sqlite: 'sqlite_c.svg', letsencrypt: 'letsencrypt.svg',
  systemd: 'systemd.svg', cloudflare: 'cloudflare_c.svg', user: 'user.svg',
  warning: 'warning.svg', shield: 'shield.svg', pulse: 'pulse.svg', ubuntu: 'ubuntu.svg',
};
const _c = {};
function uri(id) {
  const f = ICON[id]; if (!f) return null;
  if (!_c[id]) _c[id] = 'data:image/svg+xml;base64,' + Buffer.from(fs.readFileSync(path.join(ICONDIR, f), 'utf8'), 'utf8').toString('base64');
  return _c[id];
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function fitAttr(s, fs, maxw) { let w = 0; for (const ch of String(s)) { w += (ch.codePointAt(0) > 0x2000 ? fs : fs * 0.56); } return w > maxw ? ` textLength="${Math.max(20, Math.floor(maxw))}" lengthAdjust="spacingAndGlyphs"` : ''; }
const COL = { blue: '#3B82F6', green: '#10B981', amber: '#F59E0B', cyan: '#06B6D4', purple: '#8B5CF6', gray: '#6B7280', red: '#EF4444', ink: '#1E293B', sub: '#64748B' };
const KIND2COL = { local: 'cyan', https: 'green', proxy: 'green', writes: 'amber', supervises: 'purple', applies: 'purple', deploy: 'gray', risk: 'red' };
const FONT = "'Malgun Gothic','Segoe UI',sans-serif";
// AWS 공식 그룹 색
const AWS = { cloud: '#232F3E', region: '#00A4A6', vpc: '#248823', az: '#00A4A6', subnet: '#7AA116', ec2: '#ED7100' };

function markers() {
  return Object.entries(COL).map(([k, c]) => `<marker id="ah-${k}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${c}"/></marker>`).join('');
}
function iconTile(x, y, id, size = 46) {
  const u = uri(id); const ic = size - 14;
  let s = `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="11" fill="#F8FAFC" stroke="#EEF2F7"/>`;
  if (u) s += `<image x="${x + (size - ic) / 2}" y="${y + (size - ic) / 2}" width="${ic}" height="${ic}" href="${u}"/>`;
  return s;
}
function card({ x, y, w, h, iconId, title, subs = [], fill = '#FFFFFF', stroke = '#E5E7EB', accent, titleSize = 14 }) {
  let s = `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="13" fill="${fill}" stroke="${stroke}" stroke-width="1.5" filter="url(#sh)"/>`;
  if (accent) s += `<rect x="${x}" y="${y + 9}" width="4.5" height="${h - 18}" rx="2.2" fill="${accent}"/>`;
  const ix = x + 14, iy = y + (h - 44) / 2;
  if (iconId) s += iconTile(ix, iy, iconId, 44);
  const tx = x + (iconId ? 76 : 18);
  const totalText = (title ? titleSize + 6 : 0) + subs.length * 17;
  let cy = y + (h - totalText) / 2 + titleSize - 2;
  const availW = x + w - tx - 16;
  if (title) { s += `<text x="${tx}" y="${cy}" font-family="${FONT}" font-size="${titleSize}" font-weight="700" fill="${COL.ink}"${fitAttr(title, titleSize, availW)}>${esc(title)}</text>`; cy += titleSize + 6; }
  for (const ln of subs) { s += `<text x="${tx}" y="${cy + 10}" font-family="${FONT}" font-size="12" fill="${COL.sub}"${fitAttr(ln, 12, availW)}>${esc(ln)}</text>`; cy += 17; }
  return s + `</g>`;
}
function arrow(x1, y1, x2, y2, { kind = 'local', dashed = false, label, lx, ly, lw } = {}) {
  const c = COL[KIND2COL[kind] || 'gray']; const colk = KIND2COL[kind] || 'gray';
  let s = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="2.4"${dashed ? ' stroke-dasharray="6 5"' : ''} marker-end="url(#ah-${colk})"/>`;
  if (label) { const mx = lx ?? (x1 + x2) / 2, my = ly ?? (y1 + y2) / 2; const wpx = lw ?? (label.length * 6.8 + 14); s += `<rect x="${mx - wpx / 2}" y="${my - 11}" width="${wpx}" height="18" rx="6" fill="#fff" fill-opacity="0.94"/><text x="${mx}" y="${my + 2.5}" font-family="${FONT}" font-size="11" font-weight="600" fill="${c}" text-anchor="middle">${esc(label)}</text>`; }
  return s;
}
// AWS 중첩 그룹 프레임 (라벨 탭 + 좌상단 아이콘)
function awsGroup({ x, y, w, h, label, color, fill = 'none', dashed = false, iconId }) {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}" stroke="${color}" stroke-width="2"${dashed ? ' stroke-dasharray="7 4"' : ''}/>`;
  let tx = x + 12;
  if (iconId) { s += `<image x="${x + 10}" y="${y + 9}" width="24" height="24" href="${uri(iconId)}"/>`; tx = x + 40; }
  s += `<text x="${tx}" y="${y + 25}" font-family="${FONT}" font-size="13" font-weight="800" fill="${color}"${fitAttr(label, 13, x + w - tx - 12)}>${esc(label)}</text>`;
  return s;
}
function frame(w, h, title, subs) {
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}">`;
  s += `<defs><filter id="sh" x="-4%" y="-4%" width="108%" height="120%"><feDropShadow dx="0" dy="1.5" stdDeviation="2.2" flood-color="#0F172A" flood-opacity="0.10"/></filter>${markers()}</defs>`;
  s += `<rect x="0" y="0" width="${w}" height="${h}" fill="#FFFFFF"/>`;
  s += `<text x="44" y="50" font-size="27" font-weight="800" fill="${COL.ink}">${esc(title)}</text>`;
  let yy = 76; for (const ln of subs) { s += `<text x="44" y="${yy}" font-size="13.5" fill="${COL.sub}">${esc(ln)}</text>`; yy += 19; }
  return s;
}

function buildAws() {
  const W = 1520, H = 1090;
  let s = frame(W, H, '하모니 — AWS 배포 아키텍처 (현재형 · as-built)',
    ['단일 AWS EC2(Ubuntu) 1대에 nginx · harmony-api · SQLite 동거 — 멀티 AZ / ALB / RDS / Auto Scaling "없음"이 사실(의도된 데모 범위)',
     'AWS 공식 아이콘 · 중첩 그룹 표기(AWS Cloud › Region › VPC › 가용영역 › 서브넷)']);

  // 사용자/인터넷 (클라우드 밖)
  s += card({ x: 40, y: 556, w: 158, h: 96, iconId: 'user', title: '인터넷 사용자', subs: ['토스 앱 WebView', '익명(로그인 없음)'] });

  // 중첩 그룹
  s += awsGroup({ x: 300, y: 132, w: 1184, h: 712, label: 'AWS Cloud', color: AWS.cloud, fill: '#FFFFFF', iconId: 'aws' });
  s += awsGroup({ x: 340, y: 194, w: 1104, h: 612, label: 'Region : ap-northeast-2 (서울)', color: AWS.region, dashed: true });
  s += awsGroup({ x: 384, y: 256, w: 1016, h: 514, label: 'VPC (기본 VPC)', color: AWS.vpc, fill: '#FCFFFC', iconId: 'vpc' });
  s += awsGroup({ x: 424, y: 318, w: 936, h: 414, label: '가용영역 (단일 AZ)', color: AWS.az, dashed: true });
  s += awsGroup({ x: 466, y: 380, w: 852, h: 326, label: '퍼블릭 서브넷', color: AWS.subnet, fill: '#F4FAEC' });

  // EC2 인스턴스 박스
  const ex = 506, ey = 432, ew = 772, eh = 250;
  s += `<rect x="${ex}" y="${ey}" width="${ew}" height="${eh}" rx="12" fill="#FFF7ED" stroke="${AWS.ec2}" stroke-width="2"/>`;
  s += `<image x="${ex + 14}" y="${ey + 12}" width="30" height="30" href="${uri('ec2')}"/>`;
  s += `<text x="${ex + 52}" y="${ey + 25}" font-size="14" font-weight="800" fill="#B45309">Amazon EC2 · Ubuntu 24.04 (단일 인스턴스)</text>`;
  s += `<text x="${ex + 52}" y="${ey + 42}" font-size="11.5" fill="#9A6312">Elastic IP → 3.39.167.74.nip.io · systemd 자동 기동</text>`;

  // certbot 칩
  s += card({ x: ex + 18, y: ey + 56, w: 250, h: 40, iconId: 'letsencrypt', title: 'certbot / Let’s Encrypt', subs: [], titleSize: 12.5 });
  // 프로세스 3종 (가로)
  const py = ey + 108;
  s += card({ x: ex + 18, y: py, w: 286, h: 78, iconId: 'nginx', title: 'nginx', subs: ['TLS 종단 · 리버스 프록시', '443 → 127.0.0.1:8080 · 정적 SPA'] });
  s += card({ x: ex + 320, y: py, w: 210, h: 78, iconId: 'nodedotjs', title: 'harmony-api', subs: ['Node · node:http', 'node:sqlite · 의존성 0'] });
  s += card({ x: ex + 546, y: py, w: 208, h: 78, iconId: 'sqlite', title: 'SQLite · harmony.db', subs: ['단일 파일 · 5 테이블', '⚠ 백업 없음'], accent: COL.red });
  // systemd 바
  s += `<rect x="${ex + 18}" y="${ey + eh - 36}" width="${ew - 36}" height="26" rx="8" fill="#F5F3FF" stroke="${COL.purple}" stroke-width="1.3"/>`;
  s += `<image x="${ex + 26}" y="${ey + eh - 33}" width="20" height="20" href="${uri('systemd')}"/>`;
  s += `<text x="${ex + 52}" y="${ey + eh - 18}" font-size="11.5" font-weight="700" fill="#6D28D9">systemd — 감독·자동복구·권한격리(NoNewPrivileges·ProtectSystem) · certbot.timer 자동갱신</text>`;

  // 화살표
  // 사용자 → nginx (HTTPS 443) 수평
  s += arrow(198, 604, ex + 18, py + 39, { kind: 'https', label: 'HTTPS 443 · TLS', lx: 250, ly: 560, lw: 122 });
  // certbot → nginx
  s += arrow(ex + 60, ey + 96, ex + 60, py, { kind: 'supervises' });
  // nginx → node
  s += arrow(ex + 304, py + 39, ex + 320, py + 39, { kind: 'proxy', label: '8080', lx: ex + 312, ly: py + 18, lw: 40 });
  // node → sqlite
  s += arrow(ex + 530, py + 39, ex + 546, py + 39, { kind: 'writes', label: 'R/W', lx: ex + 538, ly: py + 18, lw: 38 });

  // 설계 메모 패널 (하단)
  const my = 866;
  s += `<rect x="44" y="${my}" width="1432" height="118" rx="14" fill="#F8FAFC" stroke="#E2E8F0"/>`;
  s += `<text x="64" y="${my + 26}" font-size="14" font-weight="800" fill="${COL.ink}">설계 메모 — "작게, 그러나 의도적으로" (현재형 한계 = 정직하게 표기)</text>`;
  const memos = [
    ['#EF4444', '단일 AZ · 단일 인스턴스 → 고가용성(HA)·장애격리 없음(단일 장애 도메인)'],
    ['#EF4444', 'SQLite 단일 파일 → 복제·스냅샷·오프사이트 백업 없음 = 손실 시 전손(공개배포 1순위 보강)'],
    ['#10B981', '무의존(node:http+node:sqlite, 의존성 0) → 공급망 공격면 최소 · RDS/캐시/큐/LB 의도적 미선택'],
    ['#8B5CF6', '대체 HTTPS: cloudflared quick tunnel(harmony-tunnel.service) — 토스 WebView용 즉시 https 폴백'],
  ];
  memos.forEach((m, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const mx = 64 + col * 720, myy = my + 50 + row * 28;
    s += `<circle cx="${mx + 4}" cy="${myy - 4}" r="4" fill="${m[0]}"/><text x="${mx + 16}" y="${myy}" font-size="12" fill="#334155">${esc(m[1])}</text>`;
  });

  // AWS 그룹 색 범례
  let lx = 64; const ly = 1010;
  s += `<text x="44" y="${ly + 4}" font-size="11.5" font-weight="700" fill="${COL.sub}"></text>`;
  const leg = [['AWS Cloud', AWS.cloud], ['Region', AWS.region], ['VPC', AWS.vpc], ['가용영역', AWS.az], ['퍼블릭 서브넷', AWS.subnet], ['EC2', AWS.ec2]];
  for (const [t, c] of leg) { s += `<rect x="${lx}" y="${ly - 9}" width="16" height="12" rx="2" fill="none" stroke="${c}" stroke-width="2"/><text x="${lx + 22}" y="${ly + 1}" font-size="11.5" fill="#475569">${esc(t)}</text>`; lx += 22 + t.length * 8 + 26; }

  return s + `</svg>`;
}

const aws = buildAws();
fs.writeFileSync(path.join(TMP, 'aws.html'), `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#fff}svg{display:block}</style>${aws}`, 'utf8');
console.log('OK aws svg/html written');
