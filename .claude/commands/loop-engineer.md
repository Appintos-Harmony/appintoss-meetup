---
description: 자율 엔지니어링 루프 한 바퀴 — Ready 작업 1건을 안전 게이트 안에서 구현·검증·커밋하고 AI Review에서 사람 대기
argument-hint: "[--task TASK-…] [--max N]"
---

# 루프 엔지니어링 (1 iteration)

너는 이 저장소의 자율 엔지니어링 루프다. **한 번 호출 = 한 작업(iteration)**을 처리한다.
모든 안전 게이트는 프롬프트 재량이 아니라 **코드(tooling/scripts)** 로 강제한다. 게이트가 STOP/FAIL이면 즉시 멈추고 보고한다.

## 비협상 규칙 (위반 시 즉시 STOP·보고)
- **푸시·머지·태그·배포·migration 금지.** 커밋까지만. 그 이상은 사람 게이트.
- **정직성:** 실행 안 한 검증은 `Not Run`, 미확인은 `Unverified`. 테스트/검증 결과를 지어내지 않는다. 게이트 원문 출력을 로그에 첨부한다.
- **범위:** 작업의 `allowed_paths` 밖, 보호 경로(`.claude/settings.json`·`tooling/git-hooks`·헌장·`HUMAN_APPROVAL` 구역)는 절대 수정하지 않는다.
- **자기 권한·게이트 확장 금지:** settings.json·훅·이 커맨드·가드 스크립트를 루프가 고치지 않는다.
- 게이트 FAIL이면 **커밋하지 않는다.** 변경을 되돌리고(revert) 보고한다.

## 스테이지 (순서대로, 각 단계 실패 시 STOP)

### 0. ITERATION — 반복 캡 확인
```
node tooling/scripts/루프_가드.mjs --iteration $ARGUMENTS
```
종료코드 12(캡 도달)면 더 진행하지 말고 "캡 도달"로 보고·종료. 사람이 `--reset` 해야 재개.

### 1. SELECT — 다음 작업 선택
`--task`가 주어지면 그 작업, 아니면:
```
node tooling/scripts/작업_인덱서.mjs --next
```
종료코드 3(후보 없음)이면 "처리할 Ready 작업 없음"으로 보고·종료. 선택한 `id`와 `allowed_paths`를 기억한다.
- 선택 작업이 사람 전용(실기기 검수 등 AI가 실행 불가)으로 보이면 건드리지 말고 `--skip <id>`로 다음 후보를 본다.

### 2. PREFLIGHT — 안전 점검
```
node tooling/scripts/루프_가드.mjs --preflight --task <id>
```
STOP(10)이면 사유 그대로 보고·종료(브랜치가 main·detached·경로안전 위반 등).

### 3. CLAIM — 작업 브랜치
이미 작업 브랜치면 그대로. 아니면 `<type>/<id>-슬러그`로 브랜치 생성(예: `feat/TASK-…-슬러그`). main 직접 작업 금지.

### 4. IMPLEMENT — 구현
작업지시서의 수락 기준을 읽고 **`allowed_paths` 안에서만** 구현한다. 작업 유형에 맞는 스킬(`implement-vertical-slice` 등)을 사용한다.
가정·미확정은 명시한다. 범위를 임의로 넓히지 않는다.

### 5. VERIFY — 단일 AND 게이트(코드로 강제, 항상 실행)
문서·링크·비밀값 + 타입체크 + 단위테스트를 한 번에:
```
node tooling/scripts/검증_전체.mjs --code
```
`--code`가 apps/miniapp `tsc --noEmit` + `vitest run`을 hardFail로 포함한다(`코드검증.mjs` — 변경과 무관하게 **항상 실행**, 빈 staging no-op 없음).
- FAIL이면 → **6. REPAIR**. PASS여야 다음.
- apps/api·packages·infra 변경이 있으면 자동 게이트가 없으므로 7의 check-diff가 STOP(사람 검증).

### 6. REPAIR — 복구(최대 1~2회)
FAIL 원인이 `allowed_paths` 안에서 고칠 수 있으면 고치고 5로 돌아간다.
2회 안에 green이 안 되거나 원인이 범위 밖이면 → 변경 revert, status `Rework`/`Blocked` 사유 기록, STOP·보고.

### 7. CHECK-DIFF — 변경 범위 확인(커밋 전 사전 점검)
```
node tooling/scripts/루프_가드.mjs --check-diff --task <id>
```
STOP(11)이면(범위 밖·forbidden_paths·보호구역·무게이트 코드) 해당 변경을 되돌리고 STOP·보고. **커밋하지 않는다.**

### 8. COMMIT — green일 때만(커밋 경계를 코드로 재강제)
커밋할 경로를 `--path`로 명시한다. `커밋.mjs`가 스테이징 후 **그 집합**에 diffGuard를 다시 돌려, 위반 시 자동 unstage·중단한다(검사=커밋 대상, TOCTOU 차단·LLM 준수 비의존):
```
node tooling/scripts/커밋.mjs --guard-task <id> --path <경로> [--path <경로> …] --message "<type>(<scope>): <설명>"
```
`--all`·`--allow-main`·push 금지. pre-commit 비밀값 훅 차단 시 `--no-verify` 절대 금지·STOP.

### 9. REVIEW — 독립검토 초안
`verify-change` 스킬로 diff·게이트 증거를 검토하고 `산출물/09_AI개발파이프라인/독립검토서/REVIEW-…`를 작성한다.
**독립성 한계 명시:** 같은 세션/모델 초안이면 `independence: same-family-draft`로 표기한다. 진짜 교차검토(Codex)는 사람이 별도 구동한다. 깨끗한 Accept로 게이트를 닫지 않는다.

### 10. REPORT + STOP — 로그·정지
`평가증빙/루프실행_로그/<YYYY-MM-DD>_<id>.md`에 §7.3 결과계약 형식으로 기록한다(작업ID·상태·변경파일·실행명령·**게이트 원문 결과**·실패/생략 검증·남은 위험·사람 확인 항목·커밋 SHA).
작업 status를 `AI Review`로 두고 **사람 대기**. 다음 사람 작업(머지·푸시·진짜 교차검토)을 명시한다. 루프는 여기서 끝난다.

## 출력 형식
각 스테이지의 명령과 **실제 종료코드·요약**을 보고한다. 멈췄으면 어느 스테이지에서 왜 멈췄는지 한 줄로. 마지막에 한 줄 결론(완료 커밋 SHA / 또는 STOP 사유).
