import { defineConfig } from '@apps-in-toss/web-framework/config';

// 토스 WebView 카메라 검증용 설정.
// appName은 콘솔 등록 앱 ID(ASCII). 'harmony' 콘솔 등록 완료(검토 중) → 샌드박스 진입은 intoss://harmony.
// SDK 3.x 부터 표시 이름과 아이콘은 설정이 아니라 앱인토스 콘솔에서 관리한다.
// 카메라 권한은 검토용 선언, 라이브 스트림은 표준 Web API(getUserMedia)로 직접 사용.
export default defineConfig({
  appName: 'harmony',

  brand: {
    primaryColor: '#3182F6'
  },

  permissions: [
    { name: 'camera', access: 'access' },
  ],

  // 토스 WebView: iOS 인라인 카메라 재생 허용(제스처 영상이 전체화면으로 튀지 않게);
  // 오디오 자동재생은 사용자 탭 필요(첫 탭 unlock과 일치); 비게임 오버스크롤 억제.
  webView: {
    allowsInlineMediaPlayback: true,
    mediaPlaybackRequiresUserAction: true,
    overScrollMode: 'never',
  },

  webBundleDir: 'dist'
});
