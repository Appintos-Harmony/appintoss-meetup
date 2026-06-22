# harmony-api — 하모니 합주 공유 백엔드

비동기 합주("얹기") 공유용 최소 API. **Node 내장 모듈만**(무의존): `node:http` + `node:sqlite`(Node ≥ 22.5, 플래그 불필요).

## 로컬 실행
```bash
PORT=8080 DB_PATH=./harmony.db node server.mjs
```

## 엔드포인트
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/healthz` | `{ok,time}` |
| POST | `/sessions` | body `{name,bpm,owner,events}` → `{code}` (6자리, 0/1/I/O 제외) |
| GET | `/sessions/:code` | `{code,name,bpm,tracks:[{owner,events,createdAt}]}` |
| POST | `/sessions/:code/tracks` | body `{owner,events}` → `{ok,trackId}` (얹기) |

### 커뮤니티 (피드) — 쓰기는 헤더 `X-Anon-Key` 필요(없으면 503 페일클로즈드)
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/feed?sort=recent\|popular&limit=` | 공개곡 목록(**메타만, events 미포함**). `liked`는 키 있으면 표기 |
| GET | `/publications/:id` | 단건(**events 포함** — 들어보기/가져오기) |
| POST | `/publications` | 게시(events를 불변 스냅샷 복사). owner당 5곡 초과 시 409 |
| POST·DELETE | `/publications/:id/like` | 좋아요 토글(`UNIQUE(pub_id,user_key)` 중복 차단) |
| POST | `/publications/:id/report` | 신고. 누적 3건 → 자동 `hidden` |
| GET | `/me/publications` | 내 공개곡(5개 한도 표시) |
| DELETE | `/publications/:id` | 내 것 삭제 |

`events` = 클라 `chordReducer`의 `ChordEvent[]`(tick 기반, 서버는 opaque JSON 저장). 클라 `src/lib/share.ts`·`src/lib/community.ts`와 계약 일치. 테이블: `sessions`·`tracks`(합주) + `publications`·`likes`·`reports`(커뮤니티). WAL·busy_timeout·인덱스·rate-limit 적용. 통합테스트 `server.test.mjs`(`node --test`).

> **재배포 시:** `server.mjs` 교체 후 `sudo systemctl restart harmony-api`, nginx conf(`deploy/nginx-harmony-api.conf`) 교체 후 `sudo nginx -t && sudo systemctl reload nginx`. 신규 테이블은 `CREATE TABLE IF NOT EXISTS`라 기존 데이터 보존(추가만).

## AWS Ubuntu 배포 (사람 실행 — 키 로테이션 후)
> ⚠️ **유출된 SSH 키 로테이션 먼저.** SSH 접속·키 작업은 사람이 한다(AI 금지).

1. **Node ≥ 22.5** 설치 (nodesource 또는 nvm). `node --version`으로 `node:sqlite` 가용 확인.
2. 파일 복사: `server.mjs`·`package.json` → `/opt/harmony-api/`.
3. 사용자/데이터: `sudo useradd -r -s /usr/sbin/nologin harmony` · `sudo mkdir -p /opt/harmony-api/data` · `sudo chown -R harmony:harmony /opt/harmony-api`.
4. systemd: `deploy/harmony-api.service` → `/etc/systemd/system/` · `sudo systemctl daemon-reload && sudo systemctl enable --now harmony-api` · `curl localhost:8080/healthz`로 확인.
5. **HTTPS (토스 WebView 필수 — 둘 중 하나):**
   - **빠른 길:** `cloudflared tunnel --url http://localhost:8080` → 즉시 `https://…trycloudflare.com`(도메인·인증서 불필요, 데모용).
   - **정식:** nginx 리버스프록시(`deploy/nginx-harmony-api.conf`) + `certbot --nginx`(도메인 필요).
6. **클라 주입:** 미니앱 빌드 시 `VITE_API_BASE=https://<배포URL>` 설정.
   미설정 시 기본 `http://localhost:8080` → **기기에선 동작 안 함**(프리로드 폴백만).

## 한계 (데모 범위)
- **인증 없음**(코드 = 접근권한). 공개 배포 전 rate-limit·입력 검증·코드 만료 추가 권장.
- 실시간 아님 — 클라 1~2초 polling.
- 단일 인스턴스·로컬 SQLite 파일(수평 확장 시 별도 DB 필요).
