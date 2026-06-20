# AI 도구 활용 기록

> CLAUDE.md §19 형식. 사실만 기록한다. 실행하지 않은 검증은 적지 않는다.

## 기록

```text
- date: 2026-06-20
- phase: 기획/거버넌스
- task_id: DL-006
- tool: Claude Code
- role: 오케스트레이션
- task: V4 3에이전트 패키지 설치(헌장·AGENTS·CHATGPT 지침·템플릿)
- input_artifact: 앱인토스_3에이전트_운영패키지_V4
- output_artifact: CLAUDE.md(V4), 산출물/09 템플릿
- automated_checks: 해당 없음
- human_reviewer: 이상혁(승인)
- correction_made: V1 미적용 결정
- accepted/rejected: accepted
- reusable_asset: CLAUDE.md·AGENTS.md·템플릿

- date: 2026-06-20
- phase: 검증
- task_id: TASK-20260620-006
- tool: Codex
- role: 독립 검증
- task: 하네스 감사(읽기 전용)
- input_artifact: CLAUDE.md §7~§9, 작업지시서 TASK-006
- output_artifact: REVIEW-20260620-006_하네스감사.md
- automated_checks: 세션_시작_컨텍스트·팀공유문서_검증 실행(종료코드 0)
- human_reviewer: 이상혁(검토 대기)
- correction_made: Claude 자가진단 C1~C6 전부 confirm, 판정 "불가"→합의 후 "조건부"
- accepted/rejected: accepted (DL-008)
- reusable_asset: 하네스 감사 작업지시서·독립검토서 패턴

- date: 2026-06-20
- phase: 거버넌스/보안
- task_id: 하네스 보강
- tool: Claude Code → 자동 분류기(가드)
- role: 구현 / 안전 차단
- task: .claude/settings.json 권한 allow 규칙 작성 시도
- input_artifact: 하네스 보강 요청
- output_artifact: 없음(차단됨)
- automated_checks: 권한 자동 분류기
- human_reviewer: 이상혁(결정 대기)
- correction_made: AI 자기권한 확대를 가드가 차단 → git-hook·CI로 강제 대체
- accepted/rejected: rejected(정상 차단)
- reusable_asset: "AI 자기수정 차단" 안전 사례(§19 필수 사례)

- date: 2026-06-20
- phase: 검증
- task_id: 하네스 보강
- tool: Claude Code
- role: 자동 검증
- task: 검증_전체 실행(팀문서·산출물·링크·작업지시서·비밀값)
- input_artifact: tooling/scripts/*
- output_artifact: 콘솔 로그(전체 PASS, 종료코드 0)
- automated_checks: 5종 검사
- human_reviewer: 양록빈(검토 대기)
- correction_made: 없음
- accepted/rejected: accepted
- reusable_asset: 검증 스크립트 세트
```

## §19 필수 사례 충족 현황

- (3·4) AI 간 교차검토로 결함/판정 차이 발견: TASK-006 Codex 감사 ↔ Claude 자가진단. ✅
- (5) 자동 검사가 위험을 차단: settings.json 자기권한 확대 차단, 비밀값 스캔 가동. ✅
- (1·2·6·7·8): 후속 작업패킷 진행 중 축적 예정.
