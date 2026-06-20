# REVIEW-20260620-012 pathspec 수정 검토

```yaml
id: REVIEW-20260620-012
related_task: TASK-20260620-010_브랜치전략및커밋헬퍼_작업지시서
review_agent: Codex
human_reviewer: 이상혁
reviewed_commit: 3943db9
status: Superseded
```

> **Superseded** — 정본: [REVIEW-20260620-012_pathspec재검토.md](REVIEW-20260620-012_pathspec재검토.md) (@5cfa779). 본 문서는 @3943db9(커밋 전) 시점 검토로 보존용이다.

## 판정

Accept with Conditions / 커밋(3파일 `--path`) → `develop` 머지 GO

REVIEW-011의 NO-GO 사유였던 Git pathspec magic 우회는 해소된 것으로 판정한다. `tooling/scripts/커밋.mjs`에 `process.env.GIT_LITERAL_PATHSPECS = '1'`이 추가되었고, `--path` 값이 ASCII `:`로 시작하면 종료코드 2로 차단된다. 실제 repo negative 실행에서 `:(glob)x-*.txt`, `:/etc/passwd`, `:(exclude)y`는 모두 `LASTEXITCODE=2`로 확인했다.

정상 회귀도 임시 repo에서 확인했다. 정상 `--path` 한글/공백 경로 커밋은 종료코드 0, `--all+--path`는 2, 빈 스테이징은 1, detached HEAD는 1로 재현됐다. 실제 repo에는 커밋·스테이징이 발생하지 않았다.

조건: 현재 diff에는 README까지 포함되어 4파일 변경이다. 사용자 지시의 최종 계획은 "3파일: git.md·커밋.mjs·재사용지침 / README는 이상혁 승인 시 추가"이므로, 즉시 커밋은 3파일만 `--path`로 명시하는 것을 GO로 판정한다. README 포함 4파일 커밋은 이상혁 승인 후 GO다.

## 검토 범위

- `tooling/scripts/커밋.mjs` pathspec 수정
- `.claude/rules/git.md`
- `산출물/09_AI개발파이프라인/재사용_운영지침.md`
- `README.md` 변경 존재 여부
- 실제 repo negative guard
- 임시 repo 정상 회귀 테스트

## 제공되지 않은 자료

- 원격 저장소 브랜치 보호 설정: Not Available
- GitHub Actions 원격 실행 결과: Not Available
- 실제 repo 성공 커밋 실행: Not Run (금지 조건 준수)
- `node tooling/scripts/검증_전체.mjs --strict`: Not Run (이번 요청 필수 명령 아님)

## 수락 기준별 결과

| 기준 | 결과 | 근거 |
|---|---|---|
| ① pathspec magic 완전 차단 | Pass | `GIT_LITERAL_PATHSPECS=1`과 `p.startsWith(':')` 차단 확인. `:(glob)`, `:/etc/passwd`, `:(exclude)` 모두 `LASTEXITCODE=2`. 백슬래시+콜론은 절대경로로 차단, 대문자 드라이브도 절대경로 차단. 유니코드 fullwidth colon은 Git magic이 아니라 literal 파일명으로 정상 처리됨. |
| ② 정상 `--path` 회귀 영향 없음 | Pass | 임시 repo `공백 한글 경로.txt` 커밋 종료코드 0, 메시지/본문 한글·공백 보존. |
| ③ 실제 repo 커밋 미발생 | Pass | `git log --oneline -3` HEAD는 `3943db9`, `git diff --cached --name-status` 출력 없음. |
| ④ README 미포함 커밋 계획 | Pass with Condition | 현재 diff는 README 포함 4파일. 3파일 커밋은 GO, README 포함 4파일은 이상혁 승인 후 GO. |
| ⑤ go/no-go | Conditional GO | 3파일 `--path` 커밋 후 `develop` 머지 GO. README 포함 시 사람 승인 필요. REVIEW-010/011/012 파일은 별도 산출물 커밋으로 분리. |

## 발견 사항

| ID | 심각도 | 내용 | 근거·재현 | 조치 |
|---|---|---|---|---|
| R12-001 | P3 | README 변경이 현재 diff에 포함되어 있으나, 최종 커밋 계획은 README 미포함 3파일로 제시되었다. | `git diff --name-only`: `.claude/rules/git.md`, `README.md`, `tooling/scripts/커밋.mjs`, `재사용_운영지침.md`. | 기본 GO는 3파일 커밋. README 포함은 이상혁 승인 후 4파일 커밋으로 진행. |
| R12-002 | P3 | REVIEW-010/011/012 독립검토서가 untracked로 남아 있다. | `git status --short`에 REVIEW-010 2건, REVIEW-011 1건 표시. 본 검토서 작성 후 REVIEW-012도 추가됨. | TASK-010 구현 커밋에는 포함하지 말고 별도 산출물 정리 커밋으로 분리. |
| R12-003 | P3 | line ending 경고가 반복된다. | `git diff --stat`에서 LF→CRLF 경고. | 기능 blocker는 아니나 후속으로 `.gitattributes` 또는 줄끝 정책 확정 권고. |

## 실행 또는 확인한 명령

### `node tooling/scripts/검증_전체.mjs`

종료코드: 0

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
Markdown 57개, 내부 링크 54개 검사

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

### Negative: `:(glob)x-*.txt`

명령: `node tooling/scripts/커밋.mjs --message "chore: x" --path ':(glob)x-*.txt'; Write-Output "LASTEXITCODE=$LASTEXITCODE"`

```text
pathspec magic 금지(':' 시작): :(glob)x-*.txt
LASTEXITCODE=2
```

### Negative: `:/etc/passwd`

명령: `node tooling/scripts/커밋.mjs --message "chore: x" --path ':/etc/passwd'; Write-Output "LASTEXITCODE=$LASTEXITCODE"`

```text
pathspec magic 금지(':' 시작): :/etc/passwd
LASTEXITCODE=2
```

### Negative: `:(exclude)y`

명령: `node tooling/scripts/커밋.mjs --message "chore: x" --path ':(exclude)y'; Write-Output "LASTEXITCODE=$LASTEXITCODE"`

```text
pathspec magic 금지(':' 시작): :(exclude)y
LASTEXITCODE=2
```

### Negative: `--all+--path`

명령: `node tooling/scripts/커밋.mjs --message "chore: x" --all --path README.md; Write-Output "LASTEXITCODE=$LASTEXITCODE"`

```text
--all과 --path를 동시에 쓸 수 없습니다.
LASTEXITCODE=2
```

### 임시 repo 정상 회귀

임시 repo: `C:\Users\DEV-PC\AppData\Local\Temp\task010-pathspec-audit-1e142274f01c43d185625daff8415f60`

```text
--- CASE: normal path korean spaces commit ---
스테이징: 공백 한글 경로.txt

=== git diff --cached --name-status ===
A	공백 한글 경로.txt
=== git status --short ===
A  "공백 한글 경로.txt"

커밋 실행...
[chore/TASK-temp a6e2303] chore: 정상 한글 메시지 with spaces
 1 file changed, 1 insertion(+)
 create mode 100644 공백 한글 경로.txt
커밋 완료 (브랜치 chore/TASK-temp): chore: 정상 한글 메시지 with spaces
푸시는 사람 허락 후 별도 실행(main은 PR).
chore: 정상 한글 메시지 with spaces
본문 공백

LASTEXITCODE=0
--- CASE: all plus path exclusive ---
--all과 --path를 동시에 쓸 수 없습니다.
LASTEXITCODE=2
--- CASE: empty staging blocked ---
스테이징: 공백 한글 경로.txt
스테이징된 변경이 없습니다. 커밋 중단.
LASTEXITCODE=1
--- CASE: pathspec magic blocked temp ---
pathspec magic 금지(':' 시작): :(glob)x-*.txt
LASTEXITCODE=2
--- CASE: unicode fullwidth colon literal ---
스테이징: ：literal.txt

=== git diff --cached --name-status ===
A	：literal.txt
=== git status --short ===
A  ：literal.txt
?? mix.txt

커밋 실행...
[chore/TASK-temp a1b8876] chore: unicode colon literal
 1 file changed, 1 insertion(+)
 create mode 100644 ：literal.txt
커밋 완료 (브랜치 chore/TASK-temp): chore: unicode colon literal
푸시는 사람 허락 후 별도 실행(main은 PR).
a1b8876 chore: unicode colon literal
A	：literal.txt
LASTEXITCODE=0
--- CASE: detached blocked ---
detached HEAD 상태입니다. 브랜치를 체크아웃한 뒤 커밋하세요.
LASTEXITCODE=1
--- CASE: backslash colon attempt ---
절대경로 금지: \:(glob)x-*.txt
LASTEXITCODE=2
--- CASE: uppercase drive absolute ---
절대경로 금지: C:\Temp\x.txt
LASTEXITCODE=2
```

### `git diff --stat`

종료코드: 0

```text
 .claude/rules/git.md                          |  22 ++++-
 README.md                                     |   3 +-
 tooling/scripts/커밋.mjs                      | 121 ++++++++++++++++++++------
 산출물/09_AI개발파이프라인/재사용_운영지침.md |   1 +
 4 files changed, 118 insertions(+), 29 deletions(-)
warning: in the working copy of '.claude/rules/git.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'README.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tooling/scripts/커밋.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of '산출물/09_AI개발파이프라인/재사용_운영지침.md', LF will be replaced by CRLF the next time Git touches it
```

### `git status --short`

종료코드: 0

```text
 M .claude/rules/git.md
 M README.md
 M tooling/scripts/커밋.mjs
 M 산출물/09_AI개발파이프라인/재사용_운영지침.md
?? 산출물/09_AI개발파이프라인/독립검토서/REVIEW-20260620-010-PREIMPL_브랜치전략구현전검토.md
?? 산출물/09_AI개발파이프라인/독립검토서/REVIEW-20260620-010_브랜치전략및부트스트랩_검토.md
?? 산출물/09_AI개발파이프라인/독립검토서/REVIEW-20260620-011_TASK010구현검토.md
```

### 실제 repo 커밋·스테이징 미발생

`git log --oneline -3` 종료코드: 0

```text
3943db9 docs: finalize TASK-010 spec with file-change plan and helper conditions
804dc54 docs: clarify README scope and record REVIEW-009 consensus
de049d7 chore: bootstrap 3-agent harness and Phase 0 governance
```

`git diff --cached --name-status` 종료코드: 0

```text
```

## 남은 위험

- README 변경은 현재 diff에 있으나, 기본 GO 대상은 3파일이다. README 포함은 이상혁 승인 후 진행해야 한다.
- REVIEW-010/011/012 검토서는 TASK-010 구현 커밋에 포함하지 말고 별도 산출물 정리 커밋으로 분리해야 한다.
- `--all`은 명시 옵션으로 남아 있으므로 untracked 검토서가 있는 현재 작업트리에서는 사용하면 안 된다.
- 줄끝 경고(LF→CRLF)는 기능 blocker는 아니나 후속 정책화가 필요하다.

## 사람 승인 질문

1. TASK-010 구현 커밋을 3파일(`.claude/rules/git.md`, `tooling/scripts/커밋.mjs`, `재사용_운영지침.md`)만 `--path`로 진행할까요?
2. README 변경도 이번 TASK-010 커밋에 포함하는 4파일 커밋으로 승인할까요?
3. REVIEW-010/011/012 검토서는 별도 산출물 정리 커밋으로 분리할까요?
