---
status: Draft
owner: 김민혁
reviewers: [이상혁, 양록빈]
last_updated: 2026-06-21
related_requirements: [FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-009, FR-014, NFR-001, NFR-002]
related_adrs: [ADR-001]
---

# API 명세서 (REST)

> [ADR-001](아키텍처_의사결정기록/ADR-001_데이터베이스_Oracle.md) 기반 백엔드(Node+TS → Oracle). 위치: `apps/api`(§8 모듈러 모놀리스). **서버가 도메인 규칙(정원·중복·권한·상태 전이)을 강제**(NFR-002) — `apps/miniapp/src/domains/meetup` 순수 로직 이식·재사용.

## 공통
- **Base URL**: 예정(배포 후 확정).
- **인증**: 모든 변경 요청에 `X-User-Key: <user_key>` 헤더. `user_key`는 opaque — 현재 `getAnonymousKey` hash(DL-016), 추후 토스 로그인 userId로 **교체 가능**(API 계약 불변).
- **주최자 권한**: 서버가 `meetup.host_key == X-User-Key` 대조(클라이언트 신뢰 금지, NFR-001).
- **응답**: JSON. 오류 `{ "code": "...", "message": "..." }`.
- **오류 매핑(도메인 코드 → HTTP)**: `INVALID_INPUT`→400 · `NOT_HOST`/`FORBIDDEN`→403 · `NOT_FOUND`→404 · `DUPLICATE_APPLICATION`/`CAPACITY_EXCEEDED`/`INVALID_STATE`→409.
- **CORS**: 토스 WebView origin 허용.

## 엔드포인트
| Method | Path | 인증 | 설명 | FR |
|---|---|---|---|---|
| POST | `/meetups` | user | 모임 생성 | FR-003 |
| GET | `/meetups/by-code/{code}` | user | 초대 코드로 조회 | FR-004 |
| GET | `/meetups/mine` | user | 내 모임(만든·신청) | FR-014 |
| GET | `/meetups/{id}` | user | 상세(+참가자) | FR-004 |
| POST | `/meetups/{id}/participations` | user | 참가 신청 | FR-005 |
| POST | `/participations/{id}/approve` | host | 승인 | FR-006 |
| POST | `/participations/{id}/reject` | host | 거절 | FR-006 |
| POST | `/participations/{id}/cancel` | 본인 | 신청 취소 | FR-007 |
| POST | `/meetups/{id}/close` | host | 모집 마감 | FR-009 |
| POST | `/meetups/{id}/cancel` | host | 모임 취소 | FR-009 |
| GET | `/profile` | user | 내 프로필 | FR-002 |
| PUT | `/profile` | user | 프로필 저장(닉네임) | FR-002 |

## 주요 요청/응답
**POST /meetups**
```json
요청: { "title":"토요일 경찰과 도둑", "startAt":"2026-06-28T01:00:00Z", "area":"서울 강북",
        "capacity":8, "supplies":"운동화", "safetyRules":["차도 진입 금지","즉시 중단 신호"] }
201:  { "id":"...", "inviteCode":"ABC234", "status":"open", ... }
400 INVALID_INPUT(과거 일시·정원≤0·안전규칙 0·제목 없음)
```
**POST /meetups/{id}/participations**
```json
요청: { "nickname":"철수" }   → 201 { "id":"...", "status":"pending" }
409 DUPLICATE_APPLICATION(이미 활성 신청) · 409 INVALID_STATE(마감/취소)
```
**POST /participations/{id}/approve** → `200`; `403 NOT_HOST`; `409 CAPACITY_EXCEEDED`; `409 INVALID_STATE`(대기 아님)
**POST /participations/{id}/cancel** → `200`(정원 복구); `403 FORBIDDEN`(본인 아님)
**POST /meetups/{id}/close|cancel** → `200`; `403 NOT_HOST`; `409 INVALID_STATE`

## 서버 강제 (NFR-002)
- 승인: 트랜잭션 내 `approved 수 < capacity` 확인 후 갱신.
- 신청: 활성 신청 중복 확인.
- 상태 전이: open→closed/cancelled, pending→approved/rejected/cancelled만.
- 입력 검증·객체 단위 권한(NFR-001). 모든 시각 UTC.

## 미결정
- Base URL/배포, rate limit 정책, 페이지네이션(목록), idempotency 키. → 김민혁 확정.
