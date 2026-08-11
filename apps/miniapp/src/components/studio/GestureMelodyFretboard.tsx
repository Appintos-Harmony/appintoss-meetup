// 멜로디 제스처: 기타/베이스. 현(행)×프렛(열) 그리드; 각 셀 = transpose(개방현, 프렛) 음.
// 손끝이 닿은 셀 강조 + 그 현(행) 진동(gstring-vib 재사용). 한 현을 가로로 쓸면 셀이 연속 바뀌며 글리산도.
// 셀→음 매핑은 NotePadGrid와 동일. 발음/매핑은 Studio 루프, 여기선 pressed(눌린 셀)만 표시(손가락 모드 전용).
import { transpose, solfa } from '../../lib/notes';
import { STRINGS_GUITAR, STRINGS_BASS } from './chords';

export function GestureMelodyFretboard({
  instrument,
  frets,
  pressed,
  camFull,
}: {
  instrument: 'guitar' | 'bass';
  frets: number;
  pressed: { row: number; col: number }[];
  camFull: boolean;
}) {
  const strings = (instrument === 'bass' ? STRINGS_BASS : STRINGS_GUITAR).slice().reverse(); // 고음 위
  const pressedRows = new Set(pressed.map((p) => p.row));
  const isOn = (r: number, c: number) => pressed.some((p) => p.row === r && p.col === c);
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateRows: `repeat(${strings.length}, 1fr)`, pointerEvents: 'none', background: 'rgba(22,17,12,0.5)' }}>
      {strings.map((open, r) => (
        <div key={r} style={{ position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${frets}, 1fr)`, borderBottom: r < strings.length - 1 ? '1px solid rgba(255,255,255,.12)' : 'none' }}>
          {/* 현(가로선): 눌린 현이면 진동 */}
          <div
            className={pressedRows.has(r) ? 'gstring-vib' : undefined}
            style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1.4 + (strings.length - r) * 0.35, background: 'rgba(255,255,255,.5)', boxShadow: pressedRows.has(r) ? '0 0 5px rgba(255,255,255,.85)' : 'none', pointerEvents: 'none' }}
          />
          {Array.from({ length: frets }).map((_, c) => {
            const note = transpose(open, c);
            const on = isOn(r, c);
            return (
              <div
                key={c}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRight: c < frets - 1 ? '1px solid rgba(255,255,255,.16)' : 'none',
                  background: on ? 'rgba(120,170,255,.6)' : c === 0 ? 'rgba(255,255,255,.07)' : 'transparent',
                  transition: 'background .06s',
                }}
              >
                <span style={{ fontSize: camFull ? 13 : 9, fontWeight: on ? 800 : 600, color: '#fff', opacity: on ? 1 : 0.72, transform: on ? 'scale(1.25)' : 'none', transition: 'transform .06s', textShadow: '0 1px 3px rgba(0,0,0,.75)' }}>{solfa(note)}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
