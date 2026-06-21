#!/usr/bin/env bash
# 하모니 API 배포 (AWS Ubuntu). ⚠️ 유출된 SSH 키 로테이션 후, 서버에서 사람이 실행.
# 사용: apps/api 디렉터리를 서버로 복사(scp) 후 그 안에서 `bash deploy/deploy.sh`
set -euo pipefail

APP_DIR=/opt/harmony-api

# 0) 전제: Node >= 22.5 (node:sqlite 내장). 확인:
node -e 'process.exit(process.versions.node.split(".").map(Number)[0] >= 22 ? 0 : 1)' \
  || { echo "Node >= 22.5 필요"; exit 1; }

# 1) 파일 배치
sudo mkdir -p "$APP_DIR/data"
sudo cp server.mjs package.json "$APP_DIR/"

# 2) 전용 사용자
id harmony &>/dev/null || sudo useradd -r -s /usr/sbin/nologin harmony
sudo chown -R harmony:harmony "$APP_DIR"

# 3) systemd 등록·기동
sudo cp deploy/harmony-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now harmony-api

# 4) 헬스체크
sleep 1
curl -fsS http://localhost:8080/healthz && echo "  ✅ harmony-api up on :8080"

echo ""
echo "다음(HTTPS — 토스 WebView 필수, 둘 중 하나):"
echo "  A. cloudflared tunnel --url http://localhost:8080   # 즉시 https URL"
echo "  B. nginx(deploy/nginx-harmony-api.conf) + certbot    # 도메인 필요"
echo "그리고 미니앱 빌드에 VITE_API_BASE=<https URL> 주입."
