// 비밀값 스캔
// 저장소(또는 staged 파일)에서 흔한 비밀값 패턴을 찾는다.
// 사용: node tooling/scripts/비밀값_스캔.mjs [--staged]
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, extname } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const staged = process.argv.includes('--staged');
const out = (s = '') => process.stdout.write(s + '\n');

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.vite', 'coverage']);
const TEXT_EXT = new Set(['.md', '.mjs', '.js', '.ts', '.tsx', '.jsx', '.json', '.yml', '.yaml', '.txt', '.env', '.sh', '.cjs', '']);

const patterns = [
  ['AWS Access Key', /AKIA[0-9A-Z]{16}/],
  ['Private Key 헤더', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['Slack 토큰', /xox[baprs]-[0-9A-Za-z-]{10,}/],
  ['Google API Key', /AIza[0-9A-Za-z_-]{30,}/],
  ['일반 비밀 할당', /(?:api[_-]?key|secret|token|password|passwd|pwd)\s*[:=]\s*['"][^'"\s]{16,}['"]/i],
];

const listFiles = () => {
  if (staged) {
    try {
      const o = execSync('git diff --cached --name-only --diff-filter=ACM', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
      return o.split('\n').map((s) => s.trim()).filter(Boolean).map((p) => join(ROOT, p)).filter(existsSync);
    } catch { return []; }
  }
  const acc = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir)) {
      if (SKIP_DIRS.has(e)) continue;
      const f = join(dir, e);
      const st = statSync(f);
      if (st.isDirectory()) walk(f);
      else if (TEXT_EXT.has(extname(e).toLowerCase()) && st.size < 1_000_000) acc.push(f);
    }
  };
  walk(ROOT);
  return acc;
};

const findings = [];
for (const f of listFiles()) {
  let text;
  try { text = readFileSync(f, 'utf8'); } catch { continue; }
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    for (const [name, re] of patterns) {
      if (re.test(line)) findings.push([f.replace(ROOT + '\\', '').replace(ROOT + '/', ''), i + 1, name]);
    }
  });
}

out('# 비밀값 스캔' + (staged ? ' (--staged)' : ''));
if (findings.length) {
  out(`\n발견 ${findings.length}건 (커밋 금지):`);
  for (const [f, ln, name] of findings) out(` - ${f}:${ln} [${name}]`);
  out('\n결과: FAIL');
  process.exit(1);
}
out('비밀값 패턴 없음\n결과: PASS');
