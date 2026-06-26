---
status: In Review
owner: 이상혁
reviewers: [Codex]
last_updated: 2026-06-23
related_requirements: []
related_adrs: []
---

# Codex 교차검토 라운드2 — TASK-009 보안 수정 재검증

> 사람이 Codex에 이 파일을 그대로 입력해 구동한다. 라운드1([REVIEW-038](../REVIEW-20260623-038_Codex_009검토.md))은 **No-Go**로 P0 3건 + MED 4건을 실증했다. 그 7건을 커밋 `72cdfbf`(브랜치 `fix/TASK-20260623-009-security`)에서 수정했다. 라운드2 목표: **수정이 실제로 닫혔는지 + 정상 플로우를 깨지 않았는지 + 새 우회가 없는지**를 독립 재검증한다. 수정 코멘트를 신뢰하지 말고 직접 실행해 확인하라.

## 검토 대상
- 브랜치: `fix/TASK-20260623-009-security`, 기반 `702f201`, 수정 커밋 `72cdfbf`
- 파일: `apps/api/server.mjs`, `apps/api/deploy/{nginx-harmony-api.conf, harmony-api.service}`, `apps/miniapp/src/lib/share.ts`, `apps/miniapp/src/routes/{Studio,Community}.tsx`, `apps/api/_blackbox_security.mjs`(블랙박스 회귀)
- 환경: Windows 11 + Node 24

## A. 라운드1 7건 — 닫혔는지 재현 (모두 PASS 기대)
블랙박스로 빠르게: 임시 DB로 서버 2개(A=8091 TRUST_PROXY 미설정·B=8092) 띄운 뒤
```
cd apps/api
( PORT=8091 DB_PATH=bb_a.db node server.mjs & ) ; ( PORT=8092 DB_PATH=bb_b.db node server.mjs & )
node _blackbox_security.mjs    # 7 PASS / 0 FAIL 기대
```
개별 기대:
| ID | 검증 | 안전 기대 |
|---|---|---|
| P0-1 | 공개 세션에 attacker author_key로 `/tracks` | **403**(소유자 아님). owner key는 201 |
| P0-2 | 같은 IP에서 author_key 3개 회전 신고 | 댓글 **안 숨김**(visible=1). 서버 IP 기준 1신고자 |
| P0-3 | 회전 X-Forwarded-For 13회 POST(TRUST_PROXY 미설정) | **429 발생**(소켓주소 단일 버킷). 13/13 성공 아님 |
| MED | victim 토큰을 attacker가 재사용 | victim code **반환 안 됨**(author_key별 스코프) |
| MED | hidden 세션 direct `GET /sessions/:code` | **404**(comment/like도 404) |
| MED | `/community` me를 `x-anon-key` 헤더로 | liked 반영, URL 쿼리에 키 미노출 |

## B. 수정이 만든 회귀 (없어야 PASS — 정상 플로우 보존)
1. **공개 멀티트랙 publish**: owner가 `publishSession`(첫 트랙) → 같은 author_key로 `addTrack`(나머지) → 모두 201, trackCount 정상 증가. (Studio/Community 모두 addTrack에 key 전달했는지)
2. **비공개 친구공유 '얹기'**: published=0 세션은 author_key 없이도 `/tracks` 협업 추가가 여전히 동작(403 아님).
3. **정상 신고**: 서로 다른 IP 3곳(또는 TRUST_PROXY로 다른 X-Real-IP)에서 신고 시 임계 도달해 숨김은 여전히 동작(과잉 차단 아님).
4. **fork 흐름**: 공개 곡 GET → 새 `/sessions` + origin_code publish 정상(파생은 dedup 우회).
5. **정상 멱등**: 같은 author_key + 같은 토큰 재시도는 같은 code 멱등 반환(연타 중복 방지 유지).
6. **dedup**: 같은 author_key·같은 첫트랙·같은 track_count 재게시는 기존 code 반환(기존 동작 유지).

## C. 배포 설정 정합성 (런타임 XFF 방어 — Codex 코드 리뷰)
- `clientIp`: `TRUST_PROXY=1`일 때만 `X-Real-IP`(없으면 XFF 마지막)를 신뢰, 아니면 소켓주소. nginx는 클라 XFF를 무시하고 `X-Real-IP/X-Forwarded-For = $remote_addr`로 덮어씀. systemd는 `TRUST_PROXY=1`.
- **확인 요청**: ① 셋의 일관성(앱이 신뢰하는 헤더를 nginx가 실제로 세팅) ② **잔여 가정** — `TRUST_PROXY=1`이면 앱이 `X-Real-IP`를 신뢰하므로, 만약 8080이 외부에 직접 노출되면 spoof 재발. 현재 systemd/nginx는 8080을 `127.0.0.1`로만 프록시한다는 전제가 맞는지(앱 bind·방화벽). 직접 노출 차단이 이 방어의 필요조건임을 명시.

## D. 새 우회 시도 (추가 탐색)
- owner-check를 우회하는 다른 mutation 경로(예: 다른 엔드포인트로 트랙·세션 변조)?
- IP 기반 신고에서 IPv6/IPv4 표기 차이·`::1` vs `127.0.0.1`로 같은 호스트가 distinct 버킷이 되는가(자동숨김 우회)?
- 멱등 `key:token`에서 author_key를 비워(=IP fallback) 타인 IP와 충돌시키는 경로?
- body Content-Length 위조(헤더 0, 실제 큰 body) 시 destroy가 실제로 동작하는가?

## E. 전체 회귀
```
cd apps/miniapp && npm test          (58/58 기대)
npm run build:web                    (tsc --noEmit + vite build PASS 기대)
```

## F. 반환
- `독립검토서/REVIEW-20260623-NNN_Codex_009검토_라운드2.md`
- 판정(Go / Conditional Go / No-Go) + A·B·C·D 표(기대 vs 실제·PASS/FAIL) + 재현 명령·종료코드 + 남은 위험
- 메타: status/owner: 이상혁/reviewers: [Codex]/last_updated. owner에 모델명 금지.
- 읽기·검토 전용(코드 수정 금지, 발견은 diff 제안만). 기존 `.claude/settings.json`·검토서 파일 건드리지 말 것.
