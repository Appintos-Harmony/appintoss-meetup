import { useEffect } from 'react';

// 매 구동 시 짧은 라이트 브랜드 리빌(하모니 로고+이름). 게임풍 인트로 아님 —
// 페이드/스케일 ~1.3초·사운드 없음·라이트(비게임 심사 가드). 끝나면 시작화면으로 자동 전환.
export function Splash({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 1300);
    return () => window.clearTimeout(t);
  }, [onDone]);

  return (
    <div className="screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{'@keyframes harmonyReveal{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}'}</style>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          animation: 'harmonyReveal 0.6s var(--ease, cubic-bezier(0.22,1,0.36,1)) both',
        }}
      >
        <img
          src="/logo.svg"
          width={84}
          height={84}
          alt="하모니"
          style={{ borderRadius: 24, boxShadow: 'var(--e3)' }}
        />
        <div className="t-display" style={{ fontWeight: 800 }}>하모니</div>
      </div>
    </div>
  );
}
