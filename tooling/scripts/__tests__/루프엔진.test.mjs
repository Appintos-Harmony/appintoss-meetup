// 루프엔진 단위테스트 (TASK-010): 독립검토(REVIEW-035) 반영 회귀 포함
// node:test 내장 러너: 외부 의존성·API 없음. 실행: node tooling/scripts/루프엔진_검증.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseFrontmatter, extractFrontmatter, globMatches, canonicalize, isUnderProtected,
  pathSafety, selectNext, isReady,
} from '../작업_인덱서.mjs';
import { isForbidden, withinAllowed, isUngatedCode, touchesHumanApproval } from '../루프_가드.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

// --- 프런트매터 파서 ---
test('parseFrontmatter: --- 블록 + CRLF + 인라인 배열', () => {
  const fm = parseFrontmatter('---\r\nid: TASK-1\r\nstatus: Ready\r\nallowed_paths: [a/**, b/c.ts]\r\n---\r\n# 본문');
  assert.equal(fm.id, 'TASK-1');
  assert.equal(fm.status, 'Ready');
  assert.deepEqual(fm.allowed_paths, ['a/**', 'b/c.ts']);
});

test('parseFrontmatter: 제목 뒤 ```yaml 펜스(구형 포맷)', () => {
  const fm = parseFrontmatter('# 제목\n\n```yaml\nid: TASK-2\nstatus: Done\n```\n본문');
  assert.equal(fm.id, 'TASK-2');
  assert.equal(fm.status, 'Done');
});

test('parseFrontmatter: 스칼라 인라인 주석 제거', () => {
  assert.equal(parseFrontmatter('---\nstatus: In Progress   # 구현 완료\n---\n').status, 'In Progress');
});

test('parseFrontmatter: 멀티라인 리스트', () => {
  assert.deepEqual(parseFrontmatter('---\nforbidden_paths:\n  - apps/api/**\n  - x.ts\n---\n').forbidden_paths, ['apps/api/**', 'x.ts']);
});

test('parseFrontmatter: 게이팅 키 중복 = 무효(fail-closed)', () => {
  const fm = parseFrontmatter('---\nstatus: Done\nstatus: Ready\n---\n');
  assert.ok(fm.__dupGatingKeys.includes('status'));
});

test('extractFrontmatter: 없으면 빈 문자열', () => {
  assert.equal(extractFrontmatter('# 그냥 제목\n본문만'), '');
});

// --- canonicalize (B4·traversal 근본수정) ---
test('canonicalize: 대소문자·역슬래시·.. 정규화', () => {
  assert.equal(canonicalize('.CLAUDE\\Settings.json'), '.claude/settings.json');
  assert.equal(canonicalize('산출물/../.claude/settings.json'), '.claude/settings.json');
  assert.equal(canonicalize('/abs/leading'), 'abs/leading');
  assert.equal(canonicalize('C:/x/Y'), 'x/y');
});

test('canonicalize: NFD→NFC·후행점·공백 (Codex BYPASS #1·#2)', () => {
  const prot = '프로젝트_운영/00_팀공유/00_진행사항.md';
  assert.equal(canonicalize(prot.normalize('NFD')), canonicalize(prot)); // NFD==NFC
  assert.equal(canonicalize('tooling./scripts/x'), 'tooling/scripts/x'); // 후행 점
  assert.equal(canonicalize('CLAUDE.md.'), 'claude.md');
  assert.equal(canonicalize('a/b /c'), 'a/b/c');                          // 후행 공백
  assert.equal(canonicalize('a/../b'), 'b');                              // traversal 유지
});

test('보호경로 우회 차단: NFD·후행점 (Codex BYPASS #1·#2)', () => {
  const prot = '프로젝트_운영/00_팀공유/00_진행사항.md';
  assert.ok(isUnderProtected(prot.normalize('NFD')));                          // #1
  assert.ok(!pathSafety({ allowed_paths: [prot.normalize('NFD')] }).safe);
  assert.ok(isUnderProtected('tooling./scripts/x.mjs'));                       // #2
  assert.ok(isUnderProtected('CLAUDE.md.'));
  assert.ok(!pathSafety({ allowed_paths: ['tooling./scripts/커밋.mjs'] }).safe);
});

// --- Codex(REVIEW-036) 발견 회귀 ---
test('pathSafety: 절대경로·traversal·drive 거부 (Codex A5·B8)', () => {
  assert.ok(!pathSafety({ allowed_paths: ['../etc'] }).safe);
  assert.ok(!pathSafety({ allowed_paths: ['/etc/passwd'] }).safe);
  assert.ok(!pathSafety({ allowed_paths: ['C:/repo/x'] }).safe);
  assert.ok(!pathSafety({ allowed_paths: ['산출물/../../.claude/x'] }).safe);
});

test('canonicalize: ADS 콜론 별칭 제거 (Codex X9)', () => {
  assert.equal(canonicalize('CLAUDE.md:codexprobe'), 'claude.md');
  assert.ok(isUnderProtected('CLAUDE.md:ads'));
});

test('보호 파일 정확매치: 자신만 차단, 같은폴더/상위 글롭 허용 (Codex X7 완화)', () => {
  // CLAUDE.md(파일보호)는 자신은 차단하되 루트의 다른 파일은 허용: dir/file 분리 이득.
  assert.ok(isUnderProtected('CLAUDE.md'));
  assert.ok(!pathSafety({ allowed_paths: ['CLAUDE.md'] }).safe);
  assert.ok(pathSafety({ allowed_paths: ['README.md'] }).safe);
  // _상태.json은 pathSafety로 막지 않음(넓은 글롭 보존): gitignore+캡클램프로 보호.
  assert.ok(pathSafety({ allowed_paths: ['평가증빙/**'] }).safe);
  assert.ok(pathSafety({ allowed_paths: ['평가증빙/루프실행_로그/*.md'] }).safe);
});

test('withinAllowed: 보호경로는 allowed여도 false (Codex D1)', () => {
  assert.ok(!withinAllowed('tooling/scripts/루프_가드.mjs', ['tooling/**']));
  assert.ok(!withinAllowed('.claude/settings.json', ['.claude/**']));
  assert.ok(!withinAllowed('.gitignore', ['.gitignore']));
  assert.ok(withinAllowed('apps/miniapp/src/x.ts', ['apps/miniapp/src/**'])); // 정상은 true 유지
});

// --- glob ---
test('globMatches: ** 포함, * 미포함, 대소문자 무관', () => {
  assert.ok(globMatches('apps/**', 'apps/miniapp/src/x.ts'));
  assert.ok(globMatches('apps/miniapp/src/**', 'apps/miniapp/src/a/b.ts'));
  assert.ok(globMatches('산출물/06_테스트/**', '산출물/06_테스트/결과.md'));
  assert.ok(globMatches('.CLAUDE/**', '.claude/settings.json')); // 대소문자 무관
  assert.ok(globMatches('*.ts', 'a.ts'));
  assert.ok(!globMatches('*.ts', 'sub/a.ts'));
});

// --- 보호경로(B3·B4) ---
test('isUnderProtected / isForbidden: 확장된 보호경로 + 대소문자', () => {
  assert.ok(isForbidden('.claude/settings.json'));
  assert.ok(isForbidden('.claude/Settings.json'));        // B4: 대소문자
  assert.ok(isForbidden('.CLAUDE/settings.json'));        // B4
  assert.ok(isForbidden('tooling/scripts/루프_가드.mjs')); // B3: 자기 게이트 보호
  assert.ok(isForbidden('tooling/git-hooks/pre-commit'));
  assert.ok(isForbidden('.gitignore'));                   // minor
  assert.ok(isForbidden('CLAUDE.md'));
  assert.ok(!isForbidden('apps/miniapp/src/x.ts'));
  assert.ok(!isForbidden('산출물/06_테스트/결과.md'));
});

// --- 경로안전(보호경로 충돌, B3·B4·traversal) ---
test('pathSafety: 보호경로/넓은 글롭/traversal 위반', () => {
  assert.ok(!pathSafety({ allowed_paths: ['tooling/scripts/**'] }).safe); // B3
  assert.ok(!pathSafety({ allowed_paths: ['.CLAUDE/**'] }).safe);          // B4
  assert.ok(!pathSafety({ allowed_paths: ['산출물/../.claude/settings.json'] }).safe); // traversal
  assert.ok(!pathSafety({ allowed_paths: ['**'] }).safe);                  // 과넓음
  assert.ok(!pathSafety({ allowed_paths: ['.gitignore'] }).safe);
  assert.ok(!pathSafety({ allowed_paths: [] }).safe);
});

test('pathSafety: 안전 범위는 통과', () => {
  assert.ok(pathSafety({ allowed_paths: ['산출물/06_테스트/**', '평가증빙/**'] }).safe);
  assert.ok(pathSafety({ allowed_paths: ['apps/miniapp/src/**'] }).safe);
});

// --- withinAllowed 세그먼트 경계(B7) ---
test('withinAllowed: 형제 디렉터리·깊이 누수 차단', () => {
  assert.ok(withinAllowed('apps/miniapp/src/x.ts', ['apps/miniapp/src/**']));
  assert.ok(!withinAllowed('apps/miniappEVIL/x.ts', ['apps/miniapp']));            // B7 형제
  assert.ok(!withinAllowed('apps/miniapp/src/deep/x.ts', ['apps/miniapp/src/*'])); // B7 단일* 깊이
  assert.ok(withinAllowed('apps/miniapp/src/x.ts', ['apps/miniapp/src/*']));       // 단일* 한 단계 OK
  assert.ok(!withinAllowed('apps/api/x.mjs', ['apps/miniapp/**']));
});

// --- 게이트 없는 코드 경로(B10 대체) ---
test('isUngatedCode: miniapp 외 코드 경로 식별', () => {
  assert.ok(!isUngatedCode('apps/miniapp/src/x.ts')); // 검증_전체 --code 커버
  assert.ok(isUngatedCode('apps/api/server.mjs'));
  assert.ok(isUngatedCode('packages/domain/src/x.ts'));
  assert.ok(isUngatedCode('infra/scripts/deploy.sh'));
  assert.ok(!isUngatedCode('산출물/06_테스트/결과.md'));
});

// --- 결정론 선택 ---
test('selectNext: Ready·유효만·ID 오름차순·skip·경로안전', () => {
  const tasks = [
    { id: 'TASK-B', status: 'Ready', allowed_paths: ['apps/miniapp/**'] },
    { id: 'TASK-A', status: 'Ready', allowed_paths: ['.claude/**'] }, // 보호 → 차단
    { id: 'TASK-D', status: 'Ready', allowed_paths: ['apps/x/**'], invalid: true }, // 무효
    { id: 'TASK-C', status: 'Done', allowed_paths: ['apps/**'] },
  ];
  assert.equal(selectNext(tasks).task.id, 'TASK-B');
  assert.equal(selectNext(tasks, { skip: ['TASK-B'] }).task, null);
});

test('isReady: 무효·비Ready 제외', () => {
  assert.ok(isReady({ status: 'ready' }));
  assert.ok(!isReady({ status: 'Ready', invalid: true }));
  assert.ok(!isReady({ status: 'In Progress' }));
});

// --- HUMAN_APPROVAL 견고화(B11): 신규 생성·START/END·자기참조 ---
test('touchesHumanApproval: 마커(START/END) 파일 감지, 가드 자기참조 아님', () => {
  const dir = join(HERE, '_tmp');
  mkdirSync(dir, { recursive: true });
  const rel = 'tooling/scripts/__tests__/_tmp/fix.md';
  try {
    writeFileSync(join(dir, 'fix.md'), `앞\n${['HUMAN', 'APPROVAL', 'END'].join('_')}\n끝\n`); // END-only도 감지
    assert.ok(touchesHumanApproval(rel));
    writeFileSync(join(dir, 'fix.md'), '평범한 문서\n');
    assert.ok(!touchesHumanApproval(rel));
    assert.ok(!touchesHumanApproval('tooling/scripts/루프_가드.mjs')); // 자기참조 오탐 없음
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
