---
status: Proposed
owner: 이상혁
reviewers: [김민혁, 곽소정]
last_updated: 2026-06-21
related_requirements: [NFR-002, NFR-001]
related_adrs: []
---

# ADR-001 — 데이터베이스: Oracle (학교 제공 Oracle Cloud)

## 상태
**Proposed** — Gate 1 설계. 결정자: 이상혁·김민혁(Backend).

## 컨텍스트
- 팀이 학교에서 **Oracle Cloud DB(추정: Enterprise Edition)** 를 대여해 사용할 예정.
- CLAUDE.md §13 기본값은 PostgreSQL이나, 학교가 Oracle을 제공하므로 변경 검토.
- 미니앱은 WebView에서 `fetch`로 외부 API 호출 가능(공식 네트워크 문서) → `미니앱 → 우리 API(Node) → Oracle` 구조 성립.

## 결정
1. **DBMS = Oracle Database** (학교 제공, Enterprise Edition 가정).
2. **드라이버 = `node-oracledb`** (공식, thin 모드면 Oracle Client 설치 불필요). ORM이 필요하면 TypeORM(Oracle 지원). **Prisma는 Oracle 정식 지원이 약해 미채택.**
3. **연결** = Oracle Wallet(mTLS, Autonomous DB) 또는 TNS/host:port(Enterprise). 접속 정보·wallet은 `.env`/시크릿 매니저로만 — **저장소에 미포함**(비밀값 훅 차단).
4. **API 서버** = Node.js + TypeScript 모듈러 모놀리스(§13). 호스팅은 Oracle Cloud Compute 또는 동급.
5. **인증 유연성** = API는 `X-User-Key`(opaque 사용자 식별자) 기반. 현재 값 = `getAnonymousKey` hash(비사업자, DL-016). **추후 사업자 등록 시 토스 로그인 userId로 교체 가능**(스키마·API 불변).

## 근거
- 학교 인프라 무료 제공 + 백엔드 담당(김민혁) 운용. 안정적 RDBMS·트랜잭션으로 정원·중복·상태 전이를 **서버에서 강제**(NFR-002).

## 대안과 기각
- **PostgreSQL**(§13 기본): 무난하나 학교가 Oracle 제공 → 미채택.
- **Supabase/Firebase**: 빠르나 외부 SaaS 의존·학교 인프라 미활용 → 미채택.
- **Prisma ORM**: Oracle 정식 지원 미흡 → node-oracledb/TypeORM 채택.

## 영향
- [테이블_정의서](../테이블_정의서.md)·[API_명세서](../API_명세서.md)를 Oracle 기준으로 작성(VARCHAR2/NUMBER/TIMESTAMP).
- CORS: 우리 API가 토스 WebView origin 허용 헤더 설정.
- 도메인 순수 로직(apps/miniapp domains/meetup)을 서버로 이식해 재사용.
- 보안: 접속정보 비밀 관리(NFR-001).

## 미결정
- Enterprise vs Autonomous 확정(학교 제공 형태), 호스팅 위치, 스키마명/계정. → 김민혁 확인 후 갱신.
