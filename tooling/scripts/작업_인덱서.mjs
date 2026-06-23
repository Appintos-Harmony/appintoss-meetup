// 작업 인덱서 (TASK-010 루프엔지니어링)
// TASK 작업지시서의 프런트매터를 파싱해 Ready 큐를 만들고, 경로 안전성을 분석해
// 루프가 자율로 집을 수 있는 "다음 작업" 1건을 결정론적으로 고른다.
// 순수 Node(외부 의존성·API 없음). 함수는 node:test에서 단위검증한다.
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

// 루프가 절대 건드리면 안 되는 보호 경로(작업의 allowed_paths가 이들을 덮으면 자율 부적격).
// 사람 승인 구역·하네스 자기보호·게이트 자체. 루프_가드.mjs와 단일 기준을 공유한다.
export const PROTECTED_PATHS = [
  '프로젝트_운영/00_팀공유/00_진행사항.md',
  '프로젝트_운영/00_팀공유/01_인수인계.md',
  '.claude/settings.json',
  '.claude/rules',
  'tooling/git-hooks',
  'CLAUDE.md',
  'AGENTS.md',
  'CHATGPT_PRO_운영지침.md',
];

// --- 프런트매터 파서 ---
// 두 포맷 모두 지원: (1) 선행 `---...---` 구분 블록(신형 TASK),
// (2) 제목 뒤 첫 ```yaml 펜스 블록(구형 TASK·템플릿). CRLF는 LF로 정규화한다.
export function extractFrontmatter(text) {
  const t = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const dashed = t.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (dashed) return dashed[1];
  const fenced = t.match(/```ya?ml\n([\s\S]*?)\n```/);
  if (fenced) return fenced[1];
  return '';
}

// 인라인 배열 `[a, b]`·멀티라인 `- item` 리스트·스칼라를 파싱한다.
export function parseFrontmatter(text) {
  const fm = extractFrontmatter(text);
  const obj = {};
  const lines = fm.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let raw = m[2].trim();
    if (raw === '' ) {
      // 멀티라인 리스트 수집(다음 줄들이 `- `로 시작).
      const items = [];
      let j = i + 1;
      while (j < lines.length && /^\s*-\s+/.test(lines[j])) {
        items.push(lines[j].replace(/^\s*-\s+/, '').trim().replace(/^["']|["']$/g, ''));
        j++;
      }
      if (items.length) { obj[key] = items; i = j - 1; continue; }
      obj[key] = '';
      continue;
    }
    if (raw.startsWith('[')) {
      // 닫는 ']' 뒤 인라인 주석(`] # …`)은 버린다.
      const end = raw.indexOf(']');
      const inner = (end >= 0 ? raw.slice(1, end) : raw.slice(1)).trim();
      obj[key] = inner === '' ? [] : inner.split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      continue;
    }
    // 스칼라의 YAML 인라인 주석(` # …`) 제거.
    raw = raw.replace(/\s+#.*$/, '').trim();
    obj[key] = raw.replace(/^["']|["']$/g, '');
  }
  return obj;
}

// glob(`a/**`, `a/*.ts`)을 앵커 정규식으로. `**`=경로구분 포함, `*`=구분 제외.
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') { re += '.*'; i++; if (glob[i + 1] === '/') i++; }
      else re += '[^/]*';
    } else if ('\\^$.|?+()[]{}'.includes(c)) re += '\\' + c;
    else re += c;
  }
  return new RegExp('^' + re + '$');
}

export function globMatches(glob, path) {
  return globToRegExp(glob).test(path);
}

// 작업의 allowed_paths가 보호 경로를 하나라도 덮으면 위반 사유를 반환.
export function pathSafety(task) {
  const allowed = task.allowed_paths || [];
  const violations = [];
  if (allowed.length === 0) {
    violations.push('allowed_paths가 비어 있음 — 자율 실행 범위 불명확');
  }
  for (const g of allowed) {
    for (const p of PROTECTED_PATHS) {
      // allowed glob이 보호 경로를 덮거나, 보호 경로가 allowed 접두를 덮는 경우 모두 차단.
      if (globMatches(g, p) || p.startsWith(g.replace(/\/\*+$/, '/')) || g.startsWith(p)) {
        violations.push(`allowed_paths '${g}'가 보호 경로 '${p}'와 충돌`);
      }
    }
  }
  return { safe: violations.length === 0, violations };
}

export function parseTaskFile(file) {
  const text = readFileSync(file, 'utf8');
  const fm = parseFrontmatter(text);
  const id = fm.id || '';
  return {
    file: file.replace(ROOT + '\\', '').replace(ROOT + '/', '').replace(/\\/g, '/'),
    id,
    status: (fm.status || '').trim(),
    primary_agent: fm.primary_agent || '',
    review_agent: fm.review_agent || '',
    allowed_paths: fm.allowed_paths || [],
    forbidden_paths: fm.forbidden_paths || [],
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
  return /^ready$/i.test(task.status);
}

// 결정론 선택: Ready만, ID 오름차순(단조), skip 제외, 경로안전 통과한 첫 작업.
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

  if (json) {
    out(JSON.stringify({ count: tasks.length, tasks }, null, 2));
    return;
  }

  // 사람용 요약
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
