# REVIEW-20260620-012 pathspec 재검토

```yaml
id: REVIEW-20260620-012
related_task: TASK-20260620-010_브랜치전략및커밋헬퍼_작업지시서
review_agent: Codex
human_reviewer: 이상혁
reviewed_commit: 5cfa779
status: Final
```

## 판정

Accept with Conditions / pathspec 수정 통과, 현재 상태의 `develop` 머지는 조건부 보류

REVIEW-011 NO-GO 사유였던 pathspec magic 우회는 해소된 것으로 판정한다. `tooling/scripts/커밋.mjs`는 `process.env.GIT_LITERAL_PATHSPECS = '1'`을 설정하고, `--path` 값이 ASCII `:`로 시작하면 종료코드 2로 차단한다. 임시 repo에서 `magic-a.txt`·`magic-b.txt`를 만든 뒤 `--path ':(glob)magic-*.txt'`를 실행했을 때 Node 종료코드 2, staged 변경 없음, 두 파일은 untracked 상태로 남는 것을 확인했다. 이후 `--path magic-a.txt`는 `magic-a.txt`만 커밋했다.

단, 검토 중 실제 repo의 HEAD가 `3943db9`에서 `5cfa779`로 변경되었다. `5cfa779`는 `.claude/rules/git.md`, `tooling/scripts/커밋.mjs`, `산출물/09_AI개발파이프라인/재사용_운영지침.md` 3파일 커밋이다. Codex는 이 커밋을 실행하지 않았고, 이 검토 턴에서 실제 repo에 `커밋.mjs --message ...`를 실행하지 않았다. 현재 `README.md`는 modified로 남아 있어 사용자가 요청한 "4파일 커밋" 상태는 충족되지 않았다.

따라서 판정은 다음과 같이 분리한다:

- pathspec 수정 자체: GO
- 3파일 커밋 `5cfa779`: 검토 기준 통과
- README 포함 4파일 완료: 아직 미완료
- 현재 상태에서 `develop` 머지: README 처리와 untracked REVIEW 파일 분리 결정 전 조건부 보류

## 검토 범위

- `tooling/scripts/커밋.mjs` pathspec 수정
- `.claude/rules/git.md`
- `산출물/09_AI개발파이프라인/재사용_운영지침.md`
- `README.md` 잔여 변경
- 실제 repo 검증 명령
- 임시 repo pathspec negative/정상 회귀 테스트

## 제공되지 않은 자료

- `5cfa779` 커밋 실행 주체와 실행 로그: Not Available
- 원격 저장소 브랜치 보호 설정: Not Available
- GitHub Actions 원격 실행 결과: Not Available
- 실제 repo에서 Codex가 실행한 성공 커밋: Not Run (금지 조건 준수)
- `node tooling/scripts/검증_전체.mjs --strict`: Not Run (이번 요청 필수 명령 아님)

## 수락 기준별 결과

| 기준 | 결과 | 근거 |
|---|---|---|
| ① magic 완전 차단(우회로 포함) | Pass | ASCII `:(glob)`, `:/`, `:(exclude)`는 종료코드 2. 임시 repo `:(glob)magic-*.txt`는 staged 변경 없이 차단. `--path=:(top)`은 알 수 없는 인자로 종료코드 2. 백슬래시 절대 변형과 대문자 드라이브는 절대경로로 종료코드 2. 전각 콜론은 Git magic이 아닌 literal 파일명으로만 처리됨. |
| ② literal 정상 동작 | Pass | 임시 repo `--path magic-a.txt`는 `magic-a.txt`만 커밋. 한글/공백 경로 회귀도 이전 검토에서 종료코드 0 확인됨. |
| ③ 실제 repo 커밋 0 | Dispute / 상태 변경 확인 | 검토 중 HEAD가 `5cfa779`로 변경됨. Codex는 커밋하지 않았으나, 실제 repo에는 3파일 커밋이 존재한다. |
| ④ 4파일 `--path` 커밋 계획에서 REVIEW 파일 제외 | Partial | REVIEW 파일은 untracked로 남아 제외 가능. 그러나 현재 커밋은 3파일이고 README는 modified로 남아 4파일 커밋 완료 상태가 아님. |
| ⑤ go/no-go | Conditional | pathspec 수정과 3파일 커밋은 GO. README를 별도 커밋 포함 또는 제외 처리하고, untracked REVIEW 파일을 분리한 뒤 `develop` 머지 GO. 현 dirty 상태 그대로 머지는 보류. |

## 발견 사항

| ID | 심각도 | 내용 | 근거·재현 | 조치 |
|---|---|---|---|---|
| R12R-001 | P2 | 검토 중 실제 repo에 3파일 커밋 `5cfa779`가 생겼고, README는 미커밋으로 남았다. | `git log --oneline -5`, `git show --name-status --oneline -1`, 최종 `git status --short`. | README를 포함하는 별도 커밋을 할지, README 변경을 다음 작업으로 넘길지 사람 결정 필요. |
| R12R-002 | P3 | `.\:(glob)...` 변형은 magic 확장으로 빠져나가지는 않지만, 현재는 친절한 guard 메시지가 아니라 `git add` 실패와 Node stack trace로 종료된다. | 임시 repo `dot backslash colon invalid literal`: `NODE_EXIT=1`, cached 없음, `fatal: pathspec ... did not match any files`. | 기능 blocker 아님. 후속으로 `git add` 실패를 try/catch 처리해 사용자 메시지를 정리하면 좋다. |
| R12R-003 | P3 | REVIEW-010/011/012 검토서 파일이 untracked로 남아 있다. | 최종 `git status --short`에 REVIEW 파일 5건 표시. | TASK-010 구현 커밋/머지에는 포함하지 말고 별도 산출물 정리 커밋으로 분리. |
| R12R-004 | P3 | 줄끝 경고가 반복된다. | `git diff --stat`에서 LF→CRLF 경고. | 기능 blocker는 아니나 `.gitattributes` 또는 줄끝 정책을 후속 정리 권고. |

## 실행 또는 확인한 명령

### `node tooling/scripts/검증_전체.mjs`

최종 재실행 종료코드: 0

```text
# 검증 전체 — 하네스 기본 검증

===== 팀 공유 문서 (팀공유문서_검증.mjs) =====
# 팀 공유 문서 검증 (--allow-template)
검사 대상: 6개 문서

결과: PASS

===== 산출물 존재(보고) (산출물_검증.mjs) =====
# 산출물 검증 (CLAUDE.md §9)
항목(M10 제외): 존재 26 / 누락 23 / 전체 49
M10 프로그램 소스코드: 부분(infra)

누락:
 - M03 종료보고서 → 산출물/00_프로젝트관리/프로젝트_종료보고서.md
 - M04 프로그램 목록 → 산출물/05_개발설계/프로그램_목록.md
 - M05 서비스 기능 정의서 → 산출물/01_서비스기획/서비스_기능정의서.md
 - M06 화면설계서 → 산출물/03_화면설계/화면설계서.md
 - M07 시스템 구성도 → 산출물/04_시스템설계/시스템_구성도.md
 - M08 테이블 정의서 → 산출물/04_시스템설계/테이블_정의서.md
 - M09 프로그램 설계서 → 산출물/05_개발설계/프로그램_설계서.md
 - M11 단위테스트 계획서 → 산출물/06_테스트/단위테스트_계획서.md
 - M12 단위테스트 결과서 → 산출물/06_테스트/단위테스트_결과서.md
 - M13 통합테스트 계획서 → 산출물/06_테스트/통합테스트_계획서.md
 - M14 통합테스트 결과서 → 산출물/06_테스트/통합테스트_결과서.md
 - M15 사용자 매뉴얼 → 산출물/08_사용자매뉴얼/사용자_매뉴얼.md
 - A06 PRD → 산출물/01_서비스기획/제품요구사항정의서_PRD.md
 - A07 요구사항 추적표 → 산출물/01_서비스기획/요구사항_추적표.md
 - A11 피그마 디자인인계서 → 산출물/03_화면설계/피그마_디자인인계서.md
 - A12 API 명세서 → 산출물/04_시스템설계/API_명세서.md
 - A13 권한 설계서 → 산출물/04_시스템설계/권한_설계서.md
 - A15 테스트 종합보고서 → 산출물/06_테스트/테스트_종합보고서.md
 - A16 앱인토스 실기기검수표 → 산출물/06_테스트/앱인토스_실기기검수표.md
 - A17 배포 실행절차서 → 산출물/07_배포운영/배포_실행절차서.md
 - A18 롤백 계획서 → 산출물/07_배포운영/롤백_계획서.md
 - A19 출시 점검표 → 산출물/07_배포운영/출시_점검표.md
 - A20 앱인토스 심사제출서 → 산출물/07_배포운영/앱인토스_심사제출서.md

결과: 보고 완료

===== 내부 링크 (링크_검증.mjs) =====
# 링크 검증 (내부 상대 링크)
Markdown 59개, 내부 링크 54개 검사

결과: PASS

===== 작업지시서 (작업지시서_검증.mjs) =====
# 작업지시서 검증
검사 5개 (템플릿 제외)

결과: PASS

===== 비밀값 (비밀값_스캔.mjs) =====
# 비밀값 스캔
비밀값 패턴 없음
결과: PASS

===== 요약 =====
 PASS  팀 공유 문서
 PASS  산출물 존재(보고)
 PASS  내부 링크
 PASS  작업지시서
 PASS  비밀값

전체 결과: PASS — 하네스 기본 검증
```

### 임시 repo: magic 차단 및 미스테이징 확인

임시 repo: `C:\Users\DEV-PC\AppData\Local\Temp\task010-pathspec-recheck-49892309fef24d208e359829c08660b3`

```text
--- CLEAN: magic glob blocked node exit and unstaged ---
pathspec magic 금지(':' 시작): :(glob)x-*.txt
NODE_EXIT=2
CACHED_AFTER_MAGIC:
STATUS_AFTER_MAGIC:
?? magic-b.txt
?? x-a.txt
?? x-b.txt
```

### 임시 repo: literal 파일만 커밋

```text
--- CLEAN: literal x-a only commit ---
스테이징: x-a.txt

=== git diff --cached --name-status ===
A	x-a.txt
=== git status --short ===
A  x-a.txt
?? magic-b.txt
?? x-b.txt

커밋 실행...
[chore/TASK-temp af4c566] chore: literal x a
 1 file changed, 1 insertion(+)
 create mode 100644 x-a.txt
커밋 완료 (브랜치 chore/TASK-temp): chore: literal x a
푸시는 사람 허락 후 별도 실행(main은 PR).
NODE_EXIT=0
af4c566 chore: literal x a
A	x-a.txt
STATUS_AFTER_LITERAL:
?? magic-b.txt
?? x-b.txt
```

### 임시 repo: 회귀 및 우회 시도

```text
--- CASE: all plus path exclusive ---
--all과 --path를 동시에 쓸 수 없습니다.
LASTEXITCODE=2
--- CASE: empty staging blocked ---
스테이징: magic-a.txt
스테이징된 변경이 없습니다. 커밋 중단.
LASTEXITCODE=1
--- CASE: detached blocked ---
detached HEAD 상태입니다. 브랜치를 체크아웃한 뒤 커밋하세요.
LASTEXITCODE=1
--- CASE: fullwidth colon literal ---
스테이징: ：(glob)fw.txt

=== git diff --cached --name-status ===
A	：(glob)fw.txt
=== git status --short ===
A  ：(glob)fw.txt
?? magic-b.txt

커밋 실행...
[chore/TASK-temp 01b8bd7] chore: fullwidth colon literal
 1 file changed, 1 insertion(+)
 create mode 100644 ：(glob)fw.txt
커밋 완료 (브랜치 chore/TASK-temp): chore: fullwidth colon literal
푸시는 사람 허락 후 별도 실행(main은 PR).
01b8bd7 chore: fullwidth colon literal
A	：(glob)fw.txt
LASTEXITCODE=0
--- CASE: equals path option blocked ---
알 수 없는 인자: --path=:(top)
사용: node tooling/scripts/커밋.mjs --message "type(scope): 설명" (--path <경로> ... | --all) [--body ...] [--allow-main] [--include-staged]
LASTEXITCODE=2
--- CASE: backslash colon absolute blocked ---
절대경로 금지: \:(glob)magic-*.txt
LASTEXITCODE=2
--- CLEAN: dot backslash colon node exit ---
스테이징: .\:(glob)magic-*.txt
NODE_EXIT=1
CACHED_AFTER_DOT_BACKSLASH:
fatal: pathspec '.\:(glob)magic-*.txt' did not match any files
--- CASE: uppercase drive absolute ---
절대경로 금지: C:\Temp\x.txt
LASTEXITCODE=2
```

### 최종 `git log --oneline -5`

종료코드: 0

```text
5cfa779 chore(harness): TASK-010 branch strategy and hardened commit helper
3943db9 docs: finalize TASK-010 spec with file-change plan and helper conditions
804dc54 docs: clarify README scope and record REVIEW-009 consensus
de049d7 chore: bootstrap 3-agent harness and Phase 0 governance
```

### 최종 `git show --name-status --oneline -1`

종료코드: 0

```text
5cfa779 chore(harness): TASK-010 branch strategy and hardened commit helper
M	.claude/rules/git.md
M	tooling/scripts/커밋.mjs
M	산출물/09_AI개발파이프라인/재사용_운영지침.md
```

### 최종 `git status --short`

종료코드: 0

```text
 M README.md
?? 산출물/09_AI개발파이프라인/독립검토서/REVIEW-20260620-010-PREIMPL_브랜치전략구현전검토.md
?? 산출물/09_AI개발파이프라인/독립검토서/REVIEW-20260620-010_브랜치전략및부트스트랩_검토.md
?? 산출물/09_AI개발파이프라인/독립검토서/REVIEW-20260620-011_TASK010구현검토.md
?? 산출물/09_AI개발파이프라인/독립검토서/REVIEW-20260620-012_pathspec수정검토.md
?? 산출물/09_AI개발파이프라인/독립검토서/REVIEW-20260620-012_pathspec재검토.md
```

### 실제 repo staged 확인

`git diff --cached --name-status` 종료코드: 0

```text
```

## 남은 위험

- README 변경이 아직 미커밋이다. 4파일 커밋을 원하면 README 추가 커밋 또는 amend 정책 결정이 필요하다.
- `--all`은 여전히 명시 옵션으로 존재한다. 현재 untracked REVIEW 파일이 있으므로 TASK-010 관련 커밋에는 반드시 명시 `--path`만 사용해야 한다.
- 전각 콜론은 Git pathspec magic이 아니어서 literal 파일명으로 허용된다. 보안 우회는 아니지만 시각적 혼동을 줄이고 싶다면 후속으로 금지할 수 있다.
- `.\:(glob)`처럼 존재하지 않는 literal 경로는 확장 없이 실패하지만, 현재는 stack trace가 섞인다. 기능 blocker는 아니나 후속 UX 개선 대상이다.
- 줄끝 경고(LF→CRLF)는 계속 발생한다. 후속으로 `.gitattributes` 또는 줄끝 정책 확정 권고.

## 사람 승인 질문

1. 이미 발생한 3파일 커밋 `5cfa779`를 TASK-010 구현 커밋으로 인정할까요?
2. README 변경을 별도 커밋으로 포함한 뒤 `develop` 머지를 승인할까요, 아니면 README는 이번 TASK-010에서 제외할까요?
3. REVIEW-010/011/012 검토서들은 별도 산출물 정리 커밋으로 분리할까요?
