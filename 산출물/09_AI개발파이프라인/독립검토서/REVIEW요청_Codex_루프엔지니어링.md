---
status: Open
owner: 이상혁
reviewers: [Codex]
last_updated: 2026-06-23
related_requirements: []
related_adrs: []
---

# Codex 교차검토 요청 — 루프 엔지니어링 (TASK-010)

> 사람이 Codex에 **이 파일을 그대로** 입력해 구동한다. 헌장 §6.1.3·§7.4의 "다른 계열 독립 검토"는 Codex가 수행해야 닫힌다.
> Claude 워크플로 검토([REVIEW-035](REVIEW-20260623-035_루프엔지니어링_검토.md))는 same-family 초안이라 게이트를 닫지 못한다. **REVIEW-035를 신뢰하지 말고 독립적으로 재검증**할 것.

## 검토 대상
- 브랜치: `develop` (또는 `chore/TASK-20260623-011-cron-readiness`)
- 커밋 범위: `95e28f3..HEAD` (루프 3커밋 + cron-readiness). 핵심 diff: `git show 95e28f3 da81162 8ac187c`
- 파일:
  - `tooling/scripts/작업_인덱서.mjs` (canonicalize·pathSafety·selectNext·파서)
  - `tooling/scripts/루프_가드.mjs` (isForbidden·withinAllowed·diffGuard·touchesHumanApproval·반복캡·preCommit)
  - `tooling/scripts/커밋.mjs` (--guard-task)
  - `tooling/scripts/코드검증.mjs` + `검증_전체.mjs --code` (코드 게이트)
  - `.claude/commands/loop-engineer.md` (드라이버 계약)
  - `tooling/git-hooks/pre-commit` (B2 백스톱)

## 배경(이미 발견·조치된 것 — 재검증 대상)
1차 빌드(a4be0aa)에서 Claude 적대적 워크플로가 blocker 11건 실증 → 전부 조치(REVIEW-035). 핵심 수정:
- 중복 코드게이트 폐기 → `검증_전체 --code`(항상 실행).
- 공유 `canonicalize()`(대소문자·`..`·역슬래시) — Windows 대소문자 우회 차단.
- `PROTECTED_PATHS`에 `tooling`·`.claude` 등 디렉터리 전체.
- `withinAllowed` 세그먼트 경계, `forbidden_paths` 강제, `touchesHumanApproval`(HEAD+신규+END), 단조 반복캡.
- `커밋.mjs --guard-task` + pre-commit 백스톱(activeTask 활성 시 모든 커밋 강제).

## Codex가 확인할 것 (독립적으로)
1. **게이트 우회 재시도**: 위 수정이 진짜 닫혔는지 직접 익스플로잇. 특히:
   - `canonicalize`/`globToRegExp`에 남은 우회(유니코드 NFD, `%`·인코딩, 심볼릭링크, 윈도 8.3 단축명, trailing dot/space).
   - `withinAllowed`/`pathSafety`의 새 경계 로직에 회귀(과허용 또는 과차단).
   - `diffGuard`의 rename/삭제/모드변경 처리(`git status --porcelain` 파싱).
2. **pre-commit 백스톱 우회**: `git commit --no-verify`, `core.hooksPath` 변경, `activeTask` 미설정 경로, 환경에서 훅 미실행(예: GUI). 백스톱이 의존하는 가정이 깨지는 경우.
3. **커밋 경계(--guard-task)**: `--all`·`--include-staged`·pre-staged와 조합 시 우회 가능 여부.
4. **반복 캡 단조성**: `_상태.json` 직접 편집·동시 실행·`--reset` 오남용으로 폭주 가능 여부.
5. **정직성**: 드라이버가 게이트 미실행을 PASS로 보고할 여지, 로그 위조 여지.
6. **재현**: `node tooling/scripts/루프엔진_검증.mjs`(16/16) · `node tooling/scripts/검증_전체.mjs --code`(vitest 58/58) 직접 실행해 결과 일치 확인.

## 반환 형식 (REVIEW-YYYYMMDD-NNN)
판정(Accept/Conditions/Rework/Reject) · 발견사항 표(심각도·근거·재현·조치) · 재현한 명령·결과 · 남은 위험. `독립검토서/REVIEW-…_Codex_루프엔지니어링검토.md`로 저장.

## 충돌 방지
Codex는 **읽기·검토만**. 코드 수정은 작업지시서 없이 하지 않는다(발견은 보고). 같은 파일 동시 쓰기 금지.
