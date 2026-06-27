---
status: In Review
owner: 이상혁
reviewers: [곽소정, 양록빈]
last_updated: 2026-06-27
related_requirements: []
related_adrs: []
---

# 토스 WebView 카메라 샌드박스 테스트 절차

## 목적
악기 합주앱의 플래그십(카메라 손 제스처 연주)이 **실제 토스 WebView**에서 동작하는지 실기기로 검증한다. 모바일 브라우저는 이미 통과(스파이크 커밋 923e545, 카메라+핸드트래킹+녹음, 45/30fps).

> **검증 완료(2026-06-25).** 이 절차로 검증했고, 아이폰13·갤S23U 실기기에서 카메라 권한·손 인식·제스처 연주(RT-04·05) Pass 확인([통합테스트_결과서](통합테스트_결과서.md)·[앱인토스_실기기검수표](앱인토스_실기기검수표.md) 참조). 아래 절차는 재현용으로 유지한다.

## 이 테스트가 답할 질문
1. 토스 WebView에서 **`getUserMedia`(라이브 카메라)** 가 허용되는가?
2. WebView에서 **MediaPipe 추론 FPS**가 연주 가능한 수준인가?
3. 카메라 권한 프롬프트가 정상 노출되는가?

## 공식 근거 (긍정 신호)
- WebView는 **표준 Web API 대부분 허용** → Web Audio·getUserMedia 가능성. ([WebView 속성](https://developers-apps-in-toss.toss.im/bedrock/reference/framework/속성))
- 권한 문서: **마이크는 "WebView라면 Web API로 직접 구현"** 명시 → 라이브 미디어(getUserMedia)를 WebView에서 직접 쓰는 것을 의도. 카메라 권한은 `granite.config.ts`에 선언(검토용). ([권한](https://developers-apps-in-toss.toss.im/bedrock/reference/framework/권한/permission.md))
- **샌드박스·실기기 실측으로 확정됨(2026-06-25, RT-04·05 Pass)**(근거목록 #9). 토스 WebView에서 getUserMedia·MediaPipe 추론이 연주 가능한 수준으로 동작함.

## 준비물 (전제)
- 토스 **비즈니스 계정**(콘솔 등록 계정) + 등록 앱. **`harmony` 앱으로 등록·테스트트랙 출시(20260626-1) 완료.** `meetup-lite`는 과거 테스트 진입값이며, 현재 검수·출시는 harmony 등록 ID로 수행한다.
- **샌드박스 앱**(개발용, 일반 토스앱 아님): Android APK / iOS(시뮬레이터·실기기). ([샌드박스](https://developers-apps-in-toss.toss.im/development/test/sandbox.md))
- 폰 + 카메라. (Android) USB 케이블 + `adb`(USB 디버깅) / (iOS 실기기) 로컬 서버와 **같은 WiFi** + "로컬 네트워크" 허용.
- 토스 인증용: 등록 토스 계정의 토스앱이 깔린 폰(푸시 인증).

## 절차

### 1) 프로젝트를 web-framework로 래핑
```sh
npm install @apps-in-toss/web-framework
npx ait init        # granite.config.ts 생성
```
`granite.config.ts`를 아래로 설정(카메라 권한 선언 + dev 호스트):
```ts
import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'harmony',            // 콘솔 등록 앱 ID(harmony, 테스트트랙 출시 완료)
  displayName: '하모니',          // 콘솔 등록 이름과 동일해야 함
  permissions: [
    { name: 'camera', access: 'access' },   // 검토용 선언(라이브는 getUserMedia)
  ],
  web: {
    commands: {
      dev: 'vite --host',         // 실기기 연결 위해 --host 필수
      build: 'tsc -b && vite build',
    },
    // host: 'x.x.x.x',           // iOS 실기기 트러블슈팅 시 호스트 IP 명시
  },
});
```
- 진입 화면에서 **스파이크(`apps/miniapp/public/gesture-spike.html`)** 를 로드(또는 그 로직을 앱 메인 라우트로 이식). 핀치줌 비활성 메타 유지.

### 2) 개발 서버 실행
```sh
npm run dev          # vite --host → http://<로컬IP>:5173
ipconfig             # (Windows) 로컬 IPv4 확인
```

### 3) 샌드박스 연결
1. 샌드박스 앱 설치 → **비즈니스 개인 계정 로그인**.
2. 워크스페이스에서 **앱 선택**(harmony 등록 ID) → **토스 인증**(등록 토스 계정 폰 푸시). (meetup-lite는 과거 테스트 진입값)
3. 로컬 서버 연결:
   - **Android:** `adb reverse tcp:5173 tcp:5173` (필요시 `tcp:8081`도)
   - **iOS 실기기:** 같은 WiFi + 서버 IP 입력 + "로컬 네트워크" 허용
4. 스킴 접속: **`intoss://harmony`**(harmony 등록 스킴). (`intoss://meetup-lite`는 과거 테스트 진입값)
> 샌드박스는 http 허용(라이브는 https만). 핀치줌·appName/displayName 콘솔 일치 필수.

### 4) 카메라 테스트
스파이크 **▶ 시작** → **카메라 권한 허용** → 손 펴서 4분할 코드 연주 → ● 녹화/▶ 재생.
**기록:** ⓐ 카메라 켜짐? ⓑ 연주 FPS ⓒ 권한 프롬프트 정상? ⓓ 에러 메시지(있으면 원문).

## 판정
- **됨** → 카메라 제스처 = 플래그십 **확정**, 제품에 통합.
- **안 됨(getUserMedia 차단)** → **폴백 확정**: 터치 + 기기모션(검증 GREEN)으로 MVP, 카메라는 컷/후속. 발표엔 영향 없음.

## 주의 / 열린 질문
- getUserMedia가 WebView에서 권한 프롬프트와 함께 동작하는지가 핵심 미지수(권한 문서 신호는 긍정).
- `camera` 권한 선언만으로 라이브 스트림이 열리는지, 별도 OS 권한이 필요한지 실측 확인.
- 샌드박스 "테스트 가능 기능" 표에 카메라/getUserMedia 명시 없음 → 본 절차가 1차 확인.

## 근거 문서
[샌드박스](https://developers-apps-in-toss.toss.im/development/test/sandbox.md) · [기존 웹 연동](https://developers-apps-in-toss.toss.im/tutorials/webview.md) · [권한](https://developers-apps-in-toss.toss.im/bedrock/reference/framework/권한/permission.md) · [WebView 속성](https://developers-apps-in-toss.toss.im/bedrock/reference/framework/속성) · 관련 [DL-018](../00_프로젝트관리/의사결정_기록.md) · [공식문서_근거목록 #8~10](../02_정책준수/공식문서_근거목록.md)
