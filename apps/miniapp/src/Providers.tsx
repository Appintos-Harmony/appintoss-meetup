import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { isInToss } from './lib/env';

// 2트랙 디자인 셸:
//  · 토스 WebView 안  = TDS 정본 — 루트를 TDSMobileBedrockProvider 로 래핑(비게임 검수 필수, 근거 #11~#13).
//  · 일반 브라우저/데모 = theme.css 폴백 — 아무 것도 래핑하지 않고 그대로 렌더.
//
// TDS(@toss-design-system/mobile)는 ① 토스 WebView 밖에서 런타임 throw, ② Toss 환경에서만 설치되는
// optionalDependency 라서, 토스 안에서만 동적 import 한다. 미설치 환경(브라우저 데모)에서는
// vite 가 해당 패키지를 external 처리하고(아래 vite.config), 이 isInToss() 가드로 로드 자체를 막아
// 데모 빌드·실행이 깨지지 않는다.
export function Providers({ children }: { children: ReactNode }) {
  const [Tds, setTds] = useState<ComponentType<{ children: ReactNode }> | null>(null);

  useEffect(() => {
    if (!isInToss()) return; // 브라우저 폴백: TDS 미로드, theme.css 그대로.
    let alive = true;
    // @ts-ignore Toss 전용 optional 의존성 — 미설치 환경(데모)에서는 import 가 실행되지 않음.
    import('@toss-design-system/mobile')
      .then((m) => {
        const P = (m as { TDSMobileBedrockProvider?: ComponentType<{ children: ReactNode }> })
          .TDSMobileBedrockProvider;
        if (alive && P) setTds(() => P);
      })
      .catch(() => {
        /* TDS 미가용 → 폴백 유지(데모 지속) */
      });
    return () => {
      alive = false;
    };
  }, []);

  if (Tds) return <Tds>{children}</Tds>;
  return <>{children}</>; // theme.css 폴백 트랙
}
