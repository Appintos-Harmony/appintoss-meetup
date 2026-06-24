---
name: code-review
description: 변경 diff의 정확성(버그)과 재사용·단순화·효율을 .claude/rules/code.md 기준으로 검토하고 코드 게이트를 실행할 때 사용한다.
---

코드 리뷰는 정확성 결함과 정리 기회를 함께 본다. 보안 전담 점검은 `security-review`, 독립검토서(REVIEW-…) 산출은 `verify-change`를 쓴다.

1. 대상 diff와 관련 작업지시서·수락 기준을 읽는다.
2. 코드 게이트 실행: `node tooling/scripts/코드검증.mjs`(apps/miniapp `tsc --noEmit` + `vitest run`). 못 돌리면 `Not Run`.
3. 정확성: 경계·널·경쟁 조건·무시된 Promise·빈 catch·오류 처리, 도메인 불변식(정원·중복·상태 전이) 위반.
4. 규칙(`rules/code.md`): `any`·무분별 type assertion 금지, 도메인 규칙의 UI 분산 금지, 날짜·표시 타임존 명시, mutation 멱등/중복 방지.
5. 정리: 중복 로직 재사용, 불필요한 복잡도·죽은 코드, 효율(번들·반복). 고신뢰 항목만 — 추측성 지적 금지.
6. 발견을 P0~P3로 분류하고 file:line 근거를 남긴다. 직접 수정은 요청 시에만(수정 후 게이트 재실행).
