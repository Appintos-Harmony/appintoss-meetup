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
- input_artifact: DEBATE-20260622-013(4-AI 실모델 토의: ChatGPT Pro·Gemini Pro·Codex·Claude), 피아노 음원 레퍼런스 리서치
- output_artifact: tuning.ts·engine.ts·chordReducer.ts·Studio.tsx·App.tsx·Home.tsx·Community.tsx, 평가증빙/에이전트_실행기록/AI실행_20260622_초기화면_오디오.md
- automated_checks: npm test 24/24 PASS, tsc --noEmit exit 0
- human_reviewer: 이상혁
- correction_made: 적대적 코드리뷰가 멜로디 폴리포니 HIGH 3건(clearMelody desync 등) 발견 → 수정
- accepted/rejected: accepted
- reusable_asset: 4-AI 설계 토의·적대적 코드리뷰 패턴
- 비고: REVIEW-032는 Codex 독립검토 정본으로 보강 완료.

- date: 2026-06-23
- phase: 구현/배포
- task_id: AWS 배포
- tool: Claude Code
- role: 구현·배포 절차 준비
- task: vitest 7파일 58개 정비, AWS EC2(nginx 정적+리버스프록시·systemd harmony-api:8080·Let's Encrypt) 배포 준비, develop 통합
- input_artifact: apps/miniapp, apps/api(node:http+node:sqlite 4엔드포인트)
- output_artifact: https://3.39.167.74.nip.io 운영, develop tip ebdad0a(마지막 feature 6372dc3 위 조장 docs 커밋), 작업 브랜치 review/fullstudio HEAD 219b6ac
- automated_checks: vitest 58 PASS(chordReducer·poly·events·tuning·noteEdit·notes·loop), 통합 34/34 성공(API 12·보안 7·클라 6·실기기 9, 2026-06-25 재실행·커밋 c13b818)
- human_reviewer: 이상혁(커밋 자동·푸시 사람 게이트)
- correction_made: 없음
- accepted/rejected: accepted
- reusable_asset: 무의존 백엔드(node:http+node:sqlite)·HTTPS 동일출처 배포 절차

- date: 2026-06-23
- phase: 구현/하네스
- task_id: TASK-20260623-010
- tool: Claude Code (Opus). 게이트는 tooling/scripts가 코드로 강제
- role: 주 구현(엔진·드라이버·테스트)
- task: 자율 엔지니어링 루프 구축 — 작업 선택·tsc/vitest 게이트·경로/보호구역/반복캡을 순수 Node로 강제(외부 API 0), AI 스테이지는 Claude Code 내장 /loop으로 구동(API 키 코드 없음)
- input_artifact: 워크플로 타당성 분석(12에이전트, Conditional YES), CLAUDE.md §7, rules/git.md DL-012
- output_artifact: tooling/scripts/{작업_인덱서,루프_가드,루프엔진_검증}.mjs·__tests__/루프엔진.test.mjs·커밋.mjs(--guard-task), .claude/commands/loop-engineer.md, 산출물/09…/{루프엔지니어링_설계, 독립검토서/REVIEW-20260623-035}, 평가증빙/루프실행_로그/2026-06-23_TASK-20260623-010.md
- automated_checks: node:test 16/16 PASS, 검증_전체 --code(tsc+vitest 58/58) PASS, pre-commit 비밀값 스캔 PASS
- independent_reviewer: Claude 적대적 워크플로(4렌즈, same-family 초안) → REVIEW-035: blocker 11건 실증. Codex 진짜 교차검토는 사람 구동 대기
- human_reviewer: 이상혁(머지·푸시 사람 게이트)
- correction_made: 자동 검증+독립검토가 오류 다수 차단 — ① 빌드 중 게이트가 2건(파서 CRLF/구형yaml, 가드 마커 자기참조) ② 독립검토가 blocker 11건(코드게이트 no-op·보호경로 누락·대소문자 우회·글롭 경계·forbidden 미강제·캡 우회 등) 실증 → 코드게이트 폐기(검증_전체 --code로 통합)·canonicalize·보호경로 확장·--guard-task 등으로 전부 조치·재검증
- accepted/rejected: accepted(커밋 a4be0aa), 머지 대기
- reusable_asset: 결정론 게이트 3종·loop-engineer 드라이버·node:test 무의존 테스트 패턴(새 프로젝트 복사 가능)
- date: 2026-06-23
- phase: 검증/구현 (2장비 리허설 피드백)
- task_id: TASK-20260623-009 (커뮤니티 리허설 수정)
- tool: Claude Code (Opus) + 멀티에이전트 자체회의(6에이전트 워크플로)
- role: 오케스트레이션 + 역할별 적대적 자체검증 + 구현
- task: 리허설 피드백 6건(재생바·중복방지·신고버그·신고정책) → 아키텍트 설계 초안 → 백엔드·QA·정책·레드팀 4역할 적대적 검토 → 수렴(타당 수용/부당 기각) → 구현·재테스트
- input_artifact: 리허설 사용자 피드백, 실DB 디핑(rehearsal.db sessions/tracks/reactions/comments)
- output_artifact: server.mjs·share.ts·Community.tsx·Studio.tsx 수정, 기능명세서 v4, DECISION-20260623-001
- automated_checks: tsc 0, vitest 58/58, 백엔드 회귀 11/11, FB2/FB6 9/9, 좋아요 8/8, build:web PASS
- human_reviewer: 이상혁(정책 결정 DECISION-001 대기), 푸시 사람 승인
- correction_made: 자체회의가 설계의 핵심 전제(중복 2건 콘텐츠 동일)를 실DB로 반증→whole-content 해시 기각·first-track 해시 채택. 파생 collapse 회귀(origin_code IS NULL 가드 누락)를 사전 차단. 키 회전 검열 벡터를 4역할 중 3역할이 일치 지적→결정요청서로 상신.
- accepted/rejected: accepted (정책 의존부는 사람 게이트 대기)
- reusable_asset: 멀티에이전트 자체회의 워크플로(설계→역할별 적대적 검증→수렴), 실DB 디핑으로 설계 전제 반증 패턴

- date: 2026-06-23
- phase: 검증/수정 (리허설 후속 변경 적대적 자체검증)
- task_id: TASK-20260623-009 (검증)
- tool: Claude Code (Opus) + 멀티에이전트 검증 워크플로(20 에이전트)
- role: 적대적 자체검증 + 수정
- task: 이번 세션 전체 변경(홈 연결·이름 지정·레이어 제거·로컬 저장·모니터 반복/진행바·dedup)을 5차원(상태·오디오·데이터·UX·레드팀) 검토 → 적대적 verify → 수렴
- input_artifact: 실파일(server.mjs·Studio.tsx·Community.tsx·share.ts·App.tsx·identity.ts)
- output_artifact: 15결함(전부 verify 통과) → 7건 수정(confirmReceive 신원·이름 소실·dedup track_count·모니터 타이밍·PII·멱등), 나머지 문서화(DECISION-001·minor)
- automated_checks: tsc 0, vitest 58/58, 백엔드 수정 스모크 7/7
- human_reviewer: 이상혁(정책 게이트), 푸시 사람 승인
- correction_made: 검증이 내 변경의 데이터 오염(이어하기→가져오기→저장 시 원곡 덮어씀)·멀티트랙 dedup collapse·모니터 stuck/드리프트를 잡아냄. 자기 변경을 다른 시각으로 적대 검증한 사례.
- accepted/rejected: accepted (7건 반영)
- reusable_asset: 자기 작업 적대적 재검증 워크플로(차원별 find→verify→수렴)

- date: 2026-06-23
- phase: 문서/발표 (전체 앱 가이드 산출)
- task_id: TASK-20260623-009 (가이드)
- tool: Claude Code (Opus) + 멀티에이전트 가이드 작성(4 에이전트)
- role: 산출물 생성 + 검수
- task: 커뮤니티 가이드를 템플릿으로 화면별 가이드(홈·스튜디오·설정·전체흐름) 병렬 초안 → 렌더 검수 → SVG+PNG(2x, resvg)
- input_artifact: 커뮤니티_도움말_가이드.svg(템플릿), 실제 화면(Home/Studio/Settings/App)
- output_artifact: 앱_가이드/00~04 SVG 5종 + PNG 5종 + 안내 문서
- automated_checks: SVG 적격성·PNG 렌더(이미지 직접 확인) 검수
- human_reviewer: 곽소정(디자인)·이상혁
- correction_made: 에이전트 초안을 렌더 확인으로 검수(이모지 일부 PNG 단순화 한계 기록)
- accepted/rejected: accepted
- reusable_asset: 가이드 템플릿 + 멀티에이전트 화면별 가이드 생성·resvg SVG→PNG 파이프라인
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
- 4-AI 설계 토의: 6/22 오디오/홈 허브 설계를 ChatGPT-Pro·Gemini-Pro·Codex·Claude 실모델 토의(DEBATE-20260622-013)로 진행했다 — Claude Code가 토의 프롬프트를 작성하면 사람이 각 모델에 입력해 제안·반박·통합을 받았다. 이후 REVIEW-032를 Codex 독립검토 정본으로 보강해 PR#1 Rework / PR#2 GO 판정을 확정했다(AI실행_20260622 기록 참조).
- 적대적 코드리뷰가 차단한 결함: 멜로디 폴리포니 HIGH 3건(clearMelody desync 등)을 머지 전에 잡아 수정했다.
- 배포: develop 통합·푸시 완료(마지막 feature 6372dc3, 그 위 조장 docs 커밋 ebdad0a가 develop tip), AWS EC2에 HTTPS 동일출처로 운영(https://3.39.167.74.nip.io). 커밋은 자동, 푸시는 사람 게이트.
- 한계: 실기기 멀티터치·실제 음색 청취·제품 통합테스트(EV-101 이후)는 사람 확인이 남았다.
- 멀티에이전트 자체회의(6/23): 2장비 리허설 피드백을 6에이전트 워크플로(설계→백엔드·QA·정책·레드팀 적대적 검토→수렴)로 처리. 사례 3·4 강화 — 자체검토가 설계의 틀린 전제를 **실DB 디핑으로 반증**(whole-content 해시→first-track 해시)하고, 파생 collapse 회귀를 사전 차단했다. 사례 5 강화 — 자동 스모크(회귀 11/11)가 dedup·신고 동작을 게이트했다. 정책 의존부(shadow moderation·키회전 검열)는 DECISION-20260623-001로 사람 판정에 상신해 AI 단정을 회피했다.
