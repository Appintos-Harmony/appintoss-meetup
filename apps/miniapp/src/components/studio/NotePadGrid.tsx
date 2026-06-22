// 기타/베이스 계이름 패드 블록(SCR-ST-04). 실제 지판처럼 한 칸 = 반음(크로매틱: 도 도# 레 레#…).
// 입력 경로는 멜로디와 동일(downNote/upNote, kind:'melody') — 콤보(setVoice)로만 기타/베이스 소리.
// frets = 칸 수(일반 6 / 전체화면 13). 칸 음 = 개방현 + 반음*칸(lib/notes.transpose), 라벨 = 계이름(solfa).
import type { CSSProperties } from 'react';
import { STRINGS_GUITAR, STRINGS_BASS } from './chords';
import { transpose, solfa } from '../../lib/notes';

export function NotePadGrid({
  instrument,
  held,
  frets,
  onDown,
  onUp,
}: {
  instrument: 'guitar' | 'bass';
  held: Set<string>;
  frets: number;
  onDown: (note: string, pointerId: number, el: Element) => void;
  onUp: (pointerId: number) => void;
}) {
  // 높은 줄이 위로(기타 표준 표기): 개방현 배열을 역순으로.
  const strings = (instrument === 'guitar' ? STRINGS_GUITAR : STRINGS_BASS).slice().reverse();
  const cols = Array.from({ length: frets }, (_, i) => i); // 0=개방, 이후 반음씩
  const grid: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `48px repeat(${frets}, minmax(40px, 1fr))`,
    gap: 6,
    marginBottom: 6,
  };

  return (
    <div style={{ marginTop: 14, userSelect: 'none', touchAction: 'pan-x', overflowX: 'auto' }}>
      <div style={{ minWidth: 48 + frets * 46 }}>
        {strings.map((open) => (
          <div key={open} style={grid}>
            <div className="t-cap c-sub" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, position: 'sticky', left: 0, background: 'var(--bg)', zIndex: 1 }}>
              {open.replace(/\d/g, '')}
              <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 1 }}>{open.replace(/\D/g, '')}</span>
            </div>
            {cols.map((fret) => {
              const note = transpose(open, fret);
              const on = held.has(note);
              return (
                <button
                  key={fret}
                  onPointerDown={(e) => onDown(note, e.pointerId, e.currentTarget)}
                  onPointerUp={(e) => onUp(e.pointerId)}
                  onPointerCancel={(e) => onUp(e.pointerId)}
                  style={{
                    border: 0,
                    borderRadius: 10,
                    minHeight: 44,
                    fontWeight: 800,
                    fontSize: 13,
                    background: on ? 'var(--blue)' : 'var(--surface)',
                    color: on ? '#fff' : 'var(--text-2)',
                    boxShadow: on ? 'var(--e-inset)' : 'var(--e2)',
                    touchAction: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {solfa(note)}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
