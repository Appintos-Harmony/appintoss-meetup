# REVIEW-20260620-009 README·합의기록·TASK-009 검토

```yaml
id: REVIEW-20260620-009
related_task: TASK-20260620-009
review_agent: Codex
human_reviewer: 이상혁
reviewed_commit: Not Available (git initialized, no commits yet on main)
status: Draft
```

## 판정

Accept with Conditions / 조건부 승인 권고

README 보강, 합의기록 목록, DL-013, TASK-009 초안은 현재 검증을 깨지 않는다. 필수 명령 `검증_전체`, `링크_검증`, `팀공유문서_검증`은 모두 종료코드 0으로 PASS했다. 합의기록의 REVIEW/DL 링크도 실제 파일로 해소된다.

다만 TASK-009 설계는 방향은 맞지만 구현 전 보완이 필요하다. `--allow-main`과 명시 스테이징은 안전성을 높이지만, `--paths "p1 p2"` 방식은 공백 포함 경로, pathspec 경계, 빈 스테이징, detached HEAD, 기존 staged 변경 섞임 같은 edge case를 더 명시해야 한다. 브랜치 전략도 `main`/`develop`/TASK 브랜치/릴리즈 브랜치로 전문적으로 재정의하는 것이 맞다.

## 검토 범위

- `README.md`
- `산출물/09_AI개발파이프라인/합의기록/합의_기록_목록.md`
- `산출물/00_프로젝트관리/의사결정_기록.md` DL-013
- `산출물/09_AI개발파이프라인/작업지시서/TASK-20260620-009_커밋헬퍼강화_작업지시서.md`
- 관련 근거: `REVIEW-20260620-008_RF수정및깃자동화_검토.md`, `AGENTS.md`

## 제공되지 않은 자료

- 실제 TASK-009 구현 diff: Not Available. TASK-009는 `status: Proposed` 초안이다.
- 커밋 helper 실제 커밋 실행: Not Run. `커밋.mjs --message ...` 실행 금지 조건을 준수했다.
- 원격 브랜치/PR 보호 규칙: Not Available. 현재 로컬 저장소는 첫 커밋 전 상태다.

## 수락 기준별 결과

| 기준 | 결과 | 근거 |
|---|---|---|
| 1. 신규/수정 문서가 검증을 깨지 않는지 | Pass | `검증_전체.mjs`, `링크_검증.mjs`, `팀공유문서_검증.mjs` 모두 종료코드 0. 링크 검사: Markdown 52개, 내부 링크 51개 PASS. |
| 1. 합의기록 REVIEW/DL 링크 해소 | Pass | `합의_기록_목록.md:16-18`의 REVIEW-006/007/008 파일 모두 존재. 링크 검증 PASS. |
| 2. 합의_기록_목록의 REVIEW/DL 일관성 | Pass | 합의-001은 REVIEW-006↔DL-008, 합의-002는 REVIEW-007↔DL-011, 합의-003은 REVIEW-008↔DL-013으로 대응. REVIEW-008의 조건부·TASK-009 필요와 DL-013 내용 일치. |
| 3. README 실제 구조·역할 일치 | Partial | 시작 절차, 역할, 운영 폴더, 검증 명령은 실제 구조와 대체로 일치. 단 `apps/ packages/ infra/`를 제품 소스코드 폴더로 묶었지만 현재 `apps/`, `packages/`는 존재하지 않고 `infra/`만 존재한다. `AI 하네스·거버넌스 구축 완료(검증 PASS)`는 기본 검증 기준으로는 맞지만 strict 산출물 누락 23건과 구분 필요. |
| 4. TASK-009 설계 타당성 | Partial | C1 main 기본 차단 + `--allow-main`, C2 명시 스테이징은 방향이 타당. 단 공백 경로, 빈 스테이징, detached HEAD, 기존 staged 변경, pathspec 안전성, branch naming, 사용법 검증이 더 필요. |
| 5. 첫 부트스트랩 커밋 체크리스트 | Partial | DL-013에 main 1회, 권장 메시지, REVIEW reviewed_commit 갱신이 있음. 누락: 커밋 직전 `git status` 원문 승인, `검증_전체` 원문 확인, `비밀값_스캔 --staged` 확인, remote 없음 확인, 브랜치 전략 확정 후 `develop` 생성 계획. |

## 발견 사항

| ID | 심각도 | 내용 | 근거·재현 | 조치 |
|---|---|---|---|---|
| R9-001 | P2 | TASK-009의 `--paths "p1 p2 …"` 설계는 공백 포함 경로를 안전하게 처리하기 어렵다. | `TASK-009:22-26` | `--path <path>` 반복 또는 `--paths <path1> <path2> --` 형태로 명확화. Node에서는 shell string 조립 없이 `execFileSync('git', ['add', '--', ...paths])` 사용. |
| R9-002 | P2 | 기존 staged 변경이 있는 상태에서 `--paths`/`--all`이 실행되면 의도하지 않은 변경이 함께 커밋될 수 있다. | TASK-009 수락 기준에 기존 staged 상태 처리 없음. | 시작 시 `git diff --cached --name-only`가 비어 있지 않으면 중단하거나 `--include-staged` 명시 요구. |
| R9-003 | P2 | detached HEAD, unborn main, branch naming 정책이 TASK-009에 명확하지 않다. | `git branch --list`는 첫 커밋 전 빈 출력, 현재는 unborn main 상태. | `symbolic-ref --short HEAD` 실패 시 중단. 첫 부트스트랩은 `main --allow-main`만 허용, 이후 `develop` 또는 `feature/fix/chore/docs/TASK-...`만 허용. |
| R9-004 | P3 | README의 “검증 PASS” 표현은 strict 산출물 검증과 혼동될 수 있다. | README 10-12행, `검증_전체` 출력은 기본 PASS이나 산출물 23건 누락을 보고. | “하네스 기본 검증 PASS, 제출용 strict는 제품 산출물 작성 후”로 표현 보강 권고. |
| R9-005 | P3 | README의 `apps/ packages/ infra/` 설명은 현재 실제 구조와 완전히 같지 않다. | 루트 나열 결과 `infra`는 존재, `apps`·`packages`는 없음. | “예정: apps/packages, 현재: infra만 존재”처럼 구분. |

## TASK-009 설계 리뷰

### C1 main 기본 차단 + `--allow-main`

타당하다. `main`은 안정 브랜치이고 직접 커밋을 기본 차단해야 한다. 다만 첫 부트스트랩 커밋 1회는 사용자가 승인했으므로 `--allow-main`이 필요하다.

보완 제안:

- `main`에서 `--allow-main` 없으면 종료코드 1.
- `--allow-main`은 `main`에서만 의미 있게 하고, 다른 브랜치에서 주면 경고 또는 무시.
- `--allow-main` 사용 시 `--bootstrap` 같은 더 명확한 별칭도 고려.
- `main` 부트스트랩 후에는 `develop` 생성과 이후 작업 브랜치 사용을 체크리스트에 포함.

### C2 명시 스테이징

방향은 타당하다. `git add -A` 기본값은 과하다. 하지만 `--paths "p1 p2"` 문자열 방식은 안전하지 않다.

보완 제안:

- 추천 CLI:
  - `--path <path>` 반복 허용: `--path README.md --path 산출물/.../파일.md`
  - `--all`은 명시 opt-in.
  - `--` 이후 인자를 pathspec으로 처리하는 방식도 허용 가능.
- 구현은 `execFileSync('git', ['add', '--', ...paths])` 형태로 shell escaping 문제를 피한다.
- 각 path는 repo root 기준이어야 하며 `..`, 절대경로, `.git` 내부 경로는 차단한다.
- 지정 path가 존재하지 않아도 삭제 파일일 수 있으므로 `git ls-files --deleted -- <path>`도 고려한다.
- 커밋 직전 `git diff --cached --name-status`와 `git status --short`를 출력한다.
- staged 변경이 0개면 커밋을 중단한다.

### 추가 edge case

- 빈 스테이징: `git diff --cached --quiet`이면 실패.
- detached HEAD: `git symbolic-ref --short HEAD` 실패 시 실패.
- unborn branch: 부트스트랩 `main --allow-main`은 허용, 그 외에는 실패.
- 기존 staged 변경: 기본 실패, `--include-staged` 같은 명시 옵션이 있을 때만 허용.
- 경로에 공백/한글: array args로 처리.
- pathspec injection: `--` 사용 필수.
- conventional message body 필요 시 `--body`를 별도 옵션으로 두고 제목 검증은 유지.
- pre-commit 실패 시 helper는 종료코드 1과 원문 출력 유지.

## 전문 브랜치 전략 권고

현재 팀 규모와 7일 일정에는 무거운 GitFlow보다 **lightweight GitFlow + TASK 브랜치**가 적합하다.

| 브랜치 | 역할 | 규칙 |
|---|---|---|
| `main` | 최종 안정 브랜치 | 이상혁 승인 + 독립검토 + 검증 로그 후에만 merge. 직접 작업 금지. 부트스트랩 첫 커밋 1회만 예외. |
| `develop` | 개발 통합/백업 브랜치 | 팀 작업이 모이는 통합 브랜치. 매일 또는 의미 있는 작업 후 backup point. 직접 장기 작업 금지. |
| `feature/TASK-YYYYMMDD-NNN-slug` | 기능 작업 | 제품 기능, 화면, API 단위. PR/검토 후 `develop`으로 merge. |
| `fix/TASK-YYYYMMDD-NNN-slug` | 결함 수정 | 검증 실패, 회귀, P0/P1 수정. |
| `chore/TASK-YYYYMMDD-NNN-slug` | 하네스·CI·설정 | tooling, .claude, 자동화, repo 설정. |
| `docs/TASK-YYYYMMDD-NNN-slug` | 산출물·문서 | 문서만 바꾸는 작업. |
| `release/demo-YYYYMMDD` 또는 `release/rc1` | 발표 후보 안정화 | 6/22 RC1, 6/25 동결 시점. fix만 받아 `main` merge 후보로 사용. |

팀원 이름은 브랜치명에 넣지 않는 것이 좋다. 담당자는 TASK와 PR 메타데이터에 기록하고, 브랜치는 작업 단위로 유지해야 충돌과 권한 검토가 쉽다.

추천 흐름:

1. 부트스트랩 첫 커밋: `main` 1회 허용.
2. 즉시 `develop` 생성.
3. 모든 작업은 `feature/`, `fix/`, `chore/`, `docs/`의 TASK 브랜치에서 시작.
4. TASK 완료 조건: 검증 명령 원문 + 독립검토서 + 사람 승인.
5. TASK 브랜치 → `develop` merge.
6. 발표 후보 시점에 `release/demo-YYYYMMDD` 생성.
7. 이상혁 승인 후 `release/*` 또는 `develop`에서 `main`으로 merge.

## 첫 부트스트랩 커밋 체크리스트 보완

DL-013의 체크리스트에 다음을 추가하는 것을 권고한다.

- `git status --short --branch` 원문을 사람에게 보여주고 승인받기.
- `node tooling/scripts/검증_전체.mjs` 원문 PASS 확인.
- `node tooling/scripts/검증_전체.mjs --strict` 실패가 제품 산출물 누락 때문임을 명시 승인.
- `node tooling/scripts/비밀값_스캔.mjs` 및 pre-commit 훅 경유 확인.
- `core.hooksPath=tooling/git-hooks` 확인.
- 원격 remote 없음 또는 remote 연결 별도 승인 확인.
- 첫 커밋 이후 `develop` 생성 여부 결정.
- 첫 커밋 후 REVIEW-006/007/008/009의 `reviewed_commit` 업데이트를 별도 TASK로 할지 결정.

## 실행 또는 확인한 명령

| 명령 | 종료코드 | 결과 |
|---|---:|---|
| `node tooling/scripts/검증_전체.mjs` | 0 | PASS — 하네스 기본 검증 |
| `node tooling/scripts/링크_검증.mjs` | 0 | PASS, Markdown 52개·내부 링크 51개 |
| `node tooling/scripts/팀공유문서_검증.mjs` | 0 | PASS |
| `git status --short --branch` | 0 | 아직 커밋 없음, README 포함 전체 미추적 |
| `git branch --list` | 0 | 출력 없음(unborn main 상태) |

## 남은 위험

- 현재 TASK-009는 Proposed 초안이라 구현 안정성은 아직 Unverified.
- README는 기본 검증 PASS와 strict 산출물 FAIL의 차이를 충분히 설명하지 않는다.
- 첫 커밋 전이라 모든 리뷰의 `reviewed_commit`은 아직 Not Available이다.
- 브랜치 전략이 아직 문서 정책으로 확정되지 않았다.
- `커밋.mjs` 강화 후에도 실제 커밋 경로는 별도 독립검토가 필요하다.

## 사람 승인 질문

- 브랜치 전략을 `main`/`develop`/TASK 브랜치/`release/demo-*` 구조로 확정할지?
- 첫 부트스트랩 커밋 후 즉시 `develop` 브랜치를 만들지?
- TASK-009에 `--path` 반복, 기존 staged 변경 차단, detached HEAD 차단, 빈 스테이징 차단을 수락 기준으로 추가할지?
- README의 “검증 PASS” 표현을 “하네스 기본 검증 PASS”로 좁힐지?

## 원문 출력 부록

### 1. `node tooling/scripts/검증_전체.mjs`

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
Markdown 52개, 내부 링크 51개 검사

결과: PASS

===== 작업지시서 (작업지시서_검증.mjs) =====
# 작업지시서 검증
검사 4개 (템플릿 제외)

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

### 2. `node tooling/scripts/링크_검증.mjs`

종료코드: 0

```text
# 링크 검증 (내부 상대 링크)
Markdown 52개, 내부 링크 51개 검사

결과: PASS
```

### 3. `node tooling/scripts/팀공유문서_검증.mjs`

종료코드: 0

```text
# 팀 공유 문서 검증
검사 대상: 6개 문서

결과: PASS
```
