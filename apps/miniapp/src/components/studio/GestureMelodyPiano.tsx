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
              // 투명: 카메라(손)가 비치게 — 평소엔 옅고, 누르면 파랗게 + 눌림 모션.
              background: on ? 'rgba(120,170,255,0.55)' : 'rgba(255,255,255,0.13)',
              border: '1px solid rgba(255,255,255,0.55)',
              borderRadius: '0 0 7px 7px',
              boxShadow: on ? 'inset 0 -7px 12px rgba(40,80,160,.4)' : 'none',
              transform: on ? 'translateY(4px) scaleY(0.98)' : 'none',
              transition: 'transform .05s var(--ease), background .05s, box-shadow .05s',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              paddingBottom: 9,
            }}
          >
            <span style={{ fontSize: camFull ? 15 : 11, fontWeight: 800, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.8)' }}>{k.label}</span>
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
              background: on ? 'rgba(60,93,176,0.72)' : 'rgba(12,16,24,0.45)',
              border: '1px solid rgba(255,255,255,0.35)',
              borderRadius: '0 0 5px 5px',
              boxShadow: on ? '0 2px 7px rgba(40,80,180,.6)' : 'none',
              transition: 'transform .05s var(--ease), background .05s',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              paddingBottom: 6,
            }}
          >
            <span style={{ fontSize: camFull ? 11 : 8, fontWeight: 800, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.9)' }}>{b.label}</span>
          </div>
        );
      })}
    </div>
  );
}
