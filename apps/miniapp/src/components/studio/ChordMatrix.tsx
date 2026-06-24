// 28코드 매트릭스 + 빠른 프리셋(SCR-ST-02). 7행(C~B)×4열(maj/m/7/m7), 최대 6 선택.
// 빈 화면 방지: '기본 팝 4코드' 프리셋을 항상 상단, 매트릭스는 기본 접힘. 선택 순서 보존(제스처 앞4 매핑).
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { ROOTS, QUALITIES, buildChordName, chordColor, MAX_CHORDS } from './chords';

export function ChordMatrix({
  selected,
  onToggle,
  onPreset,
  disabled,
}: {
  selected: string[];
  onToggle: (name: string) => void;
  onPreset: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const full = selected.length >= MAX_CHORDS;

  const grid: CSSProperties = { display: 'grid', gridTemplateColumns: '28px repeat(4, 1fr)', gap: 6, marginBottom: 6 };

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <button className="chip" style={{ fontWeight: 800 }} disabled={disabled} onClick={onPreset}>
          기본 팝 4코드
        </button>
        <button className="chip chip-ghost" style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }} disabled={disabled} onClick={() => setOpen(true)}>
          코드 고르기 ▾
        </button>
      </div>

      {open && (
        <>
          <div className="backdrop" onClick={() => setOpen(false)} />
          <div className="sheet">
            <div className="sheet-grip" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '0 2px' }}>
              <span className="t-title">코드 직접 고르기</span>
              <span className="t-cap" style={{ fontWeight: 800, color: full ? 'var(--coral)' : 'var(--sub)' }}>
                선택 {selected.length}/{MAX_CHORDS}
              </span>
            </div>
            <div style={{ maxHeight: '58vh', overflowY: 'auto', paddingBottom: 4 }}>
              <div style={grid}>
                <span />
                {QUALITIES.map((q) => (
                  <span key={q.key} className="t-cap c-sub" style={{ textAlign: 'center', fontWeight: 700 }}>
                    {q.label}
                  </span>
                ))}
              </div>
              {ROOTS.map((root) => (
                <div key={root} style={grid}>
                  <span className="t-cap c-sub" style={{ alignSelf: 'center', fontWeight: 800 }}>{root}</span>
                  {QUALITIES.map((q, i) => {
                    const name = buildChordName(root, q.key);
                    const idx = selected.indexOf(name);
                    const sel = idx >= 0;
                    const [base] = chordColor(name, idx < 0 ? i : idx);
                    return (
                      <button
                        key={q.key}
                        disabled={disabled}
                        onClick={() => onToggle(name)}
                        style={{
                          border: sel ? `2px solid ${base}` : '1.5px solid var(--line)',
                          background: sel ? base : 'var(--surface)',
                          color: sel ? '#fff' : 'var(--text-2)',
                          borderRadius: 10,
                          padding: '10px 0',
                          fontWeight: 800,
                          fontSize: 13,
                          cursor: 'pointer',
                          minHeight: 44,
                          touchAction: 'manipulation',
                        }}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <button className="btn" style={{ marginTop: 12 }} onClick={() => setOpen(false)}>완료</button>
          </div>
        </>
      )}
    </div>
  );
}
