---
status: In Review
owner: 이상혁
reviewers: [Codex]
last_updated: 2026-06-24
related_requirements: []
related_adrs: []
---

# Codex 교차검토 라운드3 요청 — TASK-009 바인드 재확인 (R039 조건 종결)

> 사람이 Codex에 이 파일을 그대로 입력해 구동한다. **좁은 범위**: 127.0.0.1 바인드(commit `43b124d`)가 [REVIEW-039](../REVIEW-20260623-039_Codex_009검토_라운드2.md)의 단일 조건을 닫는지 + 무회귀만 확인한다. 이미 닫힌 P0/MED는 재심하지 않는다(빠른 블랙박스 패스로 갈음).
>
> **독립성(정직):** 아래 "라이브 확인됨" 주석은 패킷 작성자(Claude 워크플로)가 1차 실행한 결과다. same-family라 §7.4를 닫지 못한다 — **Codex는 명령을 직접 실행해 종료코드·출력으로 독립 재현**하고, §3 배포 전제를 배포 박스 기준으로 확정하라.

## 1. 배경 — 라운드2 조건과 그 수정
REVIEW-039는 009 보안 수정(commit `72cdfbf`)에 **Conditional Go**, 조건 단 하나:
- **조건(R039):** 앱이 `0.0.0.0` 바인드 + `TRUST_PROXY=1`이 `X-Real-IP`를 신뢰 → `:8080` 외부 노출 시 외부 공격자가 `X-Real-IP`를 직접 위조해 레이트리밋 우회 재활성화.
- **수정(commit `43b124d`):** `apps/api/server.mjs`에 `const HOST = process.env.HOST || '127.0.0.1'; server.listen(PORT, HOST, ...)` — 기본 바인드를 루프백 한정 → 같은 호스트 nginx(`proxy_pass http://127.0.0.1:8080`)만 도달. 외부 TCP 피어는 소켓을 못 열어 위조 `X-Real-IP` 전달 경로 자체가 사라진다.

소스 사실(Codex가 재확인): `clientIp()`(server.mjs 95-103) **변경 없음** — `TRUST_PROXY=1`이면 호출자 무관 `x-real-ip`→`XFF.pop()`→소켓 순 신뢰. 따라서 **바인드가 이 맹목적 신뢰 앞의 유일한 방어**가 됨. nginx 3개 location 모두 두 헤더를 `$remote_addr`로 덮어씀. systemd `TRUST_PROXY=1`·HOST 미설정.

> 환경 주의: 라이브 netstat 증명은 Windows 로컬에서 수집됨. production은 Linux이나 Node `127.0.0.1` 리터럴 바인드 의미(AF_INET 루프백, `::1` 미개방)는 동일. 배포 박스 자체는 여기서 증명 불가 → 배포 후 `ss -ltnp | grep 8080` 런북 점검 추가.

## 2. 확인 항목 (명령 · 안전 기대)
> 정리 규칙: cleanup은 **PID 한정**(`kill $SRV`/`kill $A $B`). `taskkill //IM node.exe` 같은 일괄 종료 금지. POSIX는 Git Bash에서. 블랙박스는 **신선한 temp DB** 필수(stale `bb_a.db` 재사용 시 케이스 2/3/5 거짓 실패). `$TEMP` 미설정이면 적당한 임시 경로로 대체.

### A. 바인딩 정확성
**A-1. 소스: 기본 IPv4 루프백 + HOST opt-out (정적)**
```
node -e "const s=require('fs').readFileSync('apps/api/server.mjs','utf8'); const host=/const HOST = process\.env\.HOST \|\| '127\.0\.0\.1'/.test(s); const listen=/server\.listen\(PORT, HOST,/.test(s); const no0=!/server\.listen\([^)]*0\.0\.0\.0/.test(s); console.log(JSON.stringify({hostDefaultLoopback:host, listenUsesHost:listen, noHardcoded0000:no0}));"
```
기대: `{"hostDefaultLoopback":true,"listenUsesHost":true,"noHardcoded0000":true}`.

**A-2. 라이브: 기본 서버는 127.0.0.1만 LISTEN (0.0.0.0/:: 아님)** — R039 핵심
```
PORT=8077 DB_PATH="$TEMP/bind_probe.db" node apps/api/server.mjs & SRV=$!; sleep 2; netstat -an | grep 8077 | grep LISTENING; netstat -an | grep 8077 | grep -E '0\.0\.0\.0:8077|\[::\]:8077' | grep LISTENING || echo 'NONE (good)'; kill $SRV 2>/dev/null
```
기대: `TCP 127.0.0.1:8077 ... LISTENING` 한 줄, 두 번째 grep `NONE (good)`. (작성자 라이브 확인됨)

**A-3. 라이브: IPv4 도달 / IPv6 `::1` 거부**
```
PORT=8079 DB_PATH="$TEMP/bind_probe3.db" node apps/api/server.mjs & SRV=$!; sleep 2; curl -s --max-time 4 http://127.0.0.1:8079/healthz; echo; curl -s --max-time 4 "http://[::1]:8079/healthz"; echo "ipv6_curl_exit=$?"; kill $SRV 2>/dev/null
```
기대: IPv4 `{"ok":true,...}`, IPv6 무출력 + `ipv6_curl_exit=7`(거부). (작성자 라이브 확인됨)

**A-4. nginx 프록시 업스트림(127.0.0.1:8080) 무회귀**
```
node -e "const s=require('fs').readFileSync('apps/api/deploy/nginx-harmony-api.conf','utf8'); console.log('proxy_pass 127.0.0.1:8080 count =', (s.match(/proxy_pass http:\/\/127\.0\.0\.1:8080/g)||[]).length);"
```
기대: `count = 3`. (8080 점유 시 정적 확인으로 갈음)

### B. 잔여 노출 & XFF 체인
**B-1. systemd: TRUST_PROXY=1 + HOST=0.0.0.0 미설정 (정적)** — 미래 슬립 적발
```
node -e "const s=require('fs').readFileSync('apps/api/deploy/harmony-api.service','utf8'); const trust=/^Environment=TRUST_PROXY=1\s*$/m.test(s); const noHost=!/Environment=HOST=/.test(s) || /Environment=HOST=127\.0\.0\.1/.test(s); console.log('trust_proxy=1='+trust,'no_open_host='+noHost); process.exit(trust&&noHost?0:1)"
```
기대: `trust_proxy=1=true no_open_host=true`, exit 0.

**B-2. nginx 모든 프록시 location이 X-Real-IP·XFF 둘 다 $remote_addr 덮어씀 (정적)** — 드리프트 적발
```
node -e "const s=require('fs').readFileSync('apps/api/deploy/nginx-harmony-api.conf','utf8'); const locs=s.split('\n').filter(l=>l.includes('proxy_pass http://127.0.0.1:8080')); const bad=locs.filter(l=>!(/X-Real-IP \$remote_addr/.test(l)&&/X-Forwarded-For \$remote_addr/.test(l))); console.log('proxied='+locs.length,'not_overwriting_both='+bad.length); process.exit(locs.length>0&&bad.length===0?0:1)"
```
기대: `proxied=3 not_overwriting_both=0`, exit 0.

**B-3. HOST opt-out은 의도적 (라이브, 정보)**
```
PORT=8078 HOST=0.0.0.0 DB_PATH="$TEMP/bind_probe_host.db" node apps/api/server.mjs & SRV=$!; sleep 2; netstat -an | grep 8078 | grep LISTENING; kill $SRV 2>/dev/null
```
기대: `TCP 0.0.0.0:8078 ... LISTENING`(명시 override만 외부 개방). (작성자 라이브 확인됨)

### C. 회귀
**C-1. 보안 블랙박스 7/7 (신선 DB)**
```
cd apps/api && ( PORT=8091 DB_PATH="$TEMP/bb_a.db" node server.mjs & A=$!; PORT=8092 DB_PATH="$TEMP/bb_b.db" node server.mjs & B=$!; sleep 2; node _blackbox_security.mjs; RC=$?; kill $A $B 2>/dev/null; exit $RC )
```
기대: `=== 7 PASS / 0 FAIL ===`, exit 0. **주의:** TRUST_PROXY 미설정이라 default-deny(소켓-온리) 경로만 검증 — production proxy-trust 토폴로지 검증 아님(과대 해석 금지).

**C-2. miniapp vitest 58/58 + build (분기 회귀 가드)**
```
cd apps/miniapp && npm test ; npm run build:web
```
기대: `Tests 58 passed (58)`, build exit 0.

## 3. 배포 전제 (Codex가 배포 박스 기준 확정)
소스(43b124d)는 올바르나 **런타임 방어는 재배포 후에만 라이브**다('binding closes condition'은 배포 운영 전제). `deploy/deploy.sh`는 `cp server.mjs`→`daemon-reload`→`enable --now`만 있고 **nginx 리로드 단계가 없다**(별도 `systemctl reload nginx` 수동 필요). 재배포 전 라이브 `:8080`은 구 `0.0.0.0` 바인드일 수 있음.

Codex 확정 항목:
1. production은 `harmony-api.service`로 구동, **HOST 미설정**(기본 127.0.0.1) — 어디에도 `HOST=0.0.0.0` 없음.
2. nginx가 `:8080`의 유일 도달 경로(`proxy_pass 127.0.0.1:8080`), 모든 location에서 X-Real-IP·XFF 무조건 덮어씀.
3. 컨테이너 포트매핑·SSH 터널·2차 프록시·NodePort 등 `:8080` 외부 재노출 없음(베어메탈/VM).
4. SG/방화벽이 8080 외부 인바운드 계속 차단(방어심층 — 미래 HOST 슬립 대비 유지).
5. **같은 호스트 로컬 프로세스의 X-Real-IP 위조는 여전히 가능**함을 데모 범위 한계로 명시 기록(닫힌 것으로 취급 금지).
배포 후: 서버에서 `ss -ltnp | grep 8080` → `127.0.0.1:8080` 확인(런북 추가 권고).

## 4. Codex 판정 기준 + 잔여 위험
**Go 전환 요건:** ① 배포 전제(§3) 배포 박스 기준 확정 ② 잔여 #1(로컬 위조)을 알려진 한계로 명시. 둘 충족 시 Go, 아니면 Conditional Go.

잔여(모두 배포 전제/방어심층 — 닫힌 조건 재개방 아님):
- **#1** 루프백은 신원이 아닌 편의의 경계. `TRUST_PROXY=1`에서 임의 127.0.0.1 호출자 `X-Real-IP` 신뢰(peer-cred·신뢰IP 검증 없음). 원격엔 닫힘, 호스트 로컬엔 열림.
- **#2** 바인드는 기본 토폴로지만 보호. `HOST=0.0.0.0`·컨테이너·터널이 8080 재노출 시 R039 재개방.
- **#3** SG/방화벽은 이제 방어심층 — 그래도 8080 외부 차단 유지.
- **#4** 블랙박스는 default-deny 경로만 — 7/7을 proxy-trust 검증으로 과대 해석 금지.
- **#5** 소스 vs 라이브 드리프트: 43b124d는 레포에 정확하나 런타임은 재배포 후에만(`deploy.sh` nginx 리로드 없음). env의 `HOST=0.0.0.0` 오타가 무경고 재노출.

## 5. 반환
- `독립검토서/REVIEW-20260624-NNN_Codex_009검토_라운드3.md`
- 판정(Go / Conditional Go / No-Go) + §2 확인표(명령·종료코드·기대 vs 실제) + §3 배포 전제 확정 + 잔여
- 메타: status/owner: 이상혁/reviewers: [Codex]/last_updated: 2026-06-24 (owner에 모델명 금지)
- 읽기·검토 전용 — 기존 `.claude/settings.json`·검토서·소스 미수정.
