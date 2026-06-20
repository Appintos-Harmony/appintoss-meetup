// 링크 검증
// 산출물·프로젝트_운영·.claude 내 Markdown의 상대 내부 링크가 실제 존재하는지 검사한다.
// 사용: node tooling/scripts/링크_검증.mjs
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const scanDirs = ['산출물', '프로젝트_운영', '.claude'];
const out = (s = '') => process.stdout.write(s + '\n');

const mdFiles = [];
const walk = (dir) => {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir)) {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) walk(f);
    else if (e.endsWith('.md')) mdFiles.push(f);
  }
};
for (const d of scanDirs) walk(join(ROOT, d));

const linkRe = /\[[^\]]*\]\(([^)]+)\)/g;
const broken = [];
let checked = 0;
for (const f of mdFiles) {
  const text = readFileSync(f, 'utf8');
  let m;
  while ((m = linkRe.exec(text)) !== null) {
    let target = m[1].trim();
    if (/^(https?:|mailto:|#|tel:)/i.test(target)) continue; // 외부·앵커 제외
    target = target.split('#')[0].split('?')[0].trim();
    if (!target) continue;
    if (/^[a-z]+:\/\//i.test(target)) continue;
    checked++;
    const resolved = resolve(dirname(f), target);
    if (!existsSync(resolved)) broken.push([f, m[1]]);
  }
}

out('# 링크 검증 (내부 상대 링크)');
out(`Markdown ${mdFiles.length}개, 내부 링크 ${checked}개 검사`);
if (broken.length) {
  out(`\n깨진 링크 ${broken.length}건:`);
  for (const [f, link] of broken) out(` - ${f.replace(ROOT + '\\', '').replace(ROOT + '/', '')} → ${link}`);
  out('\n결과: FAIL');
  process.exit(1);
}
out('\n결과: PASS');
