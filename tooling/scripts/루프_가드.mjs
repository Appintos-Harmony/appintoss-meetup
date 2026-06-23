// 루프 가드 (TASK-010 루프엔지니어링)
// 자율 엔지니어링 루프의 "비협상 안전 게이트"를 프롬프트 재량이 아니라 코드로 강제한다.
// 단일 기준: 경로안전·보호경로는 작업_인덱서.mjs와 공유한다.
//
// 모드(종료코드):
//   --preflight  --task <id>          반복 시작 전 안전 점검. 0=GO · 10=STOP
//   --check-diff --task <id> [--staged]  변경이 allowed_paths⊆ 안인지·보호구역 미수정인지. 0=GO · 11=STOP
//   --iteration  [--max N]            반복 카운터 증가·하드 캡. 0=진행 · 12=캡 도달
//   --reset                           반복 상태 초기화
//   --status                          현재 상태 출력
//
// 보호 불변식:
//  - main 직접 작업 금지 · detached HEAD 금지(작업 브랜치에서만).
//  - 변경은 작업의 allowed_paths 안에만. 보호 경로(.claude/settings·git-hooks·헌장·HUMAN_APPROVAL 구역) 절대 불가.
//  - 한 실행(run)의 반복 횟수에 하드 캡 → 폭주·무한루프 방지.
//  - 푸시·머지·배포는 이 가드의 범위 밖(커밋.mjs·pre-push·settings에서 사람 게이트로 별도 강제).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, loadTasks, pathSafety, globMatches, PROTECTED_PATHS } from './작업_인덱서.mjs';

const STATE_DIR = join(ROOT, '평가증빙', '루프실행_로그');
const STATE_FILE = join(STATE_DIR, '_상태.json');
const DEFAULT_MAX_ITER = 8;

const out = (s = '') => process.stdout.write(s + '\n');
const git = (args) => execFileSync('git', ['-c', 'core.quotepath=false', ...args], { cwd: ROOT, encoding: 'utf8' });
const tryGit = (args) => { try { return git(args); } catch { return null; } };

// --- 변경 파일 수집(staged/working-tree/untracked 포함, 리네임 처리) ---
export function changedPaths({ staged = false } = {}) {
  const raw = staged
    ? tryGit(['diff', '--cached', '--name-only'])
    : tryGit(['status', '--porcelain']);
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
  const p = path.replace(/\\/g, '/');
  return PROTECTED_PATHS.some((prot) => p === prot || p.startsWith(prot.replace(/\/$/, '') + '/'));
}

export function withinAllowed(path, allowed) {
  const p = path.replace(/\\/g, '/');
  return allowed.some((g) => globMatches(g, p) || p.startsWith(g.replace(/\/\*+$/, '/')));
}

// 사람 승인 구역을 가진 파일은 루프가 통째로 손대지 못한다(보수적·안전 우선).
// 마커는 동적 생성한다 — 이 스크립트 자신이 리터럴을 담아 자기참조 오탐하지 않도록.
const HA_MARKER = ['HUMAN', 'APPROVAL', 'START'].join('_');
export function touchesHumanApproval(path) {
  const abs = join(ROOT, path);
  if (!existsSync(abs)) return false;
  try { return readFileSync(abs, 'utf8').includes(HA_MARKER); } catch { return false; }
}

export function diffGuard(task, opts = {}) {
  const changed = changedPaths(opts);
  const allowed = task.allowed_paths || [];
  const violations = [];
  for (const p of changed) {
    if (isForbidden(p)) { violations.push(`보호 경로 수정 금지: ${p}`); continue; }
    if (touchesHumanApproval(p)) { violations.push(`HUMAN_APPROVAL 구역 파일 수정 금지: ${p}`); continue; }
    if (!withinAllowed(p, allowed)) violations.push(`allowed_paths 밖 변경: ${p}`);
  }
  return { ok: violations.length === 0, changed, violations };
}

function findTask(id) {
  return loadTasks().find((t) => t.id === id) || null;
}

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
  if (branch === 'main') { out('STOP: main에서 자율 작업 금지. feature/fix/chore/docs 브랜치 사용.'); process.exit(10); }
  const task = findTask(id);
  if (!task) { out(`STOP: 작업 ${id} 없음.`); process.exit(10); }
  if (!/^ready$/i.test(task.status)) { out(`STOP: ${id} status=${task.status} (Ready 아님).`); process.exit(10); }
  const safety = pathSafety(task);
  if (!safety.safe) { out(`STOP: 경로안전 위반:\n - ${safety.violations.join('\n - ')}`); process.exit(10); }
  out(`GO: 브랜치 ${branch} · ${id} Ready · 경로안전 통과. allowed=${JSON.stringify(task.allowed_paths)}`);
  process.exit(0);
}

function checkDiff(id, staged) {
  out('# 루프 가드 — check-diff');
  const task = findTask(id);
  if (!task) { out(`STOP: 작업 ${id} 없음.`); process.exit(11); }
  const r = diffGuard(task, { staged });
  out(`변경 ${r.changed.length}건: ${r.changed.join(', ') || '(없음)'}`);
  if (!r.ok) { out(`STOP: 변경 범위 위반:\n - ${r.violations.join('\n - ')}`); process.exit(11); }
  out('GO: 모든 변경이 allowed_paths 안 · 보호구역 미수정.');
  process.exit(0);
}

function iteration(max) {
  const s = readState();
  s.max = max || s.max || DEFAULT_MAX_ITER;
  if (!s.runStartedAt) s.runStartedAt = new Date().toISOString();
  if (s.iteration >= s.max) {
    out(`# 루프 가드 — iteration\n캡 도달: ${s.iteration}/${s.max}. 더 진행하지 않음(사람이 --reset).`);
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
  if (argv.includes('--reset')) { writeState({ runStartedAt: new Date().toISOString(), iteration: 0, max: maxArg || DEFAULT_MAX_ITER }); out('루프 상태 초기화.'); process.exit(0); }
  if (argv.includes('--status')) { out(JSON.stringify(readState(), null, 2)); process.exit(0); }
  if (argv.includes('--preflight')) { if (!id) { out('STOP: --task <id> 필요.'); process.exit(10); } preflight(id); }
  if (argv.includes('--check-diff')) { if (!id) { out('STOP: --task <id> 필요.'); process.exit(11); } checkDiff(id, argv.includes('--staged')); }
  if (argv.includes('--iteration')) { iteration(maxArg); }
  out('사용: --preflight|--check-diff --task <id> [--staged] | --iteration [--max N] | --reset | --status');
  process.exit(2);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
