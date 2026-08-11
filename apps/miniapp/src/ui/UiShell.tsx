import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { isToss } from '../lib/platform';

type ShellComponent = ComponentType<{ children: ReactNode }>;

// 2트랙 UI 셸. 토스(WebView/샌드박스)에서만 TDS 셸을 동적 로드한다.
// TDS(@toss/tds-mobile-ait)는 토스 환경 밖에서 throw → 일반 브라우저(AWS) 번들이 평가하지 않도록
// 정적 import 를 두지 않고 isToss() 일 때만 import('./UiShell.toss') 로 분리한다. 폴백 = theme.css 그대로.
export function UiShell({ children }: { children: ReactNode }) {
  const [TossShell, setTossShell] = useState<ShellComponent | null>(null);

  useEffect(() => {
    if (!isToss()) return; // AWS/브라우저: TDS 미로딩, theme.css 만 사용
    let alive = true;
    import('./UiShell.toss')
      .then((m) => {
        if (alive) setTossShell(() => m.TossShell);
      })
      .catch(() => {
        // TDS 로드 실패 시에도 폴백(theme.css) 유지: 화면이 깨지지 않게
      });
    return () => {
      alive = false;
    };
  }, []);

  return TossShell ? <TossShell>{children}</TossShell> : <>{children}</>;
}
