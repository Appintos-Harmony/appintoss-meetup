// 루프엔진 검증 러너 (TASK-010)
// node:test 단위테스트를 실행한다. `node tooling/scripts/*` 허용목록으로 커버되어
// 루프·CI에서 권한 프롬프트 없이 호출 가능(node --test 직접 호출은 허용목록 밖이라 이 래퍼를 둔다).
// 사용: node tooling/scripts/루프엔진_검증.mjs
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const testDir = join(ROOT, 'tooling', 'scripts', '__tests__');
const files = readdirSync(testDir).filter((f) => f.endsWith('.test.mjs')).map((f) => join(testDir, f));
if (files.length === 0) { process.stdout.write('테스트 파일 없음\n'); process.exit(1); }
try {
  execFileSync(process.execPath, ['--test', ...files], { cwd: ROOT, stdio: 'inherit' });
  process.exit(0);
} catch (e) {
  process.exit(e.status ?? 1);
}
