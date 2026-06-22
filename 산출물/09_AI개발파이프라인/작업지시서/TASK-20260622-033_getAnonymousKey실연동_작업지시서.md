---
id: TASK-20260622-033
status: Proposed
human_owner: 김민혁
human_approver: 이상혁
primary_agent: Claude Code
review_agent: Codex
related_requirements: [POL-001, POL-005, NFR-001]
related_screens: [SCR-00]
related_adrs: [DL-016, DL-018]
allowed_paths:
  - apps/miniapp/src/lib/identity.ts
  - apps/miniapp/src/routes/Onboarding.tsx
  - apps/miniapp/src/routes/Settings.tsx
  - 산출물/06_테스트/앱인토스_실기기검수표.md
  - 산출물/07_배포운영/배포_실행절차서.md
forbidden_paths:
  - apps/api/**
  - tooling/**
  - .claude/rules/**
---

# TASK-20260622-033 getAnonymousKey 실연동

## 배경과 문제

현재 `apps/miniapp/src/lib/identity.ts`는 DL-016 정책 방향(토스 로그인 제외, `getAnonymousKey` 익명 식별)을 문서화했지만 실제 구현은 localStorage 기반 mock fallback이다. 발표용 웹 미리보기는 동작하지만, 앱인토스 제출 후보에서는 실제 WebView SDK 호출을 확인해야 한다.

## 목표

- `@apps-in-toss/web-framework`의 비게임 `getAnonymousKey`를 사용자 식별의 1차 경로로 사용한다.
- SDK 호출 실패, 샌드박스/웹 미리보기, SDK 버전 미지원 상황에서는 기존 mock fallback으로 복구한다.
- 온보딩 버튼 busy 상태가 실패 후에도 풀리는지 확인한다.
- 설정 화면의 사용자 식별 설명이 실제 동작과 일치한다.

## 비목표

- 자체 로그인, 회원가입, 토스 로그인 추가.
- 서버 인증 토큰, 결제, 개인정보 수집 추가.
- `apps/api` 권한 모델 변경.

## 입력 근거

- [공식문서_근거목록](../../02_정책준수/공식문서_근거목록.md) #4 `getAnonymousKey`.
- [DL-016](../../00_프로젝트관리/의사결정_기록.md): 토스 로그인 제외 · 익명 식별키 채택.
- [배포 실행 절차서](../../07_배포운영/배포_실행절차서.md): 출시 전 필수 차단 해소.

## 수락 기준

- [ ] `identity.ts`가 실제 `getAnonymousKey` 호출을 시도하고, 성공 시 반환 hash를 localStorage에 저장한다.
- [ ] SDK 미존재/실패 시 mock fallback이 유지되며 사용자가 온보딩에서 막히지 않는다.
- [ ] 자체 로그인/회원가입 UI가 추가되지 않는다.
- [ ] `npm --prefix apps/miniapp test` PASS.
- [ ] `npm --prefix apps/miniapp run build:web` PASS.
- [ ] 실기기 또는 앱인토스 샌드박스에서 익명키 경로를 확인하고, [앱인토스_실기기검수표](../../06_테스트/앱인토스_실기기검수표.md)에 결과를 기록한다.

## 변경 허용 범위

- `apps/miniapp/src/lib/identity.ts`
- 온보딩/설정 화면의 설명·오류 복구 표시
- 관련 테스트·문서 증거

## 금지 범위

- 자체 계정/비밀번호/휴대폰 인증 추가.
- 백엔드 세션/트랙 API 스키마 변경.
- 비밀값, 사용자 개인정보, 실제 식별키 로그 저장.

## 예상 영향과 위험

- WebView 밖에서는 SDK가 없을 수 있으므로 fallback 경로가 필수다.
- `getAnonymousKey`는 클라이언트 식별키이며 서버 권한 증명이 아니다. 공유 코드 접근권한 보강은 별도 후속 TASK로 다룬다.

## 검증 명령

```bash
npm --prefix apps/miniapp test
npm --prefix apps/miniapp run build:web
node tooling/scripts/검증_전체.mjs
```

## 필요한 테스트 증거

- 단위 테스트/빌드 로그.
- 실기기 또는 앱인토스 샌드박스에서 온보딩 진입·재진입 캡처.
- 실패/fallback 경로가 버튼 busy 고착 없이 복구되는 증거.

## 롤백 또는 복구 방법

- `identity.ts`를 이전 localStorage fallback 구현으로 되돌린다.
- 출시 후보에는 롤백 전후 동작을 실기기검수표에 기록한다.

## 사람 승인 지점

- 앱인토스 콘솔 앱 등록 ID 확정 후 구현 착수.
- 실기기에서 익명키 경로 확인 후 이상혁 승인.
