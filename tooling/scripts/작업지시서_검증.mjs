// 작업지시서 검증
// 각 TASK 작업지시서에서 구현자=검토자 동일 여부와 완료(Done) 작업의 증거 링크를 검사한다.
// 사용: node tooling/scripts/작업지시서_검증.mjs
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dir = join(ROOT, '산출물/09_AI개발파이프라인/작업지시서');
const out = (s = '') => process.stdout.write(s + '\n');

const field = (text, key) => {
  const m = text.match(new RegExp('^' + key + '\\s*:\\s*(.+)$', 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
};

const errors = [];
let checked = 0;
const files = existsSync(dir)
  ? readdirSync(dir).filter((f) => f.endsWith('.md') && !f.includes('템플릿'))
  : [];

for (const f of files) {
  checked++;
  const text = readFileSync(join(dir, f), 'utf8');
  const primary = field(text, 'primary_agent');
  const review = field(text, 'review_agent');
  const status = field(text, 'status');
  if (primary && review && primary === review) {
    errors.push(`${f}: primary_agent와 review_agent가 동일(${primary}) — 독립 검토 위반`);
  }
  if (/^done$/i.test(status)) {
    const hasEvidence = /REVIEW-\d|독립검토서|\]\([^)]+\)/.test(text);
    if (!hasEvidence) errors.push(`${f}: status=Done 인데 증거 링크(REVIEW/독립검토서)가 없음`);
  }
}

out('# 작업지시서 검증');
out(`검사 ${checked}개 (템플릿 제외)`);
if (errors.length) {
  out(`\n위반 ${errors.length}건:`);
  errors.forEach((e) => out(' - ' + e));
  out('\n결과: FAIL');
  process.exit(1);
}
out('\n결과: PASS');
