// 루프엔진 단위테스트 (TASK-010)
// node:test 내장 러너 — 외부 의존성·API 없음. 실행: node --test tooling/scripts/__tests__
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseFrontmatter, extractFrontmatter, globToRegExp, globMatches,
  pathSafety, selectNext, isReady,
} from '../작업_인덱서.mjs';
import { classifyChanges } from '../코드게이트.mjs';
import { isForbidden, withinAllowed, touchesHumanApproval } from '../루프_가드.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

// --- 프런트매터 파서 ---
test('parseFrontmatter: --- 구분 블록 + CRLF + 인라인 배열', () => {
  const text = '---\r\nid: TASK-1\r\nstatus: Ready\r\nallowed_paths: [a/**, b/c.ts]\r\n---\r\n# 본문';
  const fm = parseFrontmatter(text);
  assert.equal(fm.id, 'TASK-1');
  assert.equal(fm.status, 'Ready');
  assert.deepEqual(fm.allowed_paths, ['a/**', 'b/c.ts']);
});

test('parseFrontmatter: 제목 뒤 ```yaml 펜스(구형 포맷)', () => {
  const text = '# 제목\n\n```yaml\nid: TASK-2\nstatus: Done\n```\n본문';
  const fm = parseFrontmatter(text);
  assert.equal(fm.id, 'TASK-2');
  assert.equal(fm.status, 'Done');
});

test('parseFrontmatter: 스칼라 인라인 주석 제거', () => {
  const fm = parseFrontmatter('---\nstatus: In Progress   # 구현 완료\n---\n');
  assert.equal(fm.status, 'In Progress');
});

test('parseFrontmatter: 멀티라인 리스트', () => {
  const fm = parseFrontmatter('---\nforbidden_paths:\n  - apps/api/**\n  - x.ts\n---\n');
  assert.deepEqual(fm.forbidden_paths, ['apps/api/**', 'x.ts']);
});

test('extractFrontmatter: 프런트매터 없으면 빈 문자열', () => {
  assert.equal(extractFrontmatter('# 그냥 제목\n본문만'), '');
});

// --- glob ---
test('globToRegExp: ** 는 구분자 포함, * 는 미포함', () => {
  assert.ok(globMatches('apps/**', 'apps/miniapp/src/x.ts'));
  assert.ok(globMatches('apps/miniapp/src/**', 'apps/miniapp/src/a/b.ts'));
  assert.ok(globMatches('산출물/06_테스트/**', '산출물/06_테스트/결과.md'));
  assert.ok(globMatches('*.ts', 'a.ts'));
  assert.ok(!globMatches('*.ts', 'sub/a.ts'));
  assert.ok(!globMatches('apps/api/**', 'apps/miniapp/x'));
});

// --- 경로안전(보호경로 충돌) ---
test('pathSafety: 보호경로 덮으면 위반', () => {
  assert.ok(!pathSafety({ allowed_paths: ['.claude/**'] }).safe);
  assert.ok(!pathSafety({ allowed_paths: ['프로젝트_운영/00_팀공유/**'] }).safe);
  assert.ok(!pathSafety({ allowed_paths: [] }).safe); // 빈 allowed = 불명확 = 위반
});

test('pathSafety: 안전 범위는 통과', () => {
  assert.ok(pathSafety({ allowed_paths: ['산출물/06_테스트/**', '평가증빙/**'] }).safe);
  assert.ok(pathSafety({ allowed_paths: ['apps/miniapp/src/**'] }).safe);
});

// --- 결정론 선택 ---
test('selectNext: Ready만·ID 오름차순·skip·경로안전', () => {
  const tasks = [
    { id: 'TASK-B', status: 'Ready', allowed_paths: ['apps/miniapp/**'] },
    { id: 'TASK-A', status: 'Ready', allowed_paths: ['.claude/**'] }, // 보호경로 → 차단
    { id: 'TASK-C', status: 'Done', allowed_paths: ['apps/**'] },     // Ready 아님
  ];
  assert.equal(selectNext(tasks).task.id, 'TASK-B'); // A는 차단되어 B
  assert.equal(selectNext(tasks, { skip: ['TASK-B'] }).task, null); // B skip → 후보 없음
});

test('isReady: 대소문자 무관', () => {
  assert.ok(isReady({ status: 'ready' }));
  assert.ok(!isReady({ status: 'In Progress' }));
});

// --- 코드게이트 분류 ---
test('classifyChanges: apps 경로 분류', () => {
  assert.deepEqual(classifyChanges(['apps/miniapp/src/x.ts']), { miniapp: true, api: false, otherApps: false, anyCode: true });
  assert.equal(classifyChanges(['apps/api/server.mjs']).api, true);
  assert.equal(classifyChanges(['산출물/a.md', 'README.md']).anyCode, false);
});

// --- 가드: 보호경로·허용범위 ---
test('isForbidden: 보호 경로 식별', () => {
  assert.ok(isForbidden('.claude/settings.json'));
  assert.ok(isForbidden('tooling/git-hooks/pre-commit'));
  assert.ok(isForbidden('프로젝트_운영/00_팀공유/00_진행사항.md'));
  assert.ok(isForbidden('CLAUDE.md'));
  assert.ok(!isForbidden('tooling/scripts/x.mjs'));
  assert.ok(!isForbidden('apps/miniapp/src/x.ts'));
});

test('withinAllowed: allowed_paths 포함 여부', () => {
  assert.ok(withinAllowed('apps/miniapp/src/x.ts', ['apps/miniapp/src/**']));
  assert.ok(!withinAllowed('apps/api/x.mjs', ['apps/miniapp/**']));
  assert.ok(withinAllowed('산출물/06_테스트/결과.md', ['산출물/06_테스트/**']));
});

test('touchesHumanApproval: 마커 포함 파일 감지(자기참조 아님)', () => {
  const dir = join(HERE, '_tmp');
  mkdirSync(dir, { recursive: true });
  const rel = 'tooling/scripts/__tests__/_tmp/fix.md';
  const marker = ['HUMAN', 'APPROVAL', 'START'].join('_');
  try {
    writeFileSync(join(dir, 'fix.md'), `앞\n${marker}\n사람만\n`);
    assert.ok(touchesHumanApproval(rel));
    writeFileSync(join(dir, 'fix.md'), '평범한 문서\n');
    assert.ok(!touchesHumanApproval(rel));
    // 가드 스크립트 자신은 마커 리터럴을 담지 않아 오탐 없어야 함
    assert.ok(!touchesHumanApproval('tooling/scripts/루프_가드.mjs'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
