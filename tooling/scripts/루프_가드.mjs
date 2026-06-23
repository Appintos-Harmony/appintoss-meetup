// 루프 가드 (TASK-010 루프엔지니어링)
// 자율 엔지니어링 루프의 "비협상 안전 게이트"를 프롬프트 재량이 아니라 코드로 강제한다.
// 경로 비교·보호 판정은 작업_인덱서.mjs의 canonicalize/isUnderProtected를 공유한다(단일 기준).
//
// 모드(종료코드):
//   --preflight  --task <id>             반복 시작 전 안전 점검. 0=GO · 10=STOP
//   --check-diff --task <id> [--staged]  변경이 allowed_paths⊆·forbidden 미위반·보호구역 미수정·게이트 있는 경로인지. 0=GO · 11=STOP
//   --iteration  [--max N]               반복 카운터 증가·단조 하드 캡. 0=진행 · 12=캡 도달
//   --reset                              반복 상태 초기화(사람 전용)
//   --status                             현재 상태 출력
//
// 보호 불변식: main/detached 금지 · 변경은 allowed_paths 안 · 보호경로(.claude·tooling·헌장·HUMAN_APPROVAL) 불가
//  · 작업 forbidden_paths 강제 · 자동 게이트 없는 코드경로(apps/api·packages·infra)는 사람 검증 · 반복 단조 캡.
//  · 푸시·머지·배포는 가드 범위 밖(커밋.mjs·pre-push·settings 사람 게이트).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, loadTasks, pathSafety, globMatches, canonicalize, isUnderProtected } from './작업_인덱서.mjs';

const STATE_DIR = join(ROOT, '평가증빙', '루프실행_로그');
const STATE_FILE = join(STATE_DIR, '_상태.json');
const DEFAULT_MAX_ITER = 8;
const ABS_MAX_ITER = 20; // --max로도 못 넘는 절대 상한(폭주 방지).

const out = (s = '') => process.stdout.write(s + '\n');
const git = (args) => execFileSync('git', ['-c', 'core.quotepath=false', ...args], { cwd: ROOT, encoding: 'utf8' });
const tryGit = (args) => { try { return git(args); } catch { return null; } };

// --- 변경 파일 수집(staged/working-tree/untracked 포함, 리네임 처리) ---
export function changedPaths({ staged = false } = {}) {
  const raw = staged ? tryGit(['diff', '--cached', '--name-only']) : tryGit(['status', '--porcelain']);
  if (raw == null) return [];
  const paths = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    if (staged) { paths.push(line.trim()); continue; }
    const body = line.slice(3);
    const arrow = body.indexOf(' -> ');
    paths.push((arrow >= 0 ? body.slice(arrow + 4) : body).replace(/^"|"$/g, '').trim());
  }
  return [...new Set(paths)].filter(Boolean);
}

export function isForbidden(path) {
  return isUnderProtected(path);
}

// 변경이 작업의 allowed_paths 안인가. 세그먼트 경계를 지킨다(형제 디렉터리·깊이 누수 차단).
export function withinAllowed(path, allowed) {
  const p = canonicalize(path);
  return allowed.some((g) => {
    if (globMatches(g, path)) return true;
    const cg = canonicalize(g);
    if (!cg.includes('*')) return p === cg || p.startsWith(cg + '/');      // 디렉터리/파일: 세그먼트 경계
    if (/\/\*\*$/.test(cg)) { const base = cg.replace(/\/\*\*$/, ''); return p === base || p.startsWith(base + '/'); }
    return false;                                                          // 단일 '*'는 globMatches가 한 단계로 제한
  });
}

// 자동 코드 게이트가 없는 코드 경로(검증_전체 --code 는 apps/miniapp만 커버).
export function isUngatedCode(path) {
  const p = canonicalize(path);
  if (p.startsWith('apps/miniapp/')) return false;
  return p.startsWith('apps/') || p.startsWith('packages/') || p.startsWith('infra/');
}

// 사람 승인 구역 파일은 루프가 손대지 못한다. 마커는 동적 생성(자기참조 회피).
// 워킹카피와 HEAD 양쪽, START·END 둘 다 검사 → 신규 생성·삭제·END-only 위장도 차단.
const HA_MARKERS = [['HUMAN', 'APPROVAL', 'START'].join('_'), ['HUMAN', 'APPROVAL', 'END'].join('_')];
const hasMarker = (c) => !!c && HA_MARKERS.some((m) => c.includes(m));
export function touchesHumanApproval(path) {
  const abs = join(ROOT, path);
  let working = '';
  try { if (existsSync(abs)) working = readFileSync(abs, 'utf8'); } catch { /* noop */ }
  let head = '';
  try { head = execFileSync('git', ['show', `HEAD:${path}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { /* 신규 파일 */ }
  return hasMarker(working) || hasMarker(head);
}

function matchesForbidden(path, forbidden) {
  const p = canonicalize(path);
  return forbidden.some((g) => globMatches(g, path) || p.startsWith(canonicalize(g).replace(/\/\*+$/, '') + '/') || p === canonicalize(g));
}

export function diffGuard(task, opts = {}) {
  const changed = changedPaths(opts);
  const allowed = task.allowed_paths || [];
  const forbidden = task.forbidden_paths || [];
  const violations = [];
  for (const p of changed) {
    if (isForbidden(p)) { violations.push(`보호 경로 수정 금지: ${p}`); continue; }
    if (touchesHumanApproval(p)) { violations.push(`HUMAN_APPROVAL 구역 파일 수정 금지: ${p}`); continue; }
    if (matchesForbidden(p, forbidden)) { violations.push(`작업 forbidden_paths 위반: ${p}`); continue; }
    if (!withinAllowed(p, allowed)) { violations.push(`allowed_paths 밖 변경: ${p}`); continue; }
    if (isUngatedCode(p)) violations.push(`자동 게이트 없는 코드 경로 — 사람 검증 필요: ${p}`);
  }
  return { ok: violations.length === 0, changed, violations };
}

function findTask(id) { return loadTasks().find((t) => t.id === id) || null; }

function readState() {
  if (!existsSync(STATE_FILE)) return { runStartedAt: null, iteration: 0, max: DEFAULT_MAX_ITER };
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')); } catch { return { runStartedAt: null, iteration: 0, max: DEFAULT_MAX_ITER }; }
}
function writeState(s) {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2) + '\n');
}

function preflight(id) {
  out('# 루프 가드 — preflight');
  if (!tryGit(['rev-parse', '--is-inside-work-tree'])) { out('STOP: git 저장소 아님.'); process.exit(10); }
  let branch = null;
  try { branch = git(['symbolic-ref', '--short', 'HEAD']).trim(); }
  catch { out('STOP: detached HEAD. 작업 브랜치를 체크아웃하세요.'); process.exit(10); }
  if (branch === 'main') { out('STOP: main에서 자율 작업 금지.'); process.exit(10); }
  const task = findTask(id);
  if (!task) { out(`STOP: 작업 ${id} 없음.`); process.exit(10); }
  if (task.invalid) { out(`STOP: ${id} 작업지시서 파싱 무효(게이팅 키 중복).`); process.exit(10); }
  if (!/^ready$/i.test(task.status)) { out(`STOP: ${id} status=${task.status} (Ready 아님).`); process.exit(10); }
  const safety = pathSafety(task);
  if (!safety.safe) { out(`STOP: 경로안전 위반:\n - ${safety.violations.join('\n - ')}`); process.exit(10); }
  // 활성 작업 기록 → pre-commit 백스톱이 이 작업 범위로 커밋을 강제(루프가 --guard-task를 빠뜨려도 차단).
  const s = readState(); s.activeTask = id; writeState(s);
  out(`GO: 브랜치 ${branch} · ${id} Ready · 경로안전 통과. allowed=${JSON.stringify(task.allowed_paths)} · activeTask 기록(커밋 백스톱 활성).`);
  process.exit(0);
}

// pre-commit 훅 백스톱: 루프 활성(activeTask)일 때만 staged 집합을 그 작업 범위로 강제한다.
// 루프 비활성(사람 커밋)이면 무간섭(exit 0). 코드가 강제하므로 LLM이 --guard-task를 빠뜨려도 막힌다.
function preCommit() {
  const s = readState();
  if (!s.activeTask) process.exit(0); // 루프 비활성 → 사람 커밋 간섭 안 함
  const task = findTask(s.activeTask);
  if (!task) { out(`pre-commit 백스톱: 활성 작업 ${s.activeTask} 미발견. 루프가 아니면 'node tooling/scripts/루프_가드.mjs --reset' 후 커밋.`); process.exit(1); }
  const r = diffGuard(task, { staged: true });
  if (!r.ok) {
    out(`pre-commit 백스톱 차단(활성 작업 ${s.activeTask}):\n - ${r.violations.join('\n - ')}\n루프가 아니면: node tooling/scripts/루프_가드.mjs --reset`);
    process.exit(1);
  }
  out(`pre-commit 백스톱 통과(활성 작업 ${s.activeTask}, staged ${r.changed.length}건).`);
  process.exit(0);
}

function checkDiff(id, staged) {
  out('# 루프 가드 — check-diff');
  const task = findTask(id);
  if (!task) { out(`STOP: 작업 ${id} 없음.`); process.exit(11); }
  const r = diffGuard(task, { staged });
  out(`변경 ${r.changed.length}건: ${r.changed.join(', ') || '(없음)'}`);
  if (!r.ok) { out(`STOP: 변경 범위 위반:\n - ${r.violations.join('\n - ')}`); process.exit(11); }
  out('GO: 모든 변경이 allowed_paths 안 · forbidden/보호구역/무게이트 코드 없음.');
  process.exit(0);
}

function iteration(max) {
  const s = readState();
  if (!s.runStartedAt) { s.runStartedAt = new Date().toISOString(); s.max = Math.min(max || DEFAULT_MAX_ITER, ABS_MAX_ITER); }
  else { s.max = Math.min(s.max || DEFAULT_MAX_ITER, max || s.max || DEFAULT_MAX_ITER, ABS_MAX_ITER); } // 단조: 올릴 수 없음
  if (s.iteration >= s.max) {
    out(`# 루프 가드 — iteration\n캡 도달: ${s.iteration}/${s.max}(절대상한 ${ABS_MAX_ITER}). 사람이 --reset 해야 재개.`);
    writeState(s);
    process.exit(12);
  }
  s.iteration += 1;
  writeState(s);
  out(`# 루프 가드 — iteration\n반복 ${s.iteration}/${s.max} 진행 가능.`);
  process.exit(0);
}

function main() {
  const argv = process.argv.slice(2);
  const id = argv[argv.indexOf('--task') + 1];
  const maxArg = argv.includes('--max') ? Number(argv[argv.indexOf('--max') + 1]) : 0;
  if (argv.includes('--reset')) { writeState({ runStartedAt: new Date().toISOString(), iteration: 0, max: Math.min(maxArg || DEFAULT_MAX_ITER, ABS_MAX_ITER), activeTask: null }); out('루프 상태 초기화(activeTask 해제).'); process.exit(0); }
  if (argv.includes('--status')) { out(JSON.stringify(readState(), null, 2)); process.exit(0); }
  if (argv.includes('--pre-commit')) { preCommit(); }
  if (argv.includes('--preflight')) { if (!id) { out('STOP: --task <id> 필요.'); process.exit(10); } preflight(id); }
  if (argv.includes('--check-diff')) { if (!id) { out('STOP: --task <id> 필요.'); process.exit(11); } checkDiff(id, argv.includes('--staged')); }
  if (argv.includes('--iteration')) { iteration(maxArg); }
  out('사용: --preflight|--check-diff --task <id> [--staged] | --iteration [--max N] | --reset | --status');
  process.exit(2);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
