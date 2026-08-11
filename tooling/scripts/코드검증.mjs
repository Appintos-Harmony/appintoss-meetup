// 코드 게이트 검증
// apps/miniapp 에 대해 타입검사(tsc --noEmit)와 단위테스트(vitest run)를 실행해
// 종료코드를 PASS/FAIL 로 접고 단일 종료코드로 반환한다.
// 문서/링크/비밀값 검사(검증_전체.mjs)가 잡지 못하는 "코드가 컴파일·통과하는가"를 검증한다.
// 사용: node tooling/scripts/코드검증.mjs
// 무shell·ESM·무외부의존. npx 대신 로컬 bin 을 node 로 직접 실행한다
// (Windows 에서 npx.cmd + execFileSync 가 EINVAL 로 실패하는 문제 회피).
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MINIAPP = join(ROOT, 'apps', 'miniapp');
const out = (s = '') => process.stdout.write(s + '\n');

// package.json scripts 와 대응: build:web="tsc --noEmit && vite build", test="vitest run".
// 여기서는 typecheck(tsc --noEmit)와 unit(vitest run)만 게이트로 본다(vite build 제외).
// [라벨, 로컬 bin(MINIAPP 기준), 인자]
const tools = [
  ['TypeScript (tsc --noEmit)', join('node_modules', 'typescript', 'bin', 'tsc'), ['--noEmit']],
  ['Unit (vitest run)', join('node_modules', 'vitest', 'vitest.mjs'), ['run']],
];

out('# 코드 게이트: apps/miniapp');

// node_modules 미설치 시 게이트를 실행할 수 없으므로 FAIL 로 보고한다.
if (!existsSync(join(MINIAPP, 'node_modules'))) {
  out('\napps/miniapp/node_modules 없음. `npm install`(apps/miniapp) 후 다시 실행하세요.');
  out('\n전체 결과: FAIL · 코드 게이트 (의존성 미설치)');
  process.exit(1);
}

let failed = 0;
const summary = [];
for (const [label, bin, args] of tools) {
  const binPath = join(MINIAPP, bin);
  let code = 0;
  let output = '';
  if (!existsSync(binPath)) {
    code = 1;
    output = `로컬 실행 파일 없음: ${bin} (apps/miniapp 의존성 확인 필요)`;
  } else {
    try {
      output = execFileSync(process.execPath, [binPath, ...args], {
        cwd: MINIAPP,
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 16 * 1024 * 1024,
      }).toString();
    } catch (e) {
      code = e.status ?? 1;
      output = (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '');
    }
  }
  out(`\n===== ${label} =====`);
  out(output.trim() || '(출력 없음)');
  const pass = code === 0;
  if (!pass) failed++;
  summary.push(`${pass ? 'PASS' : 'FAIL'}  ${label}  (exit ${code})`);
}

out('\n===== 코드 게이트 요약 =====');
summary.forEach((s) => out(' ' + s));
out(failed ? `\n전체 결과: FAIL · 코드 게이트 (${failed}건)`: '\n전체 결과: PASS · 코드 게이트');
process.exit(failed ? 1 : 0);
