// 코드 게이트 (TASK-010 루프엔지니어링)
// 변경에 코드 경로(apps/**)가 포함되면 타입체크(tsc --noEmit)와 단위테스트(vitest run)를
// 통과해야만 green으로 본다. 검증_전체.mjs(문서·링크·비밀값)는 코드 품질을 포함하지 않으므로
// 루프의 COMMIT 직전 AND 게이트로 이 스크립트를 함께 건다.
//
// 설계 원칙(루프 무인 실행 안전):
//  - shell·pnpm·npx·cd 미사용. 로컬 .bin의 JS 엔트리를 node로 직접 실행(execFileSync + cwd 옵션).
//  - 종료코드: 0=PASS 또는 코드경로 없음(생략) · 1=게이트 실행 후 FAIL · 2=게이트 없는 코드경로(HARD STOP).
//  - `node tooling/scripts/*` 허용목록으로 커버되어 무인 실행 시 권한 프롬프트가 없다.
//
// 사용:
//   node tooling/scripts/코드게이트.mjs --changed apps/miniapp/src/x.ts 산출물/a.md
//   node tooling/scripts/코드게이트.mjs --all      # 변경과 무관하게 강제 실행
//   node tooling/scripts/코드게이트.mjs --staged   # git diff --cached 변경에서 자동 추출
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, join } from 'node:path';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MINIAPP = join(ROOT, 'apps', 'miniapp');
const TSC = join(MINIAPP, 'node_modules', 'typescript', 'bin', 'tsc');
const VITEST = join(MINIAPP, 'node_modules', 'vitest', 'vitest.mjs');

export function classifyChanges(changed) {
  const miniapp = changed.some((p) => p.replace(/\\/g, '/').startsWith('apps/miniapp/'));
  const api = changed.some((p) => p.replace(/\\/g, '/').startsWith('apps/api/'));
  const otherApps = changed.some((p) => {
    const n = p.replace(/\\/g, '/');
    return n.startsWith('apps/') && !n.startsWith('apps/miniapp/') && !n.startsWith('apps/api/');
  });
  return { miniapp, api, otherApps, anyCode: miniapp || api || otherApps };
}

function stagedPaths() {
  try {
    const o = execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: ROOT, encoding: 'utf8' });
    return o.split('\n').map((s) => s.trim()).filter(Boolean);
  } catch { return []; }
}

function runTool(label, entry, args) {
  if (!existsSync(entry)) {
    return { label, ok: false, missing: true, tail: `엔트리 없음: ${entry} (apps/miniapp 의존성 설치 필요: npm install)` };
  }
  try {
    const out = execFileSync(process.execPath, [entry, ...args], {
      cwd: MINIAPP, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
    });
    return { label, ok: true, tail: tail(out) };
  } catch (e) {
    const merged = (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '');
    return { label, ok: false, tail: tail(merged) || `(종료코드 ${e.status ?? '?'})` };
  }
}

const tail = (s, n = 25) => s.split('\n').filter(Boolean).slice(-n).join('\n');

function main() {
  const argv = process.argv.slice(2);
  const out = (s = '') => process.stdout.write(s + '\n');
  const all = argv.includes('--all');
  let changed = [];
  if (argv.includes('--staged')) changed = stagedPaths();
  if (argv.includes('--changed')) {
    const i = argv.indexOf('--changed');
    for (let k = i + 1; k < argv.length && !argv[k].startsWith('--'); k++) {
      changed.push(...argv[k].split(',').map((s) => s.trim()).filter(Boolean));
    }
  }

  out('# 코드 게이트 (tsc --noEmit + vitest run)');
  const cls = classifyChanges(changed);

  if (!all && !cls.anyCode) {
    out(`대상 변경: ${changed.length}건 — 코드 경로(apps/**) 없음 → 게이트 생략(PASS).`);
    process.exit(0);
  }

  if (cls.api || cls.otherApps) {
    out('HARD STOP: 자동 게이트가 없는 코드 경로 변경(apps/api/** 등). 사람 검증이 필요합니다.');
    out(`  변경: ${changed.filter((p) => /^apps\//.test(p.replace(/\\/g, '/')) && !/^apps\/miniapp\//.test(p.replace(/\\/g, '/'))).join(', ')}`);
    process.exit(2);
  }

  out(`대상: apps/miniapp 코드 변경 감지${all ? '(--all 강제)' : ''} → tsc + vitest 실행\n`);
  const results = [];
  results.push(runTool('typecheck (tsc --noEmit)', TSC, ['--noEmit']));
  results.push(runTool('unit (vitest run)', VITEST, ['run']));

  for (const r of results) {
    out(`\n===== ${r.label}: ${r.ok ? 'PASS' : 'FAIL'} =====`);
    out(r.tail);
  }
  const failed = results.filter((r) => !r.ok);
  out('\n===== 요약 =====');
  results.forEach((r) => out(` ${r.ok ? 'PASS' : 'FAIL'}  ${r.label}`));
  if (failed.length) {
    out(`\n전체: FAIL — 코드 게이트 (${failed.length}건). 커밋 금지.`);
    process.exit(1);
  }
  out('\n전체: PASS — 코드 게이트.');
  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
