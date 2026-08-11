// 개발자 모드 오버레이: FPS·백엔드 핑·네트워크 정보. 손 스켈레톤(점)은 Studio 카메라 위에 직접 그린다.
// 밝기 = 이 오버레이 창 자체의 불투명도('밝기 ▼'로 펼침). '접기'로 한 줄 칩으로 최소화(개발자 모드는 설정에서 끈다).
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

interface NetInfo {
  downlink?: number;
  rtt?: number;
  effectiveType?: string;
}

export function DevOverlay({
  fps,
  latency,
  brightness,
  onBrightness,
}: {
  fps: number;
  latency: number | null;
  brightness: number;
  onBrightness: (v: number) => void;
}) {
  const [net, setNet] = useState<NetInfo | null>(null);
  const [openBright, setOpenBright] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const conn = (navigator as unknown as { connection?: NetInfo & { addEventListener?: (t: string, h: () => void) => void; removeEventListener?: (t: string, h: () => void) => void } }).connection;
    if (!conn) return;
    const update = () => setNet({ downlink: conn.downlink, rtt: conn.rtt, effectiveType: conn.effectiveType });
    update();
    conn.addEventListener?.('change', update);
    return () => conn.removeEventListener?.('change', update);
  }, []);

  const wrap: CSSProperties = {
    position: 'fixed',
    top: 'calc(8px + env(safe-area-inset-top))',
    left: 8,
    zIndex: 90,
    background: 'rgba(11,13,16,.82)',
    color: '#7CFC9B',
    font: '11px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace',
    borderRadius: 10,
    backdropFilter: 'blur(4px)',
    opacity: brightness,
    transition: 'opacity .12s ease',
  };

  // 접힘: 한 줄 칩(탭하면 펼침)
  if (collapsed) {
    return (
      <button onClick={() => setCollapsed(false)} style={{ ...wrap, border: 0, padding: '5px 10px', fontWeight: 800, letterSpacing: 1, cursor: 'pointer', pointerEvents: 'auto' }}>
        🛠 DEV ▸
      </button>
    );
  }

  const row = (label: string, value: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
      <span style={{ opacity: 0.7 }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );

  const miniBtn: CSSProperties = { flex: 1, border: 0, borderRadius: 7, padding: '5px 0', font: 'inherit', fontWeight: 700, cursor: 'pointer', background: 'rgba(255,255,255,.12)', color: '#7CFC9B' };

  return (
    <div style={{ ...wrap, padding: '8px 11px', minWidth: 138, pointerEvents: 'none' }}>
      <div style={{ color: '#fff', fontWeight: 800, marginBottom: 4, letterSpacing: 1 }}>DEV</div>
      {row('FPS', fps ? String(fps): '-')}
      {row('PING', latency === null ? '-': `${latency}ms`)}
      {row('NET', net?.effectiveType ?? '-')}
      {row('DOWN', net?.downlink ? `${net.downlink}Mb`: '-')}
      {row('RTT', net?.rtt !== undefined ? `${net.rtt}ms`: '-')}

      {openBright && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,.12)', pointerEvents: 'auto' }}>
          <input
            type="range"
            min={0.3}
            max={1}
            step={0.05}
            value={brightness}
            onChange={(e) => onBrightness(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#7CFC9B', height: 14 }}
          />
          <span style={{ fontWeight: 700, minWidth: 30, textAlign: 'right' }}>{Math.round(brightness * 100)}%</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 7, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,.12)', pointerEvents: 'auto' }}>
        <button style={miniBtn} onClick={() => setOpenBright((v) => !v)}>
          밝기 {openBright ? '▲' : '▼'}
        </button>
        <button style={miniBtn} onClick={() => setCollapsed(true)}>
          접기 ▴
        </button>
      </div>
    </div>
  );
}
