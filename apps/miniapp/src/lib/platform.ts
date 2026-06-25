// 실행 환경 판별 (2트랙 경계의 단일 기준).
// 토스 WebView/샌드박스 = TDS·getAnonymousKey 동작, 일반 브라우저(AWS) = 폴백.
// getOperationalEnvironment 는 constant bridge → 토스 밖에서는 throw 가능하므로 try/catch 로 감싸 'web' 으로 떨어뜨린다.
import { getOperationalEnvironment } from '@apps-in-toss/web-framework';

export type RuntimeEnv = 'toss' | 'sandbox' | 'web';

export function getRuntimeEnv(): RuntimeEnv {
  try {
    const env = getOperationalEnvironment();
    return env === 'toss' || env === 'sandbox' ? env : 'web';
  } catch {
    // 일반 브라우저(AWS): 브릿지 상수가 없어 throw → web 트랙
    return 'web';
  }
}

export function isToss(): boolean {
  return getRuntimeEnv() !== 'web';
}
