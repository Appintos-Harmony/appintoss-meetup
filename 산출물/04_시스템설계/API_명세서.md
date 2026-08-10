---
status: Draft
owner: 김민혁
reviewers: [양록빈]
last_updated: 2026-06-24
related_requirements: []
related_adrs: []
---

# 하모니 API 명세서

이 문서는 `apps/api/server.mjs`(커밋 기준 develop)를 직접 정독해 작성한 실제 엔드포인트 명세다.
README에 4개로 기록된 것과 달리 실제 구현은 그 이상이며(커뮤니티 보드·신고·코멘트·좋아요·숨김 포함), **코드가 진실의 기준**이다.
이 문서는 `산출물/01_서비스기획/요구사항_추적표.md`의 API 드리프트를 닫는 기준 문서다.

## 1. 기준과 범위

| 항목 | 값 | 근거 |
|---|---|---|
| 런타임 | Node.js 내장 모듈만 (`node:http`·`node:sqlite`·`node:crypto`), 외부 의존성 0 | `server.mjs:6-8` |
| 서버 바인드 | 기본 `127.0.0.1:8080` (nginx 리버스프록시만 접근). `HOST`·`PORT` 환경변수로 변경 | `server.mjs:432-433` |
| 저장소 | SQLite 파일 (`DB_PATH` 기본 `harmony.db`) | `server.mjs:11` |
| 인증 | **무인증**: `code`=접근권한, `author_key`=클라 자기신고 약한 소유권(데모 한정) | `server.mjs:5` |
| 식별 헤더 | `x-anon-key` (좋아요 여부 조회용 익명키). 본문 필드 `author_key`(소유권). 둘 다 클라가 보낸 값 | `server.mjs:133, 203-205` |
| 신고자 식별 | 서버 도출 IP (`author_key` 회전으로 위조 불가, Codex P0) | `server.mjs:310-311` |
| 파라미터 바인딩 | 모든 SQL은 `db.prepare(...).run/get/all(?)` 위치 바인딩. 문자열 인터폴레이션 없음 | `server.mjs` 전체 |

> Assumption: README가 명시한 "4개 엔드포인트"는 초기 친구공유 범위(`healthz`·`POST /sessions`·`GET /sessions/:code`·`POST /sessions/:code/tracks`)로 보이며, 커뮤니티 기능 추가 후 README가 갱신되지 않은 것으로 추정한다. 코드 기준 실제 엔드포인트는 아래 11개다.

## 2. 공통 규약

### 2.1 CORS / 응답 헤더 (`server.mjs:128-136`)

모든 응답은 `application/json; charset=utf-8`. CORS 헤더:

- `access-control-allow-origin: *` · **데모 한정**. production은 오리진 allowlist로 좁힐 것(사람 게이트, 코드 주석 명시)
- `access-control-allow-methods: GET,POST,OPTIONS`
- `access-control-allow-headers: content-type, x-anon-key`
- `OPTIONS` 프리플라이트는 항상 `204` 반환 (`server.mjs:190`)

### 2.2 본문 크기 / 레이트리밋 / 멱등 (데모 한정, 메모리)

| 항목 | 정책 | 근거 |
|---|---|---|
| 요청 본문 한도 | `Content-Length` 선검사 + 누적 1,000,000 bytes 초과 시 연결 즉시 종료 | `server.mjs:138-152` |
| 레이트리밋 버킷 | IP당 60초 슬라이딩 윈도. `author_key`가 아니라 **IP**로 버킷팅(키 회전 우회 차단) | `server.mjs:104-113` |
| 멱등 토큰 | `idempotencyToken`을 `author_key/IP`별로 스코프, 메모리 10분 보존 | `server.mjs:114-126, 244` |
| 메모리 정리 | 5분 주기로 만료 레이트버킷·멱등토큰 정리 (`.unref()`) | `server.mjs:117-126` |

### 2.3 공통 오류 응답

| 상태 | 본문 | 발생 조건 |
|---|---|---|
| 400 | `{ error: <메시지> }` | 검증 실패. 예외 catch-all도 400 반환 (`server.mjs:425-427`) |
| 404 | `{ error: 'not found' }` | 매칭되는 라우트 없음 (`server.mjs:424`) |
| 429 | `{ error: 'rate limited' }` | 레이트리밋 초과 |

### 2.4 입력 검증 규칙 (`server.mjs:47-89`)

| 규칙 | 내용 |
|---|---|
| `events` | 배열, ≤5000개. 각 원소: `tick`(0~1e7 유한수)·`phase`('on'\|'off')·`chord`(문자열 ≤40자). 위반 시 `invalid events` |
| `instrument` | null 허용 또는 `piano`·`guitar`·`bass`·`drum` 중 하나. 위반 시 `invalid instrument` |
| 텍스트 정화 (`cleanText`) | 제어문자 제거·공백 정규화·trim·길이 제한. 빈값→`reason: 'empty'`, URL·이메일·전화번호 포함→`reason: 'pii'` |
| 트랙 상한 | 세션당 `MAX_TRACKS = 16` |
| 자동 숨김 임계 | 서로 다른 신고자 `REPORT_HIDE_THRESHOLD = 3`명 누적 시 댓글 자동 숨김 |

코드 생성: 혼동 문자(`0/O/1/I`) 제외 32자 집합에서 6자리, 충돌 시 재생성 (`server.mjs:39-45, 283-284`).

## 3. 엔드포인트

### 3.1 GET /healthz (`server.mjs:193-195`)

- 인가: 없음
- 응답 200: `{ ok: true, time: <epoch ms> }`

### 3.2 GET /community (`server.mjs:198-236`)

커뮤니티 보드 목록. `published=1 AND hidden=0`, 최신순(`created_at DESC, code DESC`), events 제외 메타만.

요청 쿼리:

| 파라미터 | 기본/범위 | 설명 |
|---|---|---|
| `limit` | 20, 1~50로 clamp | 페이지 크기 |
| `beforeAt`·`beforeCode` | 선택(둘 다 있을 때만) | 커서: `(created_at, code)` 복합 키페이지네이션 |
| `x-anon-key`(헤더) 또는 `?me=` | 선택 | `liked` 계산용 익명키. 헤더 우선(쿼리·프록시 로그 노출 방지), ≤80자 |

응답 200: `{ items: [...] }`, 각 item:

```
code, name, author(없으면 '익명'),
trackCount, commentCount(hidden=0만), playCount,
forkCount(origin_code=이 code & published & 미숨김),
likeCount, liked(meKey 있을 때만 실제 값, 없으면 false),
originCode, originName, originAuthor, createdAt
```

> 바인딩: 커서 분기는 `WHERE ... (created_at < ? OR (created_at = ? AND code < ?)) ... LIMIT ?`로 위치 바인딩(`server.mjs:208-217`).

### 3.3 POST /sessions (`server.mjs:238-301`)

세션 생성. 비공개 친구공유(`published` 미설정) 또는 커뮤니티 게시(`published=1`).

요청 본문: `name, bpm, owner, events, instrument, style, published, author, author_key, origin_code, track_count, idempotencyToken`

처리 순서와 응답:

| 단계 | 조건 | 결과 |
|---|---|---|
| 멱등 히트 | `idempotencyToken` 재사용(주체 스코프) | 200 `{ code, idempotent: true }` |
| 레이트리밋 | IP당 분당 12건 초과(`pub:`) | 429 |
| events 검증 | `events`가 있고 `badEvents` | 400 `invalid events` |
| instrument 검증 | 위반 | 400 `invalid instrument` |
| 게시 필수 | `published`인데 events 없음 | 400 `published needs events` |
| 출처 검증 | `origin_code` 제공 시 실재 안 함 | 400 `invalid origin_code` |
| 이름 검증 | `published`면 `cleanText(name,40)` 실패 | 400 `invalid name` (+`reason`) |
| 콘텐츠 중복방지 | 게시 + origin 없음 + 실클라 키일 때 `(author_key, 첫트랙해시, track_count)` 동일 published·미숨김 존재 | 200 `{ code, deduped: true }` |
| 생성 | 위 통과 | 201 `{ code }` |

비고:
- 중복방지 키는 첫 트랙 해시(`firstTrackHash`=결정적 직렬화 후 sha1 16자) + `track_count`. 레이어 수가 다르면 다른 곡으로 취급(collapse 방지, `server.mjs:67-77, 273-282`)
- 세션 INSERT와 첫 트랙 INSERT는 `BEGIN`~`COMMIT` 트랜잭션, 실패 시 `ROLLBACK` (`server.mjs:286-298`)
- `node:sqlite` 동기 API로 SELECT~INSERT~COMMIT 사이 await 없음 → 원자적(레이스 없음, 코드 주석)

### 3.4 POST /sessions/:code/comments/:id/report (`server.mjs:304-320`)

댓글 신고. `(id AND code)` 동시 검증, 신고자당 1회(UNIQUE), 누적 3건 자동 숨김.

- 레이트리밋: IP당 분당 30건(`rpt:`) → 429
- 신고자 = 서버 도출 IP. 본문은 소비하되 `author_key`는 신고자 식별에 쓰지 않음
- 댓글 없음(`id`·`code` 불일치): 404 `comment not found`
- 성공: 200 `{ ok: true }`. `INSERT OR IGNORE`가 신규일 때만 distinct 신고자 카운트→`reports` 갱신, `>=3`이면 `hidden=1`

### 3.5 GET /sessions/:code/comments (`server.mjs:322-330`)

- 세션 없음/숨김: 404 `session not found`
- 200: `{ comments: [{ id, author('익명'), text, createdAt }] }`. `hidden=0`만, 최신순 최대 100

### 3.6 POST /sessions/:code/comments (`server.mjs:331-343`)

- 세션 없음/숨김: 404 (3.5와 동일 게이트)
- 레이트리밋: IP당 분당 20건(`cmt:`) → 429
- 본문: `text, author, author_key`. `cleanText(text,200)` 실패 시 400 `invalid text`(+`reason`)
- 멱등: 같은 `author_key`+`text` 60초 내 중복 → 200 `{ id, deduped: true }`
- 생성: 201 `{ id }`

### 3.7 POST /sessions/:code/tracks (`server.mjs:346-365`)

세션에 트랙 "얹기".

- 세션 없음/숨김: 404 `session not found`
- 트랙 16개 도달: 409 `too many tracks`
- 레이트리밋: IP당 분당 30건(`trk:`) → 429
- **인가(공개 세션)**: `published`이고 `author_key`가 `seed`이거나 없거나 요청 키와 불일치 → 403 `published sessions: only owner can add tracks; fork via origin_code`. 비공개 세션은 code=접근으로 협업 '얹기' 허용 (`server.mjs:355-359`, Codex P0)
- events/instrument 검증 실패: 400
- 성공: 201 `{ ok: true, trackId }`

### 3.8 POST /sessions/:code/like (`server.mjs:368-387`)

좋아요 토글. `anon_key`당 1회(UNIQUE), INSERT/DELETE 토글.

- 레이트리밋: IP당 분당 60건(`like:`) → 429
- 본문: `author_key`(없으면 IP를 키로)
- 세션 없음/숨김: 404 `session not found`
- 200: `{ liked, count }` (toggle 후 상태와 현재 총 좋아요 수)

### 3.9 POST /sessions/:code/hide (`server.mjs:390-402`)

작성자 본인 세션 숨김(best-effort).

- 본문: `author_key`
- 세션 없음: 404 `session not found`
- 시드곡: 403 `cannot hide seed`
- `author_key` 일치: 200 `{ ok: true }` (`hidden=1`)
- 불일치: 403 `not owner`

### 3.10 GET /sessions/:code (`server.mjs:404-422`)

세션 상세 + 트랙 전체.

- 세션 없음/숨김: 404 `session not found` (숨김 세션 공개 GET 차단, Codex MED)
- 조회 시 `play_count += 1` (`server.mjs:409`)
- 200 본문:

```
code, name, bpm,
tracks: [{ owner, events(JSON 파싱), instrument?, style?, createdAt }] (id 순),
likeCount,
originCode, originName, originAuthor(없으면 '익명')
```

## 4. 인가·공개여부 요약

| 엔드포인트 | 인가 기준 | 공개 GET 가능 |
|---|---|---|
| GET /healthz | 없음 | 예 |
| GET /community | 없음(`x-anon-key`는 liked 표시만) | published·미숨김만 노출 |
| POST /sessions | 없음(생성). dedup·origin은 `author_key`/실재 검증 | - |
| POST .../comments | 없음(레이트·정화). 숨김 세션 차단 | - |
| GET .../comments | 없음. 숨김 세션 차단 | 미숨김 댓글만 |
| POST .../comments/:id/report | 없음. 신고자=IP, 1인 1회 | - |
| POST .../tracks | 공개 세션은 **owner_key 일치자만**, 비공개는 code 보유자 | - |
| POST .../like | 없음(`anon_key` 토글). 숨김 세션 차단 | - |
| POST .../hide | **owner_key 일치자만**, 시드 불가 | - |
| GET /sessions/:code | 없음(code=접근). 숨김 차단 | 미숨김만 |

> Open Question: 현재 모델에 운영자/관리자 전용 인증 경로가 없다. 신고 누적 자동숨김 외 운영자 강제 숨김·복구 API는 미구현(코드에 없음). 운영 정책은 `DECISION-001`·`OQ-B`(프록시 뒤 공유 IP 신고 버킷 한계, `server.mjs:50-52`) 판정 대상이다.

## 5. 데이터 모델 참조

테이블 DDL은 `server.mjs:12-37`에 정의된다(`sessions`·`tracks`·`comments`·`comment_reports`·`reactions` + 멱등 ALTER 마이그레이션). 컬럼 상세·제약은 `산출물/04_시스템설계/테이블_정의서.md`를 기준 문서로 참조한다(여기서 복제하지 않음).

## 6. 미확정·검증 상태

| 항목 | 상태 | 근거 |
|---|---|---|
| 통합 34/34 성공 | 2026-06-25 재실행 · 커밋 `c13b818` | 입력 사실 |
| `getAnonymousKey`(클라 익명키) | 2트랙 배선 완료 · 토스 실호출 / 브라우저 폴백(머지 f506717). 정식 per-user 검증은 정식 출시·QR 진입 | 코드 반영 |
| CORS allowlist | 미구현(데모 `*`) · production 사람 게이트 | `server.mjs:131` |
| 운영자 강제 숨김 API | 미구현 | 코드 부재 |
