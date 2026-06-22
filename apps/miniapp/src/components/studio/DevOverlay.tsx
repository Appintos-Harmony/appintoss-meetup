// 개발자 모드 오버레이 — FPS·백엔드 핑·네트워크 정보. 손 스켈레톤(점)은 Studio 카메라 위에 직접 그린다.
import { useEffect, useState } from 'react';

interface NetInfo {
  downlink?: number;
  rtt?: number;
  effectiveType?: string;
}

export function DevOverlay({ fps, latency }: { fps: number; latency: number | null }) {
  const [net, setNet] = useState<NetInfo | null>(null);

  useEffect(() => {
    const conn = (navigator as unknown as { connection?: NetInfo & { addEventListener?: (t: string, h: () => void) => void; removeEventListener?: (t: string, h: () => void) => void } }).connection;
    if (!conn) return;
    const update = () => setNet({ downlink: conn.downlink, rtt: conn.rtt, effectiveType: conn.effectiveType });
    update();
    conn.addEventListener?.('change', update);
    return () => conn.removeEventListener?.('change', update);
  }, []);

  const row = (label: string, value: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
      <span style={{ opacity: 0.7 }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );

  return (
    <div
      style={{
        position: 'fixed',
        top: 'calc(8px + env(safe-area-inset-top))',
        left: 8,
        zIndex: 90,
        background: 'rgba(11,13,16,.82)',
        color: '#7CFC9B',
        font: '11px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace',
        padding: '8px 11px',
        borderRadius: 10,
        minWidth: 138,
        pointerEvents: 'none',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div style={{ color: '#fff', fontWeight: 800, marginBottom: 4, letterSpacing: 1 }}>DEV</div>
      {row('FPS', fps ? String(fps) : '—')}
      {row('PING', latency === null ? '—' : `${latency}ms`)}
      {row('NET', net?.effectiveType ?? '—')}
      {row('DOWN', net?.downlink ? `${net.downlink}Mb` : '—')}
      {row('RTT', net?.rtt !== undefined ? `${net.rtt}ms` : '—')}
    </div>
  );
}
