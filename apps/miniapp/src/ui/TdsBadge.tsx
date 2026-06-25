import { Text } from '@toss/tds-mobile';

// 샌드박스 폰 실증용: TDS 가 실제 렌더된다는 시각 증거(설정 개발자 패널에서만 동적 로드).
// TDS 컴포넌트라 TDSMobileAITProvider(UiShell.toss) 컨텍스트 안에서만 정상 동작한다.
export default function TdsBadge() {
  return <Text typography="t5">TDS 렌더 OK ✓</Text>;
}
