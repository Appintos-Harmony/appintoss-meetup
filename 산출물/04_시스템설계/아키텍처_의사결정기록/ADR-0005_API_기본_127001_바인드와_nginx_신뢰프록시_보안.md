---
status: Draft
owner: 김민혁
reviewers: [이상혁]
last_updated: 2026-06-24
related_requirements: []
related_adrs: [ADR-0002, ADR-0004]
---

# ADR-0005 — API 기본 127.0.0.1 바인드 + nginx 신뢰프록시 보안

## 상태

Accepted. 근거: [DL-021](../../00_프로젝트관리/의사결정_기록.md#dl-021--하모니-백엔드-aws-배포-이상혁-승인-하-실행)(AWS 배포), [DL-022](../../00_프로젝트관리/의사결정_기록.md#dl-022--풀버전-복귀축소-mvp--곽소정-원안-전체--앱-도메인-서빙)(앱 도메인 서빙). 코드 주석상 Codex 검토 R039(127.0.0.1 바인드)·R040(Go) 반영.

## 맥락

API(ADR-0004)는 인증 없이 IP 기반 레이트리밋·신고 임계에 의존한다(ADR-0002). 따라서 클라이언트가 보낸
`X-Forwarded-For`/`X-Real-IP`를 그대로 신뢰하면 키 회전 없이도 IP를 위조해 레이트리밋·신고 버킷을 우회할 수 있다.
또한 8080 포트가 외부에 직접 노출되면 nginx를 우회한 위조 헤더 요청이 가능하다.

## 결정

1. **기본 바인드는 `127.0.0.1`**(server.mjs 432행 `HOST = process.env.HOST || '127.0.0.1'`).
   같은 호스트의 nginx 리버스프록시만 8080에 접근한다. 외부 직접 노출·헤더 spoof를 차단한다(server.mjs 430행, Codex R039).
   다른 토폴로지가 필요하면 `HOST`로 명시한다(예: `HOST=0.0.0.0`). production은 127.0.0.1 유지 권장.
2. **신뢰 프록시 모드는 명시적 옵트인**: `TRUST_PROXY=1`일 때만 프록시가 세팅한 `X-Real-IP`/단일 XFF 마지막 값을 신뢰한다
   (server.mjs 94~102행). 기본은 소켓 주소(`req.socket.remoteAddress`)만 사용해 클라가 XFF를 위조해도 우회 불가.
3. **nginx가 클라이언트 XFF를 덮어쓴다**: 클라가 보낸 `X-Forwarded-For`를 이어붙이지 않고 실제 TCP 피어(`$remote_addr`)로
   `X-Real-IP`·`X-Forwarded-For`를 설정한다(`apps/api/deploy/nginx-harmony-api.conf` 13~17행). → 앱은 위조 불가한 IP로 레이트리밋(Codex P0).
4. 한 도메인에서 미니앱 정적(`/opt/harmony-web`)과 API(`/healthz`·`/community`·`/sessions` → 127.0.0.1:8080)를 동시 서빙한다.
   TLS는 certbot(Let's Encrypt, 3.39.167.74.nip.io).

## 결과

- 라이브: https://3.39.167.74.nip.io healthz 200(systemd `harmony-api` + nginx + Let's Encrypt).
- 블랙박스 보안 점검 7/7(실측). IP 위조 기반 레이트리밋/신고 우회가 기본 구성에서 차단된다.
- 레이트리밋 버킷·신고 distinct 카운트가 서버 도출 IP 기준으로 동작(ADR-0002 연결).

### 한계 / Open Question

- **공유 IP 한계:** 프록시/NAT 뒤 공유 IP에서는 다른 사용자가 한 레이트/신고 버킷으로 묶일 수 있다
  (server.mjs 52행, OQ-B·DECISION-001 정책 판정 대상 — Open Question).
- **키 취급:** SSH pem/ppk는 저장소에 두지 않는다(DL-021). 키 로테이션 완료.
- **HTTPS 안정성:** 초기엔 cloudflared 터널(DL-021), 현재는 nip.io + Let's Encrypt. 도메인/터널 안정화는 후속.

## 대안

- **(a) 8080 직접 외부 노출 + 앱에서 XFF 신뢰:** 헤더 위조로 레이트리밋/신고 우회 가능 → 거부(Codex R039 No-Go 사유).
- **(b) 앱에서 무조건 XFF 신뢰:** 프록시 없는 환경에서 위조 가능. `TRUST_PROXY` 옵트인 + nginx 덮어쓰기로 한정.
- **(c) 애플리케이션 레벨 인증으로 IP 의존 제거:** 인증 없음 결정(ADR-0002)과 충돌. 데모 범위에선 IP 버킷팅으로 충분.
