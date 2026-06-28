---
status: Draft
owner: 김민혁
reviewers: [이상혁]
last_updated: 2026-06-27
related_requirements: []
related_adrs: []
---

# 아키텍처 의사결정 기록 (ADR) 인덱스

이 폴더는 하모니(앱인토스 비게임 악기 합주 미니앱)의 **아키텍처 의사결정 기록**을 보존한다.
각 ADR은 하나의 결정에 대한 상태·맥락·결정·결과·대안을 담는다. 결정의 1차 근거는
[의사결정 기록](../../00_프로젝트관리/의사결정_기록.md)(DL-### 항목)이며, ADR은 그중
**아키텍처에 영향을 준 결정**만 시스템 설계 관점에서 풀어 쓴 것이다. 같은 내용을 복제하지 않고 DL 항목을 링크한다.

상태값(CLAUDE.md §11): `Proposed` · `Accepted` · `Superseded` · `Deprecated`.
여기 ADR은 모두 저장소의 실제 코드·배포·결정 기록을 근거로 작성했으며, 문서 메타데이터의 `status`는
문서 작성 상태(`Draft`)이고 본문 "상태" 절은 결정 자체의 상태다.

| ADR | 제목 | 결정 상태 | 근거 DL |
|---|---|---|---|
| [ADR-0001](ADR-0001_소모임_밋업에서_하모니_합주_미니앱으로_피벗.md) | 소모임 밋업에서 하모니 합주 미니앱으로 피벗 | Accepted | DL-018·DL-019·DL-022 |
| [ADR-0002](ADR-0002_토스_로그인_없이_익명_식별키로_사용자_식별.md) | 토스 로그인 없이 익명 식별키로 사용자 식별 | Accepted | DL-016 |
| [ADR-0003](ADR-0003_실시간_합주_대신_공유코드와_폴링_비동기_모델.md) | 실시간 합주 대신 공유코드 + 폴링 비동기 모델 | Accepted | DL-019·DL-022 |
| [ADR-0004](ADR-0004_API_서버를_node_http와_node_sqlite_무의존성으로_구성.md) | API 서버를 node:http + node:sqlite 무의존성으로 구성 | Accepted | DL-019·DL-021 |
| [ADR-0005](ADR-0005_API_기본_127001_바인드와_nginx_신뢰프록시_보안.md) | API 기본 127.0.0.1 바인드 + nginx 신뢰프록시 보안 | Accepted | DL-021·DL-022 |
| [ADR-0006](ADR-0006_Tonejs_샘플_우선_재생과_합성_폴백.md) | Tone.js 샘플 우선 재생 + 합성 폴백 | Accepted | DL-018·DL-022 |

## 비고

- `related_requirements`는 PRD의 FR/NFR/POL ID와 연결할 자리이지만, 본 ADR 작성 시점에 ID 매핑이
  추적표에서 ADR 단위로 확정되지 않아 비워 둔다(Assumption). 추적표 갱신 시 같은 변경에서 채운다.
- 익명키 `getAnonymousKey`는 2트랙 배선 완료(토스 실호출/브라우저 폴백, ADR-0002 참조)다. granite.config `appName`은
  `harmony`로, 토스 앱마켓 정식 등록·심사 제출 후 2026-06-26 테스트 트랙 출시(버전 20260626-1, SDK 2.9.2) → 2026-06-26 정식 전체공개(프로덕션) 출시 완료 상태와 일치한다
  (ADR-0001 작성 시점 임시값 `meetup-lite` 해소). 정식 환경 per-user 식별 검증은 권장 항목으로 남는다. ADR-0001/0002 본문은 작성 당시 사실을 보존한 역사 기록이다.
