# Git 규칙 (CLAUDE.md §16)

- 한 커밋은 한 가지 의도. 메시지에 변경 이유가 드러나야 한다.
- 금지 메시지: `update`, `final`, `misc`, `fix stuff`. 검증 안 한 `all tests pass` 금지. 모델·도구 이름을 커밋 제목/작성자로 위장 금지.
- 커밋 예: `feat(meetup): validate capacity and safety rules` / `fix(participation): prevent duplicate applications` / `test(api): cover cancellation propagation`.
- 기본 브랜치(main) 직접 push 금지. 작업은 `feat/…`·`fix/…`·`chore/…` 브랜치.
- PR 필수: 작업 ID, 요구사항 ID, 주 구현 에이전트, 독립 검토 에이전트, 변경 이유, 테스트 결과, 위험, 스크린샷.
- **사람 승인 없이 commit·merge·tag·push·migration·production 배포 금지.**
- AI 사용 사실을 숨기지 않는다. 평가용 AI 증거는 `평가증빙`·`산출물/09_AI개발파이프라인`에 분리 보존.

## 커밋·푸시 자동화 정책 (DL-012)

- **커밋(commit) = 자동.** 행동이 Codex 검사·사람 승인을 통과하면 주 작업 에이전트가 conventional 메시지로 **자동 커밋**한다(별도 커밋 클릭 불필요). 단:
  - `feat/*`·`fix/*`·`chore/*` 등 feature 브랜치에서 한다. `main` 직접 커밋은 부트스트랩 1회 외 지양.
  - pre-commit 훅(비밀값 스캔)이 커밋을 차단할 수 있다.
  - 헬퍼: `node tooling/scripts/커밋.mjs --message "type(scope): 설명" --path <경로> …` (또는 `--all`). 옵션 `--body`·`--allow-main`(부트스트랩)·`--include-staged`. main 차단·detached/빈/기존 staged 차단·경로 안전(`git add -- ...`)·커밋 직전 `diff --cached --name-status`+`status --short` 출력 포함.
- **푸시(push) = 사람 허락 게이트.** 사람의 명시적 "허락"이 있어야 실행한다(허락 후 자동 실행 가능). `main` 직접 push는 pre-push 훅이 차단(PR 사용). 원격(remote) 연결도 별도 사람 승인.
- **권한:** 커밋 자동화를 위해 **사람이** `settings.json`에 `Bash(git add:*)`·`Bash(git commit:*)`를 allow, `Bash(git push:*)`를 ask로 둔다(권장안: [재사용 운영지침](../../산출물/09_AI개발파이프라인/재사용_운영지침.md)). AI는 자기 권한을 스스로 넓히지 않는다(자동 분류기 차단).

## 브랜치 전략 (DL-014)

가벼운 GitFlow + TASK 브랜치. 사람 이름 브랜치 금지(담당자는 TASK/PR 메타데이터에 기록).

| 브랜치 | 용도 | 분기 | 병합 |
|---|---|---|---|
| `main` | 출시·안정(항상 배포 가능) | — | release/develop → main(조건부) |
| `develop` | 개발 통합·백업 | main | feature/fix/chore/docs → develop |
| `feature/TASK-…-슬러그` | 기능 | develop | develop |
| `fix/TASK-…-슬러그` | 결함 수정 | develop | develop |
| `chore/TASK-…-슬러그` | 하네스·CI·설정 | develop | develop |
| `docs/TASK-…-슬러그` | 문서 | develop | develop |
| `release/demo-YYYYMMDD` (또는 `release/rc1`) | 발표 후보 안정화 | develop | main + develop |

흐름: `feature/fix → (독립검토) → develop → release/demo-… → main`

**main 병합 조건(3가지 모두 충족):** ① 이상혁(조장) 승인 ② `node tooling/scripts/검증_전체.mjs --strict` PASS(해당 단계) ③ 해당 변경의 독립검토서(REVIEW-…).

부트스트랩 첫 커밋 1회만 `main` 직접 허용(`커밋.mjs --allow-main`, 커밋 0개). 이후 `main` 직접 커밋·push 금지(pre-push 차단). 모든 작업은 작업 브랜치 → `develop`.
