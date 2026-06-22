---
status: In Review
owner: 이상혁
reviewers: [곽소정, 김민혁, 양록빈]
last_updated: 2026-06-23
related_requirements: []
related_adrs: []
---

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

- date: 2026-06-21
- phase: 기획/리서치
- task_id: 제스처 스파이크
- tool: Claude Code
- role: 기술 검증(타당성)
- task: MediaPipe 핸드트래킹을 모바일 브라우저에서 검증(주제 전환 「하모니」 입력 방식)
- input_artifact: apps/miniapp/public/gesture-spike.html
- output_artifact: 커밋 923e545, 측정값 45/30fps
- automated_checks: 해당 없음(수동 측정)
- human_reviewer: 이상혁
- correction_made: 없음
- accepted/rejected: accepted(입력 방식으로 채택)
- reusable_asset: 스파이크 패턴(공식 검증 전 타당성 확인)

- date: 2026-06-21
- phase: 기획/거버넌스
- task_id: DL-016
- tool: Claude Code
- role: 정책 검토 보조
- task: 인증 결정(토스 로그인 제외·getAnonymousKey·사업자 미등록) 정리
- input_artifact: 앱인토스 공식문서, 산출물/02_정책준수/공식문서_근거목록.md(TASK-018)
- output_artifact: DL-016, 공식문서_근거목록 갱신
- automated_checks: 해당 없음
- human_reviewer: 이상혁(승인)
- correction_made: 계정 로그인 대신 getAnonymousKey+닉네임으로 식별 범위 축소
- accepted/rejected: accepted
- reusable_asset: 비게임·비사업자 미니앱 식별 결정 패턴

- date: 2026-06-22
- phase: 구현
- task_id: TASK-20260622-029, TASK-20260622-031
- tool: Claude Code (Opus)
- role: 주 구현
- task: 오디오 엔진(평균율 A4=440·보이싱·음색 2종·멜로디 폴리포니), 초기화면 홈 허브 라우팅
- input_artifact: DEBATE-20260622-013(4-AI 페르소나 토의), 피아노 음원 레퍼런스 리서치
- output_artifact: tuning.ts·engine.ts·chordReducer.ts·Studio.tsx·App.tsx·Home.tsx·Community.tsx, 평가증빙/에이전트_실행기록/AI실행_20260622_초기화면_오디오.md
- automated_checks: npm test 24/24 PASS, tsc --noEmit exit 0
- human_reviewer: 이상혁
- correction_made: 적대적 코드리뷰가 멜로디 폴리포니 HIGH 3건(clearMelody desync 등) 발견 → 수정
- accepted/rejected: accepted
- reusable_asset: 4-AI 설계 토의·적대적 코드리뷰 패턴
- 비고: 독립검토는 Codex 페르소나 대행(실제 다른 계열 Codex 아님)

- date: 2026-06-23
- phase: 구현/배포
- task_id: AWS 배포
- tool: Claude Code
- role: 구현·배포 절차 준비
- task: vitest 7파일 58개 정비, AWS EC2(nginx 정적+리버스프록시·systemd harmony-api:8080·Let's Encrypt) 배포 준비, develop 통합
- input_artifact: apps/miniapp, apps/api(node:http+node:sqlite 4엔드포인트)
- output_artifact: https://3.39.167.74.nip.io 운영, develop 최신 6372dc3
- automated_checks: vitest 58 PASS(chordReducer·poly·events·tuning·noteEdit·notes·loop), 통합 12/12(과거 스냅샷)
- human_reviewer: 이상혁(커밋 자동·푸시 사람 게이트)
- correction_made: 없음
- accepted/rejected: accepted
- reusable_asset: 무의존 백엔드(node:http+node:sqlite)·HTTPS 동일출처 배포 절차
```

## §19 필수 사례 충족 현황

- (2) Claude가 ChatGPT Pro/설계 제안의 과도한 범위를 좁힌 사례: DL-016에서 계정 로그인을 빼고 getAnonymousKey+닉네임으로 식별 범위 축소(공개 모집형→초대 코드형 carve-out, DL-002 연계). ✅
- (3·4) AI 간 교차검토로 결함/판정 차이 발견: TASK-006 Codex 감사 ↔ Claude 자가진단. ✅
- (5) 자동 검사가 위험을 차단: settings.json 자기권한 확대 차단, 비밀값 스캔 가동. ✅
- (6) 실제 팀원이 AI 제안을 거절·수정하고 이유를 남긴 사례: 이상혁이 README 포함/제외, 브랜치 전략, 문서 정리 범위, 인증 결정(DL-016)을 직접 결정·수정(사람검수_기록 참조). ✅
- (7) 동일 작업지시서·검토 계약으로 새 기능을 다시 처리한 사례: TASK-008→010→013→014를 같은 작업지시서·독립검토·합의 절차로 반복, 6/22 오디오·홈 허브 작업패킷도 같은 흐름으로 처리. ✅
- (1·8): 후속 작업패킷에서 축적 예정. (1) ChatGPT Pro의 누락 요구사항 발견 단독 사례, (8) 새 앱 재사용 실증.

## 추가 기록 (2026-06-20 후속)
- 사례 3·4 보강: Codex가 TASK-010 구현의 pathspec magic 취약(REVIEW-011 NO-GO)을 발견 → Claude 수정 → REVIEW-012 GO. AI 간 교차검토가 실제 보안결함을 차단.
- 사례 6 보강: 이상혁이 README 포함/제외, 브랜치 전략, 문서 정리 범위를 직접 결정·수정(사람검수_기록 참조).
- 파이프라인 재사용: 동일 작업지시서·독립검토·합의 절차로 TASK-008→010→013→014를 반복 처리(재사용성 입증).

## 추가 기록 (2026-06-21~23 후속)
- 주제 전환(DL-018 Proposed): 소모임 밋업 → 악기 합주 미니앱 「하모니」. 제스처 입력은 스파이크(923e545)로 모바일 브라우저 검증 후 채택했다.
- 4-AI 설계 토의: 6/22 오디오/홈 허브 설계를 ChatGPT-Pro·Gemini-Pro·Codex·Claude 페르소나 토의(DEBATE-20260622-013)로 진행했다. 단, 이 시점 독립검토는 Codex 페르소나 대행이며 다른 계열 실제 Codex 검토는 미실시다(AI실행_20260622 기록 참조).
- 적대적 코드리뷰가 차단한 결함: 멜로디 폴리포니 HIGH 3건(clearMelody desync 등)을 머지 전에 잡아 수정했다.
- 배포: develop 통합·푸시 완료(6372dc3), AWS EC2에 HTTPS 동일출처로 운영(https://3.39.167.74.nip.io). 커밋은 자동, 푸시는 사람 게이트.
- 한계: 실기기 멀티터치·실제 음색 청취·제품 통합테스트(EV-101 이후)는 사람 확인이 남았다.
