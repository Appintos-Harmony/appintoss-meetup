// 작업 인덱서 (TASK-010 루프엔지니어링)
// TASK 작업지시서의 프런트매터를 파싱해 Ready 큐를 만들고, 경로 안전성을 분석해
// 루프가 자율로 집을 수 있는 "다음 작업" 1건을 결정론적으로 고른다.
// 순수 Node(외부 의존성·API 없음). 함수는 node:test에서 단위검증한다.
//
// 경로 비교는 전부 canonicalize()(역슬래시·대소문자·'..'·절대경로 정규화)를 거쳐
// 인덱스 게이트(여기)와 런타임 게이트(루프_가드.mjs)의 의미가 갈라지지 않게 한다.
//
// 사용:
//   node tooling/scripts/작업_인덱서.mjs            # Ready 큐 사람용 요약
//   node tooling/scripts/작업_인덱서.mjs --json      # 전체 작업 기계 JSON
//   node tooling/scripts/작업_인덱서.mjs --next      # 자율 가능한 다음 1건(JSON). 없으면 종료코드 3
//   node tooling/scripts/작업_인덱서.mjs --next --skip TASK-...,TASK-...   # 건너뛸 ID
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, join } from 'node:path';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TASK_DIR = join(ROOT, '산출물/09_AI개발파이프라인/작업지시서');

// 루프가 절대 건드리면 안 되는 보호 경로. 디렉터리는 하위 전체를 보호한다(자기보호 포함).
export const PROTECTED_PATHS = [
  '프로젝트_운영/00_팀공유/00_진행사항.md',
  '프로젝트_운영/00_팀공유/01_인수인계.md',
  '.claude',          // settings·rules·commands·agents·skills 전체
  '.git',
  '.github',
  'tooling',          // git-hooks·scripts(게이트 자기수정 금지) 전체
  '.gitignore',
  '.gitattributes',
  'CLAUDE.md',
  'AGENTS.md',
  'CHATGPT_PRO_운영지침.md',
];

// 게이팅 키: 중복되면 의미가 모호하므로 해당 작업을 무효(fail-closed)로 본다.
const GATING_KEYS = new Set(['id', 'status', 'allowed_paths', 'forbidden_paths']);

// 경로 정규화: 유니코드 NFC, 역슬래시→슬래시, '.'·'..' 해소, 절대경로/드라이브/앞슬래시 제거,
// 세그먼트 후행 점·공백 제거(Win32가 'tooling.'→'tooling'으로 실제 자원을 엶), 소문자.
// 대소문자 무시 FS·NFD/NFC·traversal·후행점 우회를 한 형태로 모은다(REVIEW요청_Codex BYPASS #1·#2).
export function canonicalize(p) {
  let s = String(p).normalize('NFC').replace(/\\/g, '/').trim();
  s = s.replace(/^[a-zA-Z]:\//, '').replace(/^\/+/, '');
  const parts = [];
  for (let seg of s.split('/')) {
    if (seg === '..') { parts.pop(); continue; }
    if (seg === '.' || seg === '') continue;
    seg = seg.replace(/[.\s]+$/, ''); // 후행 점·공백 제거(traversal 판정 뒤)
    if (seg === '') continue;
    parts.push(seg);
  }
  return parts.join('/').toLowerCase();
}

// glob의 리터럴 접두(첫 '*' 이전 디렉터리)를 반환.
function globPrefix(cglob) {
  const i = cglob.indexOf('*');
  return (i < 0 ? cglob : cglob.slice(0, i)).replace(/\/+$/, '');
}

// glob(`a/**`, `a/*.ts`)을 앵커 정규식으로. `**`=경로구분 포함, `*`=구분 제외.
export function globToRegExp(glob) {
  const g = canonicalize(glob);
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') { re += '.*'; i++; if (g[i + 1] === '/') i++; }
      else re += '[^/]*';
    } else if ('\\^$.|?+()[]{}'.includes(c)) re += '\\' + c;
    else re += c;
  }
  return new RegExp('^' + re + '$');
}

export function globMatches(glob, path) {
  return globToRegExp(glob).test(canonicalize(path));
}

// path가 보호 경로(파일 또는 디렉터리 하위)에 속하는가. canonicalize 일원화.
export function isUnderProtected(path) {
  const p = canonicalize(path);
  return PROTECTED_PATHS.some((prot) => {
    const c = canonicalize(prot);
    return p === c || p.startsWith(c + '/');
  });
}

// 작업의 allowed_paths가 보호 경로를 덮거나 위험하게 넓으면 위반 사유를 반환.
export function pathSafety(task) {
  if (task && task.invalid) return { safe: false, violations: ['작업지시서 파싱 무효(게이팅 키 중복 등)'] };
  const allowed = (task && task.allowed_paths) || [];
  const violations = [];
  if (allowed.length === 0) violations.push('allowed_paths가 비어 있음 — 자율 실행 범위 불명확');
  for (const g of allowed) {
    const cg = canonicalize(g);
    if (cg === '' || cg === '*' || cg === '**') { violations.push(`allowed_paths '${g}'가 과도하게 넓음`); continue; }
    if (/[?{}\[\]]/.test(g)) { violations.push(`allowed_paths '${g}'에 미지원 글롭 메타문자`); continue; }
    const gp = globPrefix(cg);
    for (const prot of PROTECTED_PATHS) {
      const cp = canonicalize(prot);
      if (gp === cp || gp.startsWith(cp + '/') || cp.startsWith(gp + '/') || globMatches(g, prot)) {
        violations.push(`allowed_paths '${g}'가 보호 경로 '${prot}'와 충돌`);
      }
    }
  }
  return { safe: violations.length === 0, violations };
}

// --- 프런트매터 파서 ---
// (1) 선행 `---...---` 또는 (2) 제목 뒤 첫 ```yaml 펜스. CRLF→LF. 게이팅 키 중복=무효.
export function extractFrontmatter(text) {
  const t = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const dashed = t.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (dashed) return dashed[1];
  const fenced = t.match(/```ya?ml\n([\s\S]*?)\n```/);
  if (fenced) return fenced[1];
  return '';
}

export function parseFrontmatter(text) {
  const fm = extractFrontmatter(text);
  const obj = {};
  const dup = [];
  const lines = fm.split('\n');
  const setKey = (key, val) => {
    if (key in obj && GATING_KEYS.has(key)) dup.push(key);
    obj[key] = val;
  };
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let raw = m[2].trim();
    if (raw === '') {
      const items = [];
      let j = i + 1;
      while (j < lines.length && /^\s*-\s+/.test(lines[j])) {
        items.push(lines[j].replace(/^\s*-\s+/, '').trim().replace(/^["']|["']$/g, ''));
        j++;
      }
      if (items.length) { setKey(key, items); i = j - 1; continue; }
      setKey(key, '');
      continue;
    }
    if (raw.startsWith('[')) {
      const end = raw.indexOf(']');
      const inner = (end >= 0 ? raw.slice(1, end) : raw.slice(1)).trim();
      setKey(key, inner === '' ? [] : inner.split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean));
      continue;
    }
    raw = raw.replace(/\s+#.*$/, '').trim();
    setKey(key, raw.replace(/^["']|["']$/g, ''));
  }
  if (dup.length) obj.__dupGatingKeys = [...new Set(dup)];
  return obj;
}

export function parseTaskFile(file) {
  const text = readFileSync(file, 'utf8');
  const fm = parseFrontmatter(text);
  return {
    file: file.replace(ROOT + '\\', '').replace(ROOT + '/', '').replace(/\\/g, '/'),
    id: fm.id || '',
    status: (fm.status || '').trim(),
    primary_agent: fm.primary_agent || '',
    review_agent: fm.review_agent || '',
    allowed_paths: fm.allowed_paths || [],
    forbidden_paths: fm.forbidden_paths || [],
    invalid: !!fm.__dupGatingKeys,
  };
}

export function loadTasks(dir = TASK_DIR) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.includes('템플릿'))
    .map((f) => parseTaskFile(join(dir, f)))
    .filter((t) => t.id);
}

export function isReady(task) {
  return !task.invalid && /^ready$/i.test(task.status);
}

// 결정론 선택: Ready·유효만, ID 오름차순(단조), skip 제외, 경로안전 통과한 첫 작업.
export function selectNext(tasks, { skip = [] } = {}) {
  const skipSet = new Set(skip);
  const candidates = tasks
    .filter(isReady)
    .filter((t) => !skipSet.has(t.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const t of candidates) {
    const safety = pathSafety(t);
    if (safety.safe) return { task: t, safety };
  }
  return { task: null, blocked: candidates.map((t) => ({ id: t.id, ...pathSafety(t) })).filter((c) => !c.safe) };
}

// --- CLI ---
function main() {
  const argv = process.argv.slice(2);
  const json = argv.includes('--json');
  const next = argv.includes('--next');
  const skipArg = argv[argv.indexOf('--skip') + 1];
  const skip = argv.includes('--skip') && skipArg ? skipArg.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const out = (s = '') => process.stdout.write(s + '\n');

  const tasks = loadTasks();

  if (next) {
    const { task, safety, blocked } = selectNext(tasks, { skip });
    if (!task) {
      out(JSON.stringify({ next: null, reason: 'Ready·경로안전 후보 없음', blocked: blocked || [] }, null, 2));
      process.exit(3);
    }
    out(JSON.stringify({ next: task, safety }, null, 2));
    return;
  }

  if (json) { out(JSON.stringify({ count: tasks.length, tasks }, null, 2)); return; }

  out('# 작업 인덱서 — Ready 큐');
  const ready = tasks.filter(isReady).sort((a, b) => a.id.localeCompare(b.id));
  out(`전체 ${tasks.length}건 · Ready ${ready.length}건\n`);
  for (const t of ready) {
    const s = pathSafety(t);
    out(`- ${t.id} [${s.safe ? '자율가능' : '차단'}] allowed=${JSON.stringify(t.allowed_paths)}`);
    if (!s.safe) s.violations.forEach((v) => out(`    · ${v}`));
  }
  const { task } = selectNext(tasks, { skip });
  out(`\n다음 자율 작업: ${task ? task.id : '없음'}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
