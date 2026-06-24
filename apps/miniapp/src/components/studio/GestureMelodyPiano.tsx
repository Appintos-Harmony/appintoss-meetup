// 멜로디 제스처 — 피아노. 불투명 건반 오버레이; 손끝이 닿은 건반이 '눌리는' 모션.
// 손끝→건반 매핑은 Studio 루프가 하고, 여기선 pressed(현재 눌린 음 집합)만 받아 표시(손가락 모드 전용).
interface White {
  note: string;
  label: string;
}
interface Black {
  note: string;
  label: string;
  leftPct: number; // 인접 흰건반 경계 위치(%)
}

export function GestureMelodyPiano({
  whites,
  blacks,
  pressed,
  camFull,
}: {
  whites: White[];
  blacks: Black[];
  pressed: Set<string>;
  camFull: boolean;
}) {
  const blackW = (100 / Math.max(1, whites.length)) * 0.6;
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none' }}>
      {/* 흰건반 */}
      {whites.map((k, i) => {
        const on = pressed.has(k.note);
        return (
          <div
            key={k.note + i}
            style={{
              flex: 1,
              position: 'relative',
              background: on ? 'linear-gradient(180deg,#cfe0ff,#9bbcf0)' : 'rgba(252,253,255,0.95)',
              borderRight: i < whites.length - 1 ? '1px solid #b9c2d0' : 'none',
              borderRadius: '0 0 7px 7px',
              boxShadow: on ? 'inset 0 -7px 12px rgba(40,80,160,.28)' : 'inset 0 -12px 16px rgba(0,0,0,.07)',
              transform: on ? 'translateY(4px) scaleY(0.98)' : 'none',
              transition: 'transform .05s var(--ease), background .05s, box-shadow .05s',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              paddingBottom: 9,
            }}
          >
            <span style={{ fontSize: camFull ? 15 : 11, fontWeight: 700, color: on ? '#1b3a7a' : '#7a8699' }}>{k.label}</span>
          </div>
        );
      })}
      {/* 검은건반 — 경계 위치, 위쪽 62% */}
      {blacks.map((b) => {
        const on = pressed.has(b.note);
        return (
          <div
            key={b.note}
            style={{
              position: 'absolute',
              top: 0,
              left: `${b.leftPct}%`,
              width: `${blackW}%`,
              height: '62%',
              transform: `translateX(-50%) ${on ? 'translateY(4px)' : ''}`,
              background: on ? 'linear-gradient(180deg,#3a5db0,#22366e)' : 'linear-gradient(180deg,#2a2f3a,#14171d)',
              borderRadius: '0 0 5px 5px',
              boxShadow: on ? '0 2px 7px rgba(40,80,180,.55)' : '0 3px 7px rgba(0,0,0,.55)',
              transition: 'transform .05s var(--ease), background .05s',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              paddingBottom: 6,
            }}
          >
            <span style={{ fontSize: camFull ? 11 : 8, fontWeight: 700, color: on ? '#cfe0ff' : '#9aa3b5' }}>{b.label}</span>
          </div>
        );
      })}
    </div>
  );
}
