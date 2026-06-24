// 검증 전체 러너
// 운영 문서·산출물·링크·작업지시서·비밀값 검사를 한 번에 실행한다(CI·git hook에서 사용).
// 사용: node tooling/scripts/검증_전체.mjs [--strict] [--code]
//   기본       = 하네스 기본 검증(팀문서 --allow-template, 산출물 보고용)
//   --strict   = 출시/제품용 엄격 검증(팀문서 엄격, 산출물 --strict 강제)
//   --code     = 코드 게이트 추가(apps/miniapp tsc --noEmit + vitest run). 미지정 시 문서 전용 빠른 경로 유지.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPTS = join(ROOT, 'tooling', 'scripts');
const strict = process.argv.includes('--strict');
const codeGate = process.argv.includes('--code');
const out = (s = '') => process.stdout.write(s + '\n');

// [라벨, 파일, 인자, hardFail]
const checks = strict
  ? [
      ['팀 공유 문서(엄격)', '팀공유문서_검증.mjs', [], true],
      ['산출물 존재(엄격)', '산출물_검증.mjs', ['--strict'], true],
      ['내부 링크', '링크_검증.mjs', [], true],
      ['작업지시서', '작업지시서_검증.mjs', [], true],
      ['비밀값', '비밀값_스캔.mjs', [], true],
    ]
  : [
      ['팀 공유 문서', '팀공유문서_검증.mjs', ['--allow-template'], true],
      ['산출물 존재(보고)', '산출물_검증.mjs', [], false],
      ['내부 링크', '링크_검증.mjs', [], true],
      ['작업지시서', '작업지시서_검증.mjs', [], true],
      ['비밀값', '비밀값_스캔.mjs', [], true],
    ];

// --code: 코드 게이트(tsc·vitest)를 마지막 단계로 추가한다(hardFail).
if (codeGate) checks.push(['코드 게이트(tsc·vitest)', '코드검증.mjs', [], true]);

const mode = strict ? '엄격(strict) 검증' : '하네스 기본 검증';
out(`# 검증 전체 — ${mode}${codeGate ? ' + 코드 게이트' : ''}`);

let failed = 0;
const summary = [];
for (const [label, file, args, hard] of checks) {
  let exitCode = 0;
  let output = '';
  try {
    output = execFileSync(process.execPath, [join(SCRIPTS, file), ...args], { cwd: ROOT }).toString();
  } catch (e) {
    exitCode = e.status ?? 1;
    output = (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '');
  }
  out(`\n===== ${label} (${file}) =====`);
  out(output.trim());
  const pass = exitCode === 0;
  if (!pass && hard) failed++;
  summary.push(`${pass ? 'PASS' : hard ? 'FAIL' : 'WARN'}  ${label}`);
}

out('\n===== 요약 =====');
summary.forEach((s) => out(' ' + s));
out(failed ? `\n전체 결과: FAIL — ${mode} (${failed}건)` : `\n전체 결과: PASS — ${mode}`);
process.exit(failed ? 1 : 0);
