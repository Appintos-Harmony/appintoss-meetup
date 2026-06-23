// 실행 환경 감지 (2트랙 디자인 셸 분기용).
// 토스 미니앱은 React Native WebView 위에서 동작하며, 그 안에서는 브리지 객체
// window.ReactNativeWebView 가 주입된다(SDK prebuilt 번들이 이 브리지로 통신).
// TDS 정본은 토스 WebView 안에서만 동작하므로, 이 플래그로 TDS / theme.css 폴백을 가른다.
export function isInToss(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean((window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView)
  );
}
