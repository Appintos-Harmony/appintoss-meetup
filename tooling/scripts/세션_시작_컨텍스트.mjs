// 세션 시작 컨텍스트
// 새 세션(사람 또는 AI)이 프로젝트 현재 상태와 먼저 읽을 문서를 빠르게 파악하도록 핵심 위치와 상태를 출력한다.
// 사용: node tooling/scripts/세션_시작_컨텍스트.mjs
import { existsSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = (s = '') => process.stdout.write(s + '\n');
const mark = (p) => (existsSync(join(ROOT, p)) ? '[O] ' : '[X] ') + p;
const git = (cmd) => execSync('git ' + cmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();

out('# 세션 시작 컨텍스트');
out('생성: ' + new Date().toISOString());
out('저장소 루트: ' + ROOT);

out('\n## Git');
let inRepo = false;
try { git('rev-parse --is-inside-work-tree'); inRepo = true; } catch { /* not a repo */ }
if (!inRepo) {
  out('git 저장소 아님 (아직 git init 안 됨)');
} else {
  let branch = '(unknown)';
  try { branch = git('symbolic-ref --short HEAD'); } catch { /* detached */ }
  let committed = true;
  try { git('rev-parse --verify HEAD'); } catch { committed = false; }
  out('브랜치: ' + branch + (committed ? '' : ' (아직 커밋 없음)'));
  let status = '';
  try { status = git('status --short'); } catch { /* ignore */ }
  out('변경/미추적: ' + (status ? '\n' + status : '없음'));
}

out('\n## 먼저 읽을 팀 공유 문서');
for (const p of [
  '프로젝트_운영/00_팀공유/00_진행사항.md',
  '프로젝트_운영/00_팀공유/01_인수인계.md',
  '프로젝트_운영/00_팀공유/02_팀원_업무배분.md',
  '프로젝트_운영/00_팀공유/03_AI_문서업데이트_규칙.md',
  '프로젝트_운영/00_현재상태/프로젝트_현황판.md',
  '프로젝트_운영/00_현재상태/최신_인수인계.md',
]) out(mark(p));

out('\n## 거버넌스/운영 파일');
for (const p of ['CLAUDE.md', 'AGENTS.md', 'CHATGPT_PRO_운영지침.md']) out(mark(p));

out('\n## 산출물');
const countMd = (dir) => {
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const e of readdirSync(dir)) {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) n += countMd(f);
    else if (e.endsWith('.md')) n++;
  }
  return n;
};
out('산출물/ Markdown 파일 수: ' + countMd(join(ROOT, '산출물')));

out('\n다음: 00_진행사항 → 01_인수인계 → 02_팀원_업무배분 → 현재 TASK 작업패킷 순으로 읽으세요.');
