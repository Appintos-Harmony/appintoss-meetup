---
status: In Review
owner: 이상혁
reviewers: [Codex]
last_updated: 2026-06-23
related_requirements: []
related_adrs: []
---

# Codex 교차검토 라운드2 — REVIEW-036 발견 수정 재검증

> 사람이 Codex에 이 파일을 그대로 입력해 구동한다. 라운드1([REVIEW-036](REVIEW-20260623-036_Codex_루프엔지니어링검토.md))은 판정 **No-Go**로 신규 취약 6건을 실증했다. 그 6건을 커밋 `7f11347`에서 수정했다. 라운드2의 목표는 **수정이 실제로 닫혔는지 + 수정이 새 회귀/우회를 만들지 않았는지**를 독립 재검증하는 것이다.

## 검토 대상
- 브랜치: `develop` (수정 반영 후 HEAD), 핵심 변경 커밋 `7f11347`
- 변경 파일: `tooling/scripts/작업_인덱서.mjs`(보호경로 dir/file 분리·pathSafety raw 거부·canonicalize 콜론), `tooling/scripts/루프_가드.mjs`(withinAllowed isForbidden 우선·changedPaths -uall·preflight activeTask 락), `__tests__/루프엔진.test.mjs`
- 환경: Windows 11 + Node 24
- **REVIEW-036·수정 코멘트를 신뢰하지 말고 직접 실행해 종료코드·출력으로 확인하라.**

## A. 라운드1 발견 6건 — 닫혔는지 재현 (모두 PASS 기대)

| ID | 재현 명령 | 안전 기대(수정 후) |
|---|---|---|
| A5·B8 | `node -e "import('./tooling/scripts/작업_인덱서.mjs').then(m=>{for(const a of [['../etc'],['/etc/passwd'],['C:/repo/x'],['산출물/../../.claude/x'],['apps/miniapp/**']]){const r=m.pathSafety({allowed_paths:a});console.log(JSON.stringify(a),'safe='+r.safe)}})"` | `../etc`·`/etc/passwd`·`C:/repo/x`·`산출물/../../.claude/x` 전부 `safe=false`(절대경로/traversal 거부), `apps/miniapp/**`만 `safe=true` |
| D1 | `node -e "import('./tooling/scripts/루프_가드.mjs').then(m=>{const c=['tooling/scripts/루프_가드.mjs','.claude/settings.json','.gitignore'];const bad=c.filter(p=>m.withinAllowed(p,['tooling/**','.claude/**','.gitignore'])===true);console.log(bad.length?'LEAK:'+bad:'OK all false')})"` | `OK all false` — withinAllowed가 보호경로에 false |
| X6 | 깨끗한 temp worktree에서 untracked `packages/x.ts`·`infra/y.ts` 생성 후 `node -e "import('./tooling/scripts/루프_가드.mjs').then(m=>console.log(JSON.stringify(m.diffGuard({id:'P',allowed_paths:['packages/**','infra/**'],forbidden_paths:[]},{staged:false}))))"` | `ok:false` + `자동 게이트 없는 코드 경로` 위반(파일 단위로 펼쳐짐). unstaged 디렉터리도 차단 |
| X8 | `node tooling/scripts/루프_가드.mjs --reset; node tooling/scripts/루프_가드.mjs --preflight --task TASK-20260622-030; node tooling/scripts/루프_가드.mjs --preflight --task TASK-20260623-001; echo $?` | 두번째 preflight `STOP: 다른 활성 작업 ... 진행 중`, exit 10. 끝에 `--reset` |
| X9 | `node -e "import('./tooling/scripts/작업_인덱서.mjs').then(m=>console.log(m.canonicalize('CLAUDE.md:ads'), m.isUnderProtected('CLAUDE.md:codexprobe')))"` | `claude.md true` — 콜론 별칭 제거 후 보호 |

## B. 수정이 만든 새 회귀/우회 (없어야 PASS)

1. **dir/file 분리가 정당한 넓은 글롭을 깨지 않는가:** `pathSafety({allowed_paths:['평가증빙/**']}).safe===true`, `['산출물/06_테스트/**'].safe===true`, `['평가증빙/루프실행_로그/*.md'].safe===true`. (CLAUDE.md 같은 파일보호는 자신만 차단, 루트 다른 파일은 허용)
2. **withinAllowed isForbidden 우선이 정상 경로를 막지 않는가:** `withinAllowed('apps/miniapp/src/x.ts',['apps/miniapp/src/**'])===true`.
3. **changedPaths -uall이 성능·출력 형식을 깨지 않는가:** 일반 변경에서 리네임/삭제 파싱(REVIEW-036 E3) 여전히 정상인지.
4. **preflight activeTask 락이 정상 단일 루프를 막지 않는가:** 같은 작업 재-preflight는 통과, `--reset` 후 다른 작업 통과.
5. **canonicalize 콜론 제거가 정상 경로를 손상하지 않는가:** 콜론 없는 경로는 그대로(`canonicalize('apps/miniapp/src/x.ts')==='apps/miniapp/src/x.ts'`).

## C. 잔여 위험 재평가 (코드로 못 막는 항목 — 판정에 반영)

- **X4·X5 (구조적):** `git commit --no-verify`·`core.hooksPath` 훅 우회는 로컬로 못 막음. 완화는 ① 루프가 `커밋.mjs --guard-task`만 사용(드라이버 계약) ② **GitHub branch protection(서버측)**. Codex는 이 완화가 무인 cron에 충분한지 의견을 달라.
- **X7:** `_상태.json`을 pathSafety로 막으면 `평가증빙/**`가 over-reject되어, gitignore(커밋불가)+iteration() 캡 재클램프로만 완화했다. Codex는 캡 재클램프가 max 변조를 실제로 무력화하는지(`_상태.json`에 max:999 직접 주입 후 `--iteration` → max 20 클램프) 재확인하라.

## D. 전체 회귀
```
node tooling/scripts/루프엔진_검증.mjs        (22/22 기대)
node tooling/scripts/검증_전체.mjs --code      (vitest 58/58 기대)
```

## E. 반환
- `독립검토서/REVIEW-20260623-NNN_Codex_루프엔지니어링검토_라운드2.md`
- 판정: **Go / Conditional Go / No-Go** + A·B 표(프로브·기대 vs 실제·PASS/FAIL) + C 잔여 의견 + 재현 명령·종료코드
- 읽기·검토 전용. 게이트 스크립트 수정 금지(발견은 diff 제안만). 모든 프로브 자기리셋, 끝에 `git status --short` 동일 확인.
