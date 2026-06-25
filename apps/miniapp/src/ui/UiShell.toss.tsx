import type { ReactNode } from 'react';
import { TDSMobileAITProvider } from '@toss/tds-mobile-ait';

// 토스 전용 셸. 이 파일만 TDS 를 정적 import 한다(UiShell 에서 토스일 때만 동적 로드).
// TDSMobileAITProvider 는 props 가 모두 optional 이며 granite.config.ts 의 브랜드 색을 기본 사용한다.
export function TossShell({ children }: { children: ReactNode }) {
  return <TDSMobileAITProvider>{children}</TDSMobileAITProvider>;
}
