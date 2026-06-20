// 팀 공유 문서 검증
// 필수 운영 문서 존재, HUMAN_APPROVAL 보호구역 무결성, 템플릿 미치환 항목을 점검한다.
// 사용: node tooling/scripts/팀공유문서_검증.mjs [--allow-template]
// --allow-template: 초기 설정 단계에서 템플릿 잔여 표시를 오류가 아닌 경고로 처리한다.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const allowTemplate = process.argv.includes('--allow-template');

const required = [
  '프로젝트_운영/00_팀공유/00_진행사항.md',
  '프로젝트_운영/00_팀공유/01_인수인계.md',
  '프로젝트_운영/00_팀공유/02_팀원_업무배분.md',
  '프로젝트_운영/00_팀공유/03_AI_문서업데이트_규칙.md',
  '프로젝트_운영/00_현재상태/프로젝트_현황판.md',
  '프로젝트_운영/00_현재상태/최신_인수인계.md',
];
const approvalGuarded = [
  '프로젝트_운영/00_팀공유/00_진행사항.md',
  '프로젝트_운영/00_팀공유/01_인수인계.md',
];
const templateMarkers = ['팀원 A', '팀원 B', '팀원 C', '팀원 D', 'YYYY-MM-DD', '미기입'];

const errors = [];
const warnings = [];

for (const p of required) {
  if (!existsSync(join(ROOT, p))) errors.push('필수 문서 없음: ' + p);
}
for (const p of approvalGuarded) {
  const f = join(ROOT, p);
  if (!existsSync(f)) continue;
  const t = readFileSync(f, 'utf8');
  const starts = (t.match(/HUMAN_APPROVAL_START/g) || []).length;
  const ends = (t.match(/HUMAN_APPROVAL_END/g) || []).length;
  if (starts < 1 || starts !== ends) errors.push('HUMAN_APPROVAL 보호구역 누락/불일치: ' + p);
}
for (const p of required) {
  const f = join(ROOT, p);
  if (!existsSync(f)) continue;
  const t = readFileSync(f, 'utf8');
  for (const m of templateMarkers) {
    if (t.includes(m)) (allowTemplate ? warnings : errors).push('템플릿 미치환(' + m + '): ' + p);
  }
}

const out = (s = '') => process.stdout.write(s + '\n');
out('# 팀 공유 문서 검증' + (allowTemplate ? ' (--allow-template)' : ''));
out('검사 대상: ' + required.length + '개 문서');
if (warnings.length) { out('\n경고 ' + warnings.length + '건:'); warnings.forEach((w) => out(' - ' + w)); }
if (errors.length) {
  out('\n오류 ' + errors.length + '건:');
  errors.forEach((e) => out(' - ' + e));
  out('\n결과: FAIL');
  process.exit(1);
}
out('\n결과: PASS' + (warnings.length ? ' (경고 ' + warnings.length + '건, 초기 설정 허용)' : ''));
