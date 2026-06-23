// 제스처 코드 모드 — 기타/베이스 전용 오버레이.
// 투명한 기타/베이스 실루엣 위에 프렛(세로선)으로 칸을 나눠 C | F | Am | G 식으로 코드 배치.
// 해당 칸 코드가 울리면(active) 그 칸의 현(가로선)이 진동.
import { chordColor, ROMAN } from './chords';

const STRINGS: Record<'guitar' | 'bass', number> = { guitar: 6, bass: 4 };

export function GestureFretboard({
  zoneCount,
  selected,
  active,
  instrument,
  camFull,
}: {
  zoneCount: number;
  selected: string[];
  active: string[];
  instrument: 'guitar' | 'bass';
  camFull: boolean;
}) {
  const n = Math.max(1, zoneCount);
  const strings = STRINGS[instrument];

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {/* 투명한 기타/베이스 실루엣(장식) */}
      <svg viewBox="0 0 300 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.22 }}>
        <g fill="none" stroke="#ffffff" strokeWidth={1.6} strokeLinejoin="round">
          {/* 헤드스톡 */}
          <rect x={4} y={38} width={20} height={24} rx={4} />
          <line x1={26} y1={30} x2={26} y2={70} strokeWidth={2.4} />
          {/* 넥(프렛 영역) */}
          <rect x={26} y={32} width={184} height={36} />
          {/* 바디 */}
          <ellipse cx={250} cy={50} rx={48} ry={46} />
          {instrument === 'guitar' && <circle cx={244} cy={50} r={15} />}
        </g>
      </svg>

      {/* 프렛 칸(코드) */}
      <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)` }}>
        {Array.from({ length: n }).map((_, i) => {
          const label = selected[i] ?? null;
          const col = label ? chordColor(label, i)[0] : '#ffffff';
          const on = label !== null && active.includes(label);
          return (
            <div
              key={i}
              style={{
                position: 'relative',
                borderRight: i < n - 1 ? '2.5px solid rgba(255,255,255,.55)' : 'none', // 프렛 |
                background: on ? `${col}66` : 'transparent',
                transition: 'background .08s',
              }}
            >
              {/* 현(가로선) — active면 진동 */}
              {Array.from({ length: strings }).map((_, s) => (
                <div
                  key={s}
                  className={on ? 'gstring-vib' : undefined}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: `${((s + 1) / (strings + 1)) * 100}%`,
                    height: 1 + s * 0.35,
                    background: 'rgba(255,255,255,.5)',
                    boxShadow: on ? '0 0 4px rgba(255,255,255,.8)' : 'none',
                  }}
                />
              ))}
              {/* 코드 라벨 */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 14, color: '#fff' }}>
                {label && ROMAN[label] && <span style={{ fontSize: 11, opacity: 0.75, fontWeight: 700 }}>{ROMAN[label]}</span>}
                <span style={{ fontSize: camFull ? 32 : 23, fontWeight: 800, textShadow: '0 1px 5px rgba(0,0,0,.7)', transform: on ? 'scale(1.12)' : 'none', transition: 'transform .08s' }}>{label ?? '—'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
