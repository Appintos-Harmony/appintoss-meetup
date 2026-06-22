import { defineConfig } from '@apps-in-toss/web-framework/config';

// 토스 WebView 카메라 검증용 설정.
// appName은 콘솔 등록 앱 ID(ASCII) → 테스트는 등록된 'meetup-lite' 재사용(제품 출시 시 'harmony' 등록 후 교체).
// brand.icon은 URL 필수(null 금지) → 임시 플레이스홀더, 콘솔 아이콘 주소로 교체 가능.
// 카메라 권한은 검토용 선언, 라이브 스트림은 표준 Web API(getUserMedia)로 직접 사용.
export default defineConfig({
  appName: 'meetup-lite',
  brand: {
    displayName: '하모니',
    primaryColor: '#3182F6',
    icon: 'https://placehold.co/512x512/3182f6/ffffff.png',
  },
  web: {
    host: 'localhost',
    port: 5173,
    commands: {
      dev: 'vite --host',
      build: 'vite build',
    },
  },
  permissions: [
    { name: 'camera', access: 'access' },
  ],
  // 토스 WebView: iOS 인라인 카메라 재생 허용(제스처 영상이 전체화면으로 튀지 않게);
  // 오디오 자동재생은 사용자 탭 필요(첫 탭 unlock과 일치); 비게임 오버스크롤 억제.
  webViewProps: {
    allowsInlineMediaPlayback: true,
    mediaPlaybackRequiresUserAction: true,
    overScrollMode: 'never',
  },
  outdir: 'dist',
});
