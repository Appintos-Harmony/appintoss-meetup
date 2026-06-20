// 커밋 헬퍼
// conventional 메시지로 안전 커밋한다(스테이징 + pre-commit 훅의 비밀값 스캔).
// 푸시는 하지 않는다(푸시는 사람 허락 게이트, CLAUDE.md §16 / rules/git.md).
// 사용: node tooling/scripts/커밋.mjs --message "type(scope): 설명"
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = (s = '') => process.stdout.write(s + '\n');
const idx = process.argv.indexOf('--message');
const msg = idx >= 0 ? process.argv[idx + 1] : '';

if (!msg) {
  out('사용: node tooling/scripts/커밋.mjs --message "type(scope): 설명"');
  process.exit(2);
}
if (!/^(feat|fix|test|docs|chore|refactor|perf|build|ci)(\([^)]+\))?: .+/.test(msg)) {
  out('커밋 메시지는 conventional 형식이어야 합니다. 예: feat(meetup): add capacity check');
  process.exit(2);
}

let branch = '';
try { branch = execSync('git symbolic-ref --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* unborn/detached */ }
if (branch === 'main') out('주의: 현재 브랜치 main. feature 브랜치 권장(부트스트랩 1회는 허용).');

try {
  execSync('git add -A', { cwd: ROOT, stdio: 'inherit' });
  // pre-commit 훅(tooling/git-hooks/pre-commit)이 비밀값 스캔을 수행한다.
  execSync('git commit -m ' + JSON.stringify(msg), { cwd: ROOT, stdio: 'inherit' });
  out('\n커밋 완료: ' + msg);
  out('푸시는 사람 허락 후 별도로 실행하세요(main은 PR 사용).');
} catch {
  out('\n커밋 실패: pre-commit 훅 차단(비밀값) 또는 변경 없음. 위 출력을 확인하세요.');
  process.exit(1);
}
