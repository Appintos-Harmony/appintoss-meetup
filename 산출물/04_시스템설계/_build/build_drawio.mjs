import fs from 'node:fs';
import path from 'node:path';

const ICONDIR = 'C:/Users/김민혁/Desktop/dev/appintoss-meetup/산출물/04_시스템설계/아키텍처_아이콘';
const OUTDIR = 'C:/Users/김민혁/Desktop/dev/appintoss-meetup/산출물/04_시스템설계';

const ICON = {
  toss: 'toss.svg', react: 'react_c.svg', tonejs: 'tone.svg', mediapipe: 'mediapipe.svg',
  webstorage: 'localstorage.svg', nginx: 'nginx_c.svg', letsencrypt: 'letsencrypt.svg',
  cloudflare: 'cloudflare_c.svg', nodedotjs: 'node_c.svg', sqlite: 'sqlite_c.svg',
  systemd: 'systemd.svg', ubuntu: 'ubuntu.svg', amazonwebservices: 'aws.svg',
  githubactions: 'ghactions_c.svg', gnubash: 'terminal.svg', shield: 'shield.svg',
  user: 'user.svg', warning: 'warning.svg', pulse: 'pulse.svg',
  github: 'github_c.svg', vite: 'vite_c.svg', terminal: 'terminal.svg', globe: 'globe.svg',
};
const _c = {};
function imgStyle(id) {
  if (!ICON[id]) return '';
  if (!_c[id]) _c[id] = 'data:image/svg+xml,' + encodeURIComponent(fs.readFileSync(path.join(ICONDIR, ICON[id]), 'utf8').replace(/\n/g, ''));
  return _c[id];
}
const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const COL = { blue: '#3B82F6', green: '#10B981', amber: '#F59E0B', cyan: '#06B6D4', purple: '#8B5CF6', gray: '#6B7280', red: '#EF4444' };
const KIND = { local: COL.cyan, https: COL.green, proxy: COL.green, writes: COL.amber, supervises: COL.purple, applies: COL.purple, deploy: COL.gray, risk: COL.red };

function build(diagramName, groups, nodes, edges, W, H) {
  let id = 2; const nid = () => 'c' + (id++);
  const cells = [];
  // 그룹(배경)
  for (const g of groups) {
    const dash = g.dash ? 'dashed=1;dashPattern=8 5;' : '';
    cells.push(`<mxCell id="${nid()}" value="${xml(g.label)}" style="rounded=1;arcSize=6;whiteSpace=wrap;html=1;fillColor=${g.fill};strokeColor=${g.stroke};${dash}verticalAlign=top;align=left;spacingLeft=12;spacingTop=8;fontSize=${g.small ? 12 : 14};fontStyle=1;fontColor=${g.stroke};" vertex="1" parent="1"><mxGeometry x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" as="geometry"/></mxCell>`);
  }
  // 노드
  const ref = {};
  for (const n of nodes) {
    const cid = nid(); ref[n.id] = cid;
    const sub = n.subs && n.subs.length ? `<br><span style="font-size:10px;color:#64748B">${n.subs.join('<br>')}</span>` : '';
    const val = xml(`<b>${n.title}</b>${sub}`);
    const fill = n.fill || '#FFFFFF', stroke = n.stroke || '#E5E7EB';
    const sp = n.iconId ? 50 : 10;
    cells.push(`<mxCell id="${cid}" value="${val}" style="rounded=1;arcSize=14;whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=${stroke};align=left;verticalAlign=middle;spacingLeft=${sp};fontSize=12;fontColor=#1E293B;shadow=1;" vertex="1" parent="1"><mxGeometry x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" as="geometry"/></mxCell>`);
    if (n.iconId) {
      cells.push(`<mxCell id="${nid()}" value="" style="shape=image;imageAspect=0;aspect=fixed;image=${imgStyle(n.iconId)};" vertex="1" parent="1"><mxGeometry x="${n.x + 10}" y="${n.y + (n.h - 30) / 2}" width="30" height="30" as="geometry"/></mxCell>`);
    }
  }
  // 엣지
  for (const e of edges) {
    const c = KIND[e.kind] || COL.gray;
    const dash = (e.kind === 'deploy' || e.kind === 'risk' || e.dash) ? 'dashed=1;dashPattern=6 5;' : '';
    const lbl = e.label ? xml(e.label) : '';
    cells.push(`<mxCell id="${nid()}" value="${lbl}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;strokeColor=${c};strokeWidth=2;${dash}endArrow=block;endFill=1;fontSize=10;fontColor=${c};labelBackgroundColor=#FFFFFF;" edge="1" parent="1" source="${ref[e.s]}" target="${ref[e.t]}"><mxGeometry relative="1" as="geometry"/></mxCell>`);
  }
  const body = cells.join('\n');
  return `<mxfile host="app.diagrams.net" type="device"><diagram name="${xml(diagramName)}" id="${diagramName}">` +
    `<mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${W}" pageHeight="${H}" math="0" shadow="0"><root>` +
    `<mxCell id="0"/><mxCell id="1" parent="0"/>${body}</root></mxGraphModel></diagram></mxfile>`;
}

/* ===== 시스템 ===== */
const sysGroups = [
  { x: 48, y: 108, w: 1644, h: 104, label: 'CI · 배포 파이프라인: 사람 게이트 (코드 파이프라인은 prod 자격증명 미접촉)', fill: '#F9FAFB', stroke: '#6B7280', dash: 1 },
  { x: 48, y: 244, w: 520, h: 812, label: '클라이언트 신뢰경계 · 토스 WebView (untrusted)', fill: '#EFF6FF', stroke: '#3B82F6' },
  { x: 600, y: 244, w: 1092, h: 812, label: 'AWS EC2 · 단일 Ubuntu 인스턴스: 전 스택 동거 (HA/오토스케일/LB 없음)', fill: '#FAF9FF', stroke: '#7C3AED' },
  { x: 622, y: 298, w: 332, h: 540, label: '엣지 · TLS 종단 (유일 public 면)', fill: '#ECFDF5', stroke: '#10B981', small: 1 },
  { x: 976, y: 298, w: 326, h: 300, label: '애플리케이션 · loopback 전용', fill: '#FFFBEB', stroke: '#F59E0B', small: 1 },
  { x: 976, y: 616, w: 326, h: 222, label: '데이터 · SQLite 단일 파일', fill: '#FEF2F2', stroke: '#EF4444', small: 1 },
];
const sysNodes = [
  { id: 'ci', x: 70, y: 150, w: 350, h: 46, iconId: 'githubactions', title: 'GitHub Actions CI', subs: ['verify-docs · verify-code(tsc+vitest)'] },
  { id: 'deploy', x: 480, y: 150, w: 320, h: 46, iconId: 'gnubash', title: 'deploy.sh (사람 전용)', subs: ['scp → systemctl enable --now'] },
  { id: 'htop', x: 860, y: 150, w: 300, h: 46, iconId: 'pulse', title: 'GET /healthz 검증', subs: ['배포 후 기동 확인 게이트'] },
  { id: 'user', x: 70, y: 300, w: 476, h: 50, iconId: 'user', title: '사용자 (토스 앱 이용자)', subs: ['로그인 없음 · 익명 식별만'] },
  { id: 'spa', x: 70, y: 362, w: 476, h: 64, iconId: 'react', title: '미니앱 프론트 (Granite SPA · 정적 번들)', subs: ['React 18.3 · TS strict · Vite 6 · TDS', 'VITE_API_BASE=<https> 주입'] },
  { id: 'capture', x: 70, y: 438, w: 476, h: 58, iconId: 'mediapipe', title: '입력 캡처 → chordReducer', subs: ['MediaPipe 4코드존 · 터치 폴백 · tick 기록'] },
  { id: 'audio', x: 70, y: 508, w: 476, h: 54, iconId: 'tonejs', title: '오디오 엔진 (Tone.js · 클라 완결)', subs: ['PolySynth 합성 · 트랙별 음색 동시재생'] },
  { id: 'store', x: 70, y: 574, w: 476, h: 50, iconId: 'webstorage', title: 'localStorage (내 곡)', subs: ['솔로 오프라인 완결 · 무동기화'] },
  { id: 'note', x: 70, y: 640, w: 476, h: 96, title: 'WebView 호스트 제약 (신뢰경계 밖)', subs: ['HTTPS 강제 · 핀치줌 비활성 · 자체 뒤로가기 금지', '익명키=식별일 뿐 신원 보증 아님', '솔로 연주 = 클라 완결(서버 호출 0)'], fill: '#FFFFFF', stroke: '#DBEAFE' },
  { id: 'nginx', x: 638, y: 342, w: 300, h: 72, iconId: 'nginx', title: 'nginx: TLS 종단 + 프록시', subs: ['443 · 3.39.167.74.nip.io · try_files', '/sessions·/community·/healthz → 8080 (+XFF)'] },
  { id: 'certbot', x: 638, y: 426, w: 300, h: 50, iconId: 'letsencrypt', title: 'certbot / Let’s Encrypt', subs: ['certbot.timer 인증서 자동 갱신'] },
  { id: 'cloudflared', x: 638, y: 488, w: 300, h: 58, iconId: 'cloudflare', title: 'cloudflared quick tunnel (대체)', subs: ['즉시 https URL · CDN 아님'] },
  { id: 'healthz', x: 638, y: 560, w: 300, h: 50, iconId: 'pulse', title: 'GET /healthz (관측 단일 신호)', subs: ['메트릭·로그집계·대시보드 없음'] },
  { id: 'api', x: 992, y: 342, w: 294, h: 82, iconId: 'nodedotjs', title: 'harmony-api (Node 단일 프로세스)', subs: ['node:http + node:sqlite · 의존성 0', '127.0.0.1:8080 · 9경로 / 10 오퍼레이션'] },
  { id: 'security', x: 992, y: 434, w: 294, h: 92, iconId: 'shield', title: '인프로세스 보안 (외부 미들웨어 0)', subs: ['IP 레이트리밋 · 검증 · 멱등', '신고 자동숨김 · 코드=접근권한'] },
  { id: 'sqlite', x: 992, y: 656, w: 294, h: 70, iconId: 'sqlite', title: 'SQLite (harmony.db)', subs: ['node:sqlite · 단일 라이터 · 5개 테이블'] },
  { id: 'backup', x: 992, y: 738, w: 294, h: 64, iconId: 'warning', title: '백업 공백 (미존재 · 명시)', subs: ['파일 손실 = 전손 · 1순위 보강'], fill: '#FFFFFF', stroke: '#FECACA' },
  { id: 'systemd', x: 638, y: 862, w: 648, h: 58, iconId: 'systemd', title: 'systemd: 감독 · 자동복구 · 권한격리', subs: ['Restart=on-failure · NoNewPrivileges · ProtectSystem=full · certbot.timer'] },
];
const sysEdges = [
  { s: 'ci', t: 'deploy', kind: 'deploy' }, { s: 'deploy', t: 'htop', kind: 'deploy' },
  { s: 'deploy', t: 'api', kind: 'deploy', label: 'SSH 게이트(사람)' },
  { s: 'spa', t: 'nginx', kind: 'https', label: 'HTTPS (합주/공유만)' },
  { s: 'nginx', t: 'api', kind: 'proxy', label: '프록시 +XFF' },
  { s: 'certbot', t: 'nginx', kind: 'supervises' }, { s: 'cloudflared', t: 'api', kind: 'proxy', dash: 1 },
  { s: 'api', t: 'sqlite', kind: 'writes', label: '파일 R/W' }, { s: 'sqlite', t: 'backup', kind: 'risk', label: '백업 공백' },
  { s: 'systemd', t: 'api', kind: 'supervises' }, { s: 'systemd', t: 'nginx', kind: 'supervises' },
];

/* ===== 흐름 ===== */
const yA = 262, yS = 496, yB = 761, SW = 182, SH = 88;
const C = { c1: 250, c2: 452, c3: 654, c4: 856, c5: 1058, c6: 1260, c7: 1500 };
const flowGroups = [
  { x: 48, y: 150, w: 1644, h: 224, label: '사용자 A', fill: '#EFF6FF', stroke: '#3B82F6' },
  { x: 48, y: 398, w: 1644, h: 196, label: '엣지 · 서버', fill: '#ECFDF5', stroke: '#10B981' },
  { x: 48, y: 618, w: 1644, h: 286, label: '사용자 B', fill: '#ECFEFF', stroke: '#06B6D4' },
];
const S = (id, cx, cy, iconId, title, subs) => ({ id, x: cx - SW / 2, y: cy - SH / 2, w: SW, h: SH, iconId, title, subs });
const flowNodes = [
  S('a_play', C.c1, yA, 'mediapipe', '① 연주(터치/제스처)', ['4코드존 · 터치 폴백']),
  S('a_record', C.c2, yA, 'react', '② chordReducer 기록', ['tick 이벤트(ms 금지)']),
  S('a_local', C.c3, yA, 'webstorage', '③ localStorage 저장', ['솔로 완결 · 서버 0']),
  S('a_share', C.c4, yA, 'react', '④ 공유 POST /sessions', ['익명키 부착(인증X)']),
  S('a_clip', C.c7, yA, 'react', '⑧ 코드 → 클립보드', ['out-of-band 전달']),
  S('f_nginx', C.c5, yS, 'nginx', '⑤ nginx TLS 종단', ['443 → 8080 · XFF']),
  S('f_api', C.c6, yS, 'nodedotjs', '⑥ harmony-api', ['레이트리밋·검증·멱등']),
  S('f_db', C.c7, yS, 'sqlite', '⑦ 코드 발급 → SQLite', ['sessions INSERT']),
  S('b_browse', C.c1, yB, 'react', '⑨ 커뮤니티 보드', ['GET /community']),
  S('b_receive', C.c3, yB, 'sqlite', '⑩ 받기 GET /:code', ['친구 트랙 · origin']),
  S('b_layer', C.c4, yB, 'sqlite', '⑪ 레이어 얹기', ['POST /tracks · fork+1']),
  S('b_poll', C.c5, yB, 'react', '⑫ 1.5초 폴링', ['실시간 아님 · pull']),
  S('b_ensemble', C.c6, yB, 'tonejs', '⑬ 합주 듣기(Tone.js)', ['트랙별 음색 동시재생']),
];
const flowEdges = [
  { s: 'a_play', t: 'a_record', kind: 'local' }, { s: 'a_record', t: 'a_local', kind: 'local' }, { s: 'a_local', t: 'a_share', kind: 'local' },
  { s: 'a_share', t: 'f_nginx', kind: 'https', label: 'HTTPS' }, { s: 'f_nginx', t: 'f_api', kind: 'proxy' }, { s: 'f_api', t: 'f_db', kind: 'writes' },
  { s: 'f_db', t: 'a_clip', kind: 'https', label: '코드 응답' },
  { s: 'a_clip', t: 'b_browse', kind: 'deploy', label: '코드/링크 외부 전달(out-of-band)' },
  { s: 'b_browse', t: 'b_receive', kind: 'local' }, { s: 'b_receive', t: 'f_nginx', kind: 'https', label: 'GET /:code' },
  { s: 'b_receive', t: 'b_layer', kind: 'local' }, { s: 'b_layer', t: 'f_api', kind: 'https', label: 'POST /tracks' },
  { s: 'b_layer', t: 'b_poll', kind: 'local' }, { s: 'b_poll', t: 'f_nginx', kind: 'https', label: '폴링 GET' },
  { s: 'b_poll', t: 'b_ensemble', kind: 'local' }, { s: 'b_ensemble', t: 'b_layer', kind: 'supervises', dash: 1, label: '출처 루프 순환' },
];

/* ===== AWS 배포(중첩 그룹) ===== */
const awsGroups = [
  { x: 300, y: 132, w: 1184, h: 712, label: 'AWS Cloud', fill: '#FFFFFF', stroke: '#232F3E' },
  { x: 340, y: 194, w: 1104, h: 612, label: 'Region : ap-northeast-2 (서울)', fill: 'none', stroke: '#00A4A6', dash: 1, small: 1 },
  { x: 384, y: 256, w: 1016, h: 514, label: 'VPC (기본 VPC)', fill: '#FCFFFC', stroke: '#248823', small: 1 },
  { x: 424, y: 318, w: 936, h: 414, label: '가용영역 (단일 AZ)', fill: 'none', stroke: '#00A4A6', dash: 1, small: 1 },
  { x: 466, y: 380, w: 852, h: 326, label: '퍼블릭 서브넷', fill: '#F4FAEC', stroke: '#7AA116', small: 1 },
  { x: 506, y: 432, w: 772, h: 250, label: 'Amazon EC2 · Ubuntu 24.04 (단일 인스턴스) · EIP→3.39.167.74.nip.io', fill: '#FFF7ED', stroke: '#ED7100', small: 1 },
];
const awsNodes = [
  { id: 'user', x: 40, y: 556, w: 158, h: 96, iconId: 'user', title: '인터넷 사용자', subs: ['토스 앱 WebView · 익명'] },
  { id: 'certbot', x: 524, y: 490, w: 250, h: 40, iconId: 'letsencrypt', title: 'certbot / Let’s Encrypt', subs: [] },
  { id: 'nginx', x: 524, y: 540, w: 286, h: 80, iconId: 'nginx', title: 'nginx: TLS 종단·프록시', subs: ['443 → 127.0.0.1:8080 · 정적 SPA'] },
  { id: 'node', x: 826, y: 540, w: 210, h: 80, iconId: 'nodedotjs', title: 'harmony-api', subs: ['node:http + node:sqlite · 의존성 0'] },
  { id: 'sqlite', x: 1052, y: 540, w: 208, h: 80, iconId: 'sqlite', title: 'SQLite · harmony.db', subs: ['단일 파일 · 5 테이블 · ⚠ 백업 없음'], fill: '#FFFFFF', stroke: '#FECACA' },
  { id: 'systemd', x: 524, y: 648, w: 736, h: 30, iconId: 'systemd', title: 'systemd: 감독·권한격리(NoNewPrivileges·ProtectSystem) · certbot.timer', subs: [] },
];
const awsEdges = [
  { s: 'user', t: 'nginx', kind: 'https', label: 'HTTPS 443 · TLS' },
  { s: 'certbot', t: 'nginx', kind: 'supervises' },
  { s: 'nginx', t: 'node', kind: 'proxy', label: '8080' },
  { s: 'node', t: 'sqlite', kind: 'writes', label: 'R/W' },
];

fs.writeFileSync(path.join(OUTDIR, '하모니_시스템_아키텍처.drawio'), build('하모니_전체_시스템_아키텍처', sysGroups, sysNodes, sysEdges, 1740, 1180), 'utf8');
fs.writeFileSync(path.join(OUTDIR, '하모니_서비스_흐름도.drawio'), build('하모니_합주공유_서비스흐름도', flowGroups, flowNodes, flowEdges, 1740, 1020), 'utf8');
fs.writeFileSync(path.join(OUTDIR, '하모니_AWS_배포_아키텍처.drawio'), build('하모니_AWS_배포_아키텍처', awsGroups, awsNodes, awsEdges, 1520, 1090), 'utf8');

/* ===== 배포·서비스 구성도 (Apps-in-Toss 프로덕션) ===== */
const depGroups = [
  { x: 52, y: 140, w: 1736, h: 196, label: 'CI · 배포: GitHub Actions 검증 후 두 갈래 (프론트=Apps-in-Toss / 백엔드=AWS)', fill: '#EFF6FF', stroke: '#93C5FD' },
  { x: 300, y: 410, w: 700, h: 470, label: 'Apps-in-Toss · 토스 슈퍼앱 (미니앱 런타임 · 유통 · 익명식별, 자체 서버는 아님)', fill: '#EFF5FF', stroke: '#3182F6' },
  { x: 1140, y: 410, w: 648, h: 470, label: 'AWS EC2 (Ubuntu): 합주·공유 API (systemd · 무의존)', fill: '#FFF7ED', stroke: '#F59E0B' },
];
const depNodes = [
  { id: 'gh', x: 84, y: 210, w: 196, h: 64, iconId: 'github', title: '① GitHub', subs: ['소스'] },
  { id: 'gha', x: 332, y: 210, w: 250, h: 64, iconId: 'githubactions', title: '② GitHub Actions', subs: ['검증 tsc·vitest·비밀값'] },
  { id: 'front', x: 700, y: 168, w: 430, h: 64, iconId: 'vite', title: '③a 프론트: ait build → ait deploy', subs: ['토스 개발자 콘솔 → 심사 → 유통'] },
  { id: 'back', x: 700, y: 256, w: 430, h: 64, iconId: 'terminal', title: '③b 백엔드: deploy.sh (사람)', subs: ['scp + systemctl → AWS'] },
  { id: 'user', x: 52, y: 590, w: 196, h: 150, iconId: 'user', title: '사용자', subs: ['실제 토스 앱 이용자(폰)', '토스 앱에서 하모니 실행', '익명 · 로그인 없음'] },
  { id: 'miniapp', x: 336, y: 490, w: 628, h: 92, iconId: 'react', title: '하모니 미니앱 (WebView 정적 번들)', subs: ['React 18 · Granite · TDS (토스가 유통·로딩)', 'appName=harmony 콘솔 등록(현 meetup-lite 임시)'] },
  { id: 'anonkey', x: 336, y: 602, w: 628, h: 84, iconId: 'toss', title: 'getAnonymousKey (익명 식별 SDK)', subs: ['로그인 없음 · 닉네임 · ⚠ 실연동 출시 전(현재 mock)'] },
  { id: 'audio', x: 336, y: 706, w: 628, h: 92, iconId: 'tonejs', title: 'Tone.js 오디오 · 카메라 제스처(MediaPipe)', subs: ['솔로 연주 = WebView 완결(서버 0) · localStorage'] },
  { id: 'nginx', x: 1176, y: 490, w: 576, h: 84, iconId: 'nginx', title: 'nginx: HTTPS 443 (Let’s Encrypt)', subs: ['3.39.167.74.nip.io · 프록시 · 인증서 자동갱신'] },
  { id: 'api', x: 1176, y: 588, w: 576, h: 84, iconId: 'nodedotjs', title: 'harmony-api (Node 단일 프로세스)', subs: ['node:http + node:sqlite · 의존성 0 · 127.0.0.1:8080'] },
  { id: 'sqlite', x: 1176, y: 686, w: 576, h: 80, iconId: 'sqlite', title: 'SQLite · harmony.db', subs: ['단일 파일 · 5 테이블 · ⚠ 백업 없음'], fill: '#FFFFFF', stroke: '#FECACA' },
  { id: 'systemd', x: 1176, y: 780, w: 576, h: 40, iconId: 'systemd', title: 'systemd: 감독·권한격리 · certbot.timer', subs: [] },
];
const depEdges = [
  { s: 'gh', t: 'gha', kind: 'deploy' }, { s: 'gha', t: 'front', kind: 'deploy' }, { s: 'gha', t: 'back', kind: 'deploy' },
  { s: 'front', t: 'miniapp', kind: 'deploy', dash: 1, label: '콘솔 등록·심사·유통' },
  { s: 'back', t: 'nginx', kind: 'deploy', dash: 1, label: 'scp + systemctl' },
  { s: 'user', t: 'miniapp', kind: 'local', label: '토스 앱 진입' },
  { s: 'miniapp', t: 'nginx', kind: 'https', label: 'HTTPS (합주/공유만) · VITE_API_BASE=운영 URL' },
  { s: 'nginx', t: 'api', kind: 'proxy', label: '8080' }, { s: 'api', t: 'sqlite', kind: 'writes', label: 'R/W' },
];
fs.writeFileSync(path.join(OUTDIR, '하모니_배포_인프라_구성도.drawio'), build('하모니_배포_서비스_구성도', depGroups, depNodes, depEdges, 1840, 1040), 'utf8');

/* ===== ERD ===== */
const erdNodes = [
  { id: 'sessions', x: 600, y: 180, w: 390, h: 188, title: 'sessions  〔PK code〕', subs: ['name · bpm · created_at', 'published · hidden (0/1)', 'author · author_key', 'origin_code → code  〔FK 자기참조〕', 'play_count', 'content_hash · track_count (중복방지)'], stroke: '#4F46E5' },
  { id: 'tracks', x: 96, y: 214, w: 340, h: 150, title: 'tracks  〔PK id〕', subs: ['code → sessions  〔FK〕', 'owner · author_key', 'events(JSON) · instrument · style', 'created_at'], stroke: '#2563EB' },
  { id: 'reactions', x: 1050, y: 200, w: 360, h: 124, title: 'reactions (좋아요)', subs: ['code → sessions  〔FK〕', 'anon_key · created_at', 'UNIQUE(code, anon_key)  〔U〕'], stroke: '#DB2777' },
  { id: 'comments', x: 600, y: 560, w: 390, h: 150, title: 'comments  〔PK id〕', subs: ['code → sessions  〔FK〕', 'author · author_key · text(≤200)', 'reports · hidden', 'created_at'], stroke: '#0D9488' },
  { id: 'creports', x: 1050, y: 560, w: 360, h: 124, title: 'comment_reports (신고)', subs: ['comment_id → comments  〔FK〕', 'reporter_key · created_at', 'UNIQUE(comment_id, reporter_key)  〔U〕'], stroke: '#D97706' },
  { id: 'missing', x: 96, y: 560, w: 360, h: 110, title: '⌀ users / auth: 없음', subs: ['익명키만(author_key·anon_key·reporter_key)', '= 인증 없음(의도된 데모 범위)'], fill: '#FFF7ED', stroke: '#FB923C' },
];
const erdEdges = [
  { s: 'tracks', t: 'sessions', kind: 'deploy', label: 'N : 1 (code)' },
  { s: 'sessions', t: 'reactions', kind: 'deploy', label: '1 : N (code)' },
  { s: 'sessions', t: 'comments', kind: 'deploy', label: '1 : N (code)' },
  { s: 'comments', t: 'creports', kind: 'deploy', label: '1 : N (comment_id)' },
  { s: 'sessions', t: 'sessions', kind: 'supervises', label: 'origin_code → code (파생 트리)' },
];
fs.writeFileSync(path.join(OUTDIR, '하모니_데이터모델_ERD.drawio'), build('하모니_데이터모델_ERD', [], erdNodes, erdEdges, 1660, 1080), 'utf8');

/* ===== DFD ===== */
const dfdGroups = [
  { x: 60, y: 150, w: 470, h: 590, label: '신뢰경계 ① 기기 · 토스 WebView (untrusted)', fill: '#FEF2F2', stroke: '#EF4444', dash: 1 },
  { x: 610, y: 300, w: 300, h: 300, label: '신뢰경계 ② 엣지 · 유일 public 면 (443)', fill: '#F0FDFA', stroke: '#0D9488', dash: 1 },
  { x: 990, y: 250, w: 600, h: 430, label: '신뢰경계 ③ 앱 · loopback 127.0.0.1', fill: '#FFFBEB', stroke: '#F59E0B', dash: 1 },
];
const dfdNodes = [
  { id: 'client', x: 100, y: 250, w: 390, h: 96, iconId: 'user', title: '익명 클라이언트 (외부 엔티티)', subs: ['토스 WebView · 미니앱(SPA)'] },
  { id: 'ls', x: 150, y: 540, w: 300, h: 76, iconId: 'webstorage', title: 'localStorage (데이터스토어)', subs: ['내 곡 (솔로)'] },
  { id: 'nginx', x: 660, y: 392, w: 200, h: 92, iconId: 'nginx', title: 'nginx (프로세스)', subs: ['TLS 종단 · 443'] },
  { id: 'node', x: 1064, y: 356, w: 200, h: 100, iconId: 'nodedotjs', title: 'Node API (프로세스)', subs: ['node:http · 무의존'] },
  { id: 'db', x: 1360, y: 380, w: 200, h: 84, iconId: 'sqlite', title: 'SQLite .db (데이터스토어)', subs: ['5 테이블'] },
];
const dfdEdges = [
  { s: 'client', t: 'ls', kind: 'local', label: '솔로 = 경계 안 완결(서버 0)' },
  { s: 'client', t: 'nginx', kind: 'supervises', label: 'HTTPS 443 · author_key · origin_code=capability' },
  { s: 'nginx', t: 'node', kind: 'proxy', label: 'loopback proxy +XFF' },
  { s: 'node', t: 'db', kind: 'writes', label: 'R / W' },
  { s: 'client', t: 'nginx', kind: 'risk', dash: 1, label: '잔여위험: code 열거 · 신고자 위조' },
];
fs.writeFileSync(path.join(OUTDIR, '하모니_신뢰경계_DFD.drawio'), build('하모니_신뢰경계_DFD', dfdGroups, dfdNodes, dfdEdges, 1660, 940), 'utf8');

/* ===== 상태도 ===== */
const stNodes = [
  { id: 'draft', x: 150, y: 200, w: 220, h: 86, title: '로컬 초안', subs: ['클라 전용 · localStorage · 서버 0'], stroke: '#0EA5E9', fill: '#F0F9FF' },
  { id: 'pub', x: 500, y: 200, w: 240, h: 96, title: '게시됨', subs: ['published=1 · 보드 노출'], stroke: '#16A34A', fill: '#F0FDF4' },
  { id: 'fork', x: 910, y: 200, w: 250, h: 96, title: '파생 곡 (자식)', subs: ['자식 세션 · 부모 forkCount+1'], stroke: '#4F46E5', fill: '#EEF2FF' },
  { id: 'shid', x: 500, y: 372, w: 240, h: 74, title: '숨김 (소유자 수동)', subs: ['hidden=1 · seed 거부'], stroke: '#DC2626', fill: '#FEF2F2' },
  { id: 'shown', x: 500, y: 560, w: 240, h: 86, title: '표시됨', subs: ['hidden=0 · 목록 노출'], stroke: '#0D9488', fill: '#F0FDFA' },
  { id: 'autohide', x: 930, y: 560, w: 260, h: 96, title: '자동 숨김', subs: ['hidden=1 · 자동 모더레이션'], stroke: '#DC2626', fill: '#FEF2F2' },
];
const stEdges = [
  { s: 'draft', t: 'pub', kind: 'deploy', label: 'POST /sessions [published] / code 발급' },
  { s: 'pub', t: 'pub', kind: 'deploy', label: 'GET /:code / play_count++' },
  { s: 'pub', t: 'fork', kind: 'supervises', label: '타인 publish [origin_code=this] / fork+1' },
  { s: 'pub', t: 'shid', kind: 'deploy', label: 'POST /:code/hide [author_key·≠seed]' },
  { s: 'shown', t: 'shown', kind: 'deploy', label: 'POST .../report [distinct] / reports+1' },
  { s: 'shown', t: 'autohide', kind: 'risk', label: 'reports ≥ 3 (THRESHOLD) / hidden=1 ★유일 자동전이' },
];
fs.writeFileSync(path.join(OUTDIR, '하모니_라이프사이클_상태도.drawio'), build('하모니_라이프사이클_상태도', [], stNodes, stEdges, 1640, 940), 'utf8');

console.log('OK drawio: 시스템', sysNodes.length, '흐름', flowNodes.length, 'AWS', awsNodes.length, '배포', depNodes.length, 'ERD', erdNodes.length, 'DFD', dfdNodes.length, '상태도', stNodes.length);
