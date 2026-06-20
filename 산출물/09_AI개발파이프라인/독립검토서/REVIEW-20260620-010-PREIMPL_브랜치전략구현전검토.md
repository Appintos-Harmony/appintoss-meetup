# REVIEW-20260620-010 브랜치전략 구현 전 검토

```yaml
id: REVIEW-20260620-010-PREIMPL
related_task: TASK-20260620-010_브랜치전략및커밋헬퍼_작업지시서
review_agent: Codex
human_reviewer: 이상혁
reviewed_commit: 3943db9
status: Final
```

## 판정

Accept with Conditions / 구현 착수 조건부 GO

TASK-010은 구현 착수 가능하다. `main`은 부트스트랩 커밋 `de049d7`만 가리키고, `develop`은 그 위 `3943db9`까지 진행되어 main 직접작업 원칙 위반은 확인되지 않았다. 필수 검증 `node tooling/scripts/검증_전체.mjs`도 종료코드 0으로 PASS했다.

조건은 3가지다. 첫째, 구현은 `develop`에서 분기한 작업 브랜치에서 수행한다. 둘째, 현재 작업트리에 이전 Codex 검토서 untracked 파일이 남아 있으므로 TASK-010 구현 커밋에서는 `--all`을 사용하지 말고 변경 예정 파일 4개만 명시 스테이징한다. 셋째, 헬퍼 구현 시 `--all`과 `--path` 동시 지정 실패, 커밋 메시지 전달의 배열 인자 처리, 한글 메시지 보존을 테스트 관점에 포함한다.

권장 작업 브랜치명: `chore/TASK-20260620-010-branch-strategy-commit-helper`

## 검토 범위

- `AGENTS.md`
- `산출물/09_AI개발파이프라인/작업지시서/TASK-20260620-010_브랜치전략및커밋헬퍼_작업지시서.md`
- `산출물/00_프로젝트관리/의사결정_기록.md`의 DL-014
- `산출물/09_AI개발파이프라인/독립검토서/REVIEW-20260620-009_README합의기록및TASK009_검토.md`
- `.claude/rules/git.md`
- `tooling/scripts/커밋.mjs`
- `README.md`
- `산출물/09_AI개발파이프라인/재사용_운영지침.md`

## 제공되지 않은 자료

- TASK-010 실제 구현 diff: Not Available
- TASK-010 구현 후 커밋 헬퍼 동작 로그: Not Run
- 원격 저장소 브랜치 보호 규칙과 PR 보호 설정: Not Available

## 수락 기준별 결과

| 기준 | 결과 | 근거 |
|---|---|---|
| 1. git 구조: `main`=부트스트랩 1커밋, `develop`=그 위 작업 | Pass | `git log --oneline --all`은 `3943db9`, `804dc54`, `de049d7` 순서. `git branch -v` 보조 확인에서 `main de049d7`, `develop 3943db9`. |
| 1. main 직접작업 위반 없음 | Pass | `git branch`는 현재 `develop`; `main` 포인터는 `de049d7`에 머문다. DL-014는 부트스트랩 1회만 `main` 허용, 이후 조장 승인 필수를 기록한다(`산출물/00_프로젝트관리/의사결정_기록.md:93-98`). |
| 2. 변경 예정 파일 4개가 충분하고 모순 없는지 | Pass | TASK-010 `allowed_paths`는 `.claude/rules/git.md`, `재사용_운영지침.md`, `tooling/scripts/커밋.mjs`, `README.md` 4개를 허용한다(`TASK-20260620-010...md:13`). 파일 역할도 핵심 구현, 정본 정책, 재사용 지침, 온보딩으로 분리되어 있다(`TASK-20260620-010...md:56-63`). |
| 2. 헬퍼 8조건 충분성 | Pass with Notes | main 차단, 반복 `--path`, 빈 스테이징, detached HEAD, 기존 staged 기본 차단, 위험 경로 차단, diff/status 출력, `--all` 옵트인이 명시되어 있다(`TASK-20260620-010...md:65-66`). 추가로 `--all`+`--path` 동시 지정 실패와 `git commit`도 배열 인자로 호출하는 구현 원칙을 넣으면 더 단단하다. |
| 3. 브랜치 전략 정본 위치 | Pass | `.claude/rules/git.md`는 이미 커밋·푸시 자동화 정책 정본 역할을 가진다(`.claude/rules/git.md:11-18`). TASK-010이 브랜치 전략과 main 병합 조건을 이 파일에 통합하도록 한 것은 타당하다. README는 팀원 온보딩 한 줄, 재사용 지침은 새 프로젝트 부트스트랩/권한 안내로 두는 분담도 적절하다. |
| 4. 추가 edge case | Partial / Non-blocking | TASK-010은 REVIEW-009의 공백/한글 경로, detached HEAD, 기존 staged, 빈 스테이징을 반영했다(`REVIEW-20260620-009...md:49-51`, `TASK-20260620-010...md:47`). 다만 `--all`과 `--path` 동시 지정, 커밋 메시지 한글/공백/따옴표 전달은 명시 보강 권고. |
| 5. 구현 go/no-go 및 브랜치명 | Conditional GO | 구현 착수 가능. 권장 브랜치명은 `chore/TASK-20260620-010-branch-strategy-commit-helper`. 현재 untracked 검토서가 있으므로 구현 커밋은 명시 경로 스테이징만 사용해야 한다. |

## 발견 사항

| ID | 심각도 | 내용 | 근거·재현 | 조치 |
|---|---|---|---|---|
| PRE-010-001 | P2 | 구현 직전 작업트리가 완전히 clean하지 않다. 이전 독립검토서 untracked 파일이 남아 있어 `--all` 사용 시 TASK-010 allowed_paths 밖 파일이 함께 커밋될 수 있다. | 보조 명령 `git status --short` 출력: `?? 산출물/09_AI개발파이프라인/독립검토서/REVIEW-20260620-010_브랜치전략및부트스트랩_검토.md` | TASK-010 구현은 작업 브랜치에서 수행하고, 커밋 시 `.claude/rules/git.md`, `tooling/scripts/커밋.mjs`, `재사용_운영지침.md`, `README.md`만 명시 스테이징한다. |
| PRE-010-002 | P3 | TASK-010 본문은 Ready/최종 go 대기 상태이나 제목에는 `(초안)`이 남아 있다. 구현 의미를 막지는 않지만 사람/AI가 문서 상태를 오해할 수 있다. | `TASK-20260620-010...md:1` 제목은 `(초안)`, frontmatter `status: Ready`, 사용자 승인 문단은 구현 착수 최종 go 대기(`TASK-20260620-010...md:68-72`). | 구현 중 README/정책 파일만 고치라는 현재 allowed_paths를 유지한다면 즉시 수정하지 말고, 후속 문서 정리 때 제목에서 `(초안)` 제거. |
| PRE-010-003 | P3 | 헬퍼 8조건에는 `--all`과 `--path` 동시 지정 시 우선순위가 명확하지 않다. | TASK-010은 `--path` 반복과 `--all` 옵트인을 모두 명시하지만 상호배타 조건은 별도 문장으로 없다(`TASK-20260620-010...md:65-66`). | 구현 시 `--all`과 `--path` 동시 지정은 종료코드 2로 실패시키고 사용법을 출력한다. |
| PRE-010-004 | P3 | 현행 `커밋.mjs`는 `git add -A`와 `git commit -m ...`를 shell command string으로 호출한다. TASK-010은 add path 배열 인자를 명시했지만 commit 메시지도 배열 인자로 처리하는 편이 한글·따옴표·공백에 안전하다. | 현행 `커밋.mjs:28-30`; TASK-010 edge case는 add에 대한 `execFileSync('git',['add','--',...paths])`를 명시(`TASK-20260620-010...md:47`). | 구현 시 `execFileSync('git', ['commit', '-m', msg, ...bodyArgs])` 형태로 호출하고 한글 conventional 메시지 smoke test를 포함한다. |

## 실행 또는 확인한 명령

### `git log --oneline --all`

종료코드: 0

```text
3943db9 docs: finalize TASK-010 spec with file-change plan and helper conditions
804dc54 docs: clarify README scope and record REVIEW-009 consensus
de049d7 chore: bootstrap 3-agent harness and Phase 0 governance
```

### `git branch`

종료코드: 0

```text
* develop
  main
```

### `git config core.hooksPath`

종료코드: 0

```text
tooling/git-hooks
```

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
Markdown 55개, 내부 링크 54개 검사

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

### 보조 확인: `git branch -v`

종료코드: 0

```text
* develop 3943db9 docs: finalize TASK-010 spec with file-change plan and helper conditions
  main    de049d7 chore: bootstrap 3-agent harness and Phase 0 governance
```

### 보조 확인: `git status --short`

종료코드: 0

```text
?? 산출물/09_AI개발파이프라인/독립검토서/REVIEW-20260620-010_브랜치전략및부트스트랩_검토.md
```

### 작성 후 범위 확인: `git status --short`

종료코드: 0

```text
?? 산출물/09_AI개발파이프라인/독립검토서/REVIEW-20260620-010_브랜치전략구현전검토.md
?? 산출물/09_AI개발파이프라인/독립검토서/REVIEW-20260620-010_브랜치전략및부트스트랩_검토.md
```

## 남은 위험

- TASK-010 구현 전이므로 헬퍼 실제 동작은 아직 Unverified다.
- `--strict` 검증은 이번 필수 명령에 포함되지 않았고, 제품 산출물 23건 누락은 기존 상태로 남아 있다. main 병합 조건 충족 여부는 Not Run이다.
- 현재 untracked 검토서가 있으므로 구현 커밋에서 `--all` 사용은 위험하다.
- 원격 브랜치 보호, PR 필수 설정, GitHub Actions 원격 실행은 Not Available이다.

## 사람 승인 질문

1. TASK-010 구현을 `chore/TASK-20260620-010-branch-strategy-commit-helper` 브랜치에서 착수해도 되는가?
2. 구현 커밋 전에는 이번/이전 Codex 검토서를 제외하고 TASK-010 변경 예정 파일 4개만 명시 스테이징하도록 강제해도 되는가?
3. `--all`+`--path` 동시 지정 실패, `git commit` 배열 인자 호출, 한글 메시지 smoke test를 TASK-010 구현 검증 조건에 추가해도 되는가?
