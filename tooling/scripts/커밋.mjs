// 커밋 헬퍼 (TASK-010)
// conventional 메시지로 안전 커밋한다. 푸시는 하지 않는다(사람 허락 게이트, .claude/rules/git.md).
// 사용:
//   node tooling/scripts/커밋.mjs --message "type(scope): 설명" --path <경로> [--path <경로> ...]
//   node tooling/scripts/커밋.mjs --message "..." --all            # 전체 스테이징(명시 옵트인)
// 옵션: --body "본문" · --allow-main(부트스트랩: 커밋 0개 main에서만) · --include-staged(기존 staged 허용)
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, isAbsolute, relative } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
process.env.GIT_LITERAL_PATHSPECS = '1'; // pathspec magic 비활성(모든 경로를 리터럴로 강제)
const out = (s = '') => process.stdout.write(s + '\n');
const fail = (s, code = 1) => { out(s); process.exit(code); };
const git = (args, opts = {}) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', ...opts });
const tryGit = (args) => {
  try { execFileSync('git', args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }); return true; }
  catch { return false; }
};

const USAGE = '사용: node tooling/scripts/커밋.mjs --message "type(scope): 설명" (--path <경로> ... | --all) [--body ...] [--allow-main] [--include-staged]';

// --- 인자 파싱 ---
const argv = process.argv.slice(2);
let message = '', body = '';
const paths = [];
let useAll = false, allowMain = false, includeStaged = false;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--message') message = argv[++i] ?? '';
  else if (a === '--body') body = argv[++i] ?? '';
  else if (a === '--path') paths.push(argv[++i] ?? '');
  else if (a === '--all') useAll = true;
  else if (a === '--allow-main') allowMain = true;
  else if (a === '--include-staged') includeStaged = true;
  else fail(`알 수 없는 인자: ${a}\n${USAGE}`, 2);
}

// --- 메시지 검증 ---
if (!message) fail(USAGE, 2);
if (!/^(feat|fix|test|docs|chore|refactor|perf|build|ci)(\([^)]+\))?: .+/.test(message))
  fail('커밋 메시지는 conventional 형식이어야 합니다. 예: feat(meetup): add capacity check', 2);

// --- 저장소·브랜치(④ detached HEAD 차단) ---
if (!tryGit(['rev-parse', '--is-inside-work-tree'])) fail('git 저장소가 아닙니다.', 1);
const hasCommit = tryGit(['rev-parse', '--verify', 'HEAD']);
let branch;
try { branch = git(['symbolic-ref', '--short', 'HEAD']).trim(); }
catch { fail('detached HEAD 상태입니다. 브랜치를 체크아웃한 뒤 커밋하세요.', 1); }

// --- ② main 보호 ---
if (branch === 'main') {
  if (hasCommit) fail('main 직접 커밋 금지(커밋 존재). feature/fix/chore/docs 브랜치를 사용하세요.', 1);
  if (!allowMain) fail('main 부트스트랩 커밋은 --allow-main 필요(커밋 0개일 때만).', 1);
  out('주의: main 부트스트랩 커밋(--allow-main).');
} else if (allowMain) {
  out('알림: --allow-main은 main·커밋0에서만 유효 → 무시.');
}

// --- 스테이징 방식 ---
if (useAll && paths.length) fail('--all과 --path를 동시에 쓸 수 없습니다.', 2);
if (!useAll && paths.length === 0) fail('스테이징 대상이 없습니다. --path <경로> 반복 또는 --all을 지정하세요.', 2);

// --- ⑤ 기존 staged 변경 ---
if (hasCommit) {
  const pre = git(['diff', '--cached', '--name-only']).trim();
  if (pre && !includeStaged) fail('이미 스테이징된 변경이 있습니다. 정리하거나 --include-staged로 명시하세요.\n' + pre, 1);
}

// --- 스테이징(③ 배열 인자 + `--`, ⑥ 경로 안전, ⑧ --all 옵트인) ---
if (useAll) {
  out('스테이징: 전체(--all)');
  git(['add', '-A'], { stdio: 'inherit' });
} else {
  for (const p of paths) {
    if (!p) fail('빈 --path 값이 있습니다.', 2);
    if (p.startsWith(':')) fail(`pathspec magic 금지(':' 시작): ${p}`, 2);
    if (isAbsolute(p)) fail(`절대경로 금지: ${p}`, 2);
    const rel = relative(ROOT, resolve(ROOT, p));
    if (rel === '' || rel.startsWith('..')) fail(`repo 밖 경로 금지: ${p}`, 2);
    if (rel.split(/[\\/]/).includes('.git')) fail(`.git 내부 경로 금지: ${p}`, 2);
  }
  out('스테이징: ' + paths.join(', '));
  git(['add', '--', ...paths], { stdio: 'inherit' });
}

// --- ③ 빈 스테이징 차단 ---
if (tryGit(['diff', '--cached', '--quiet'])) fail('스테이징된 변경이 없습니다. 커밋 중단.', 1);

// --- ⑦ 커밋 직전 원문 출력 ---
out('\n=== git diff --cached --name-status ===');
out(git(['diff', '--cached', '--name-status']).trimEnd());
out('=== git status --short ===');
out(git(['status', '--short']).trimEnd());

// --- 커밋(pre-commit 비밀값 훅 경유) ---
const cargs = ['commit', '-m', message];
if (body) cargs.push('-m', body);
out('\n커밋 실행...');
try { git(cargs, { stdio: 'inherit' }); }
catch { fail('커밋 실패: pre-commit 훅 차단 또는 오류. 위 출력 확인.', 1); }
out(`커밋 완료 (브랜치 ${branch}): ${message}`);
out('푸시는 사람 허락 후 별도 실행(main은 PR).');
