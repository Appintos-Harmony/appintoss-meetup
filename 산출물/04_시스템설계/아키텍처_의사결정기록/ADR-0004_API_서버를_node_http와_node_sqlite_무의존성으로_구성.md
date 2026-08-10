---
status: Draft
owner: 김민혁
reviewers: [이상혁]
last_updated: 2026-06-24
related_requirements: []
related_adrs: [ADR-0003, ADR-0005]
---

# ADR-0004 · API 서버를 node:http + node:sqlite 무의존성으로 구성

## 상태

Accepted. 근거: [DL-019](../../00_프로젝트관리/의사결정_기록.md#dl-019--하모니-mvp-최종-스펙-4-ai-회의-라운드3)("AWS Ubuntu 26.04 + SQLite"), [DL-021](../../00_프로젝트관리/의사결정_기록.md#dl-021--하모니-백엔드-aws-배포-이상혁-승인-하-실행)(배포 실행).

## 맥락

합주 모델(ADR-0003)이 요구하는 백엔드는 세션 생성·조회·트랙 추가와 커뮤니티 보드·댓글·신고뿐이다.
스코프가 좁고, 일정(6/26 발표)과 단일 AWS Ubuntu 호스트 운영을 고려하면 프레임워크(Express 등)·ORM·외부 DB 드라이버의
설치·버전·취약점 관리 비용이 이득보다 크다. Node 24는 `node:sqlite`(내장 SQLite)를 제공한다.

## 결정

`apps/api`를 **Node 내장 모듈만**으로 구성한다(외부 의존성 0).

- HTTP 서버: `node:http`의 `createServer`(server.mjs 6행).
- 데이터베이스: `node:sqlite`의 `DatabaseSync`(server.mjs 7행), 파일 DB(`harmony.db` 또는 `DB_PATH`).
- 해시: `node:crypto`의 `createHash`(콘텐츠 중복방지 sha1 prefix, server.mjs 8·76행).
- 런타임: Node 24(실측 24.17, DL-021).

테이블(server.mjs 12~18행): `sessions` · `tracks` · `comments` · `comment_reports` · `reactions`.
스키마 변경은 멱등 `ALTER TABLE`(server.mjs `MIGRATIONS`, "없으면 추가, 있으면 무시")로 기존 DB와 호환한다.

## 결과

- 외부 패키지 0 → `npm install` 없이 `node server.mjs`로 기동, 공급망·취약점 표면 최소화.
- 라이브 검증: https://3.39.167.74.nip.io healthz 200(systemd `harmony-api` + nginx + Let's Encrypt, ADR-0005).
- 입력 검증을 서버에서 수행한다: `badEvents`(events 형식·길이), `okInstrument`(허용 악기), `cleanText`(UGC PII/링크 거부),
  `MAX_TRACKS`=16(server.mjs 49행).
- 멱등성: mutation은 메모리 멱등 토큰(`IDEMP`, server.mjs 115행)으로 중복 방지(데모 한정).

### 한계 / Open Question

- **데모 한정 인메모리 상태:** 레이트리밋(`RATE`)·멱등 토큰(`IDEMP`)은 프로세스 메모리라 재시작 시 사라진다(server.mjs 104·116행 주석 "데모 한정").
  영속이 필요하면 별도 설계 필요(Open Question).
- **인증 없음:** code=접근, author_key=자기신고(ADR-0002). 운영 등급 인가/RBAC는 범위 밖.
- **단일 프로세스:** 수평 확장 시 인메모리 상태·SQLite 파일 락이 제약. 현재 단일 호스트 데모 범위에서만 유효.

## 대안

- **(a) Express + PostgreSQL(CLAUDE.md §13 기본):** 표준이나 좁은 스코프 대비 설치·운영·취약점 관리 비용 과다. 일정상 무의존성 선택.
- **(b) 서버리스(Lambda 등):** 콜드스타트·SQLite 영속·운영 복잡도. 단일 AWS 호스트가 더 단순.
- **(c) better-sqlite3 등 외부 SQLite 드라이버:** 네이티브 빌드 의존. Node 24 내장 `node:sqlite`로 의존성 제거.
