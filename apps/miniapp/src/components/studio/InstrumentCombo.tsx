// 악기/스타일 연동 콤보(SCR-ST-00). 항상 표시. 악기는 본문 레이아웃을 바꾸고, 스타일은 화면 동일·소리만.
// 둘 다 onPick → 부모가 engine.setVoice(instrument, style)로 수렴. 디자인=theme.css(.chip/.sheet) 재사용.
// inline=true: 래퍼 행 없이 칩 2개만(상단 설정 칩바에 같이 묶을 때).
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { INSTRUMENTS, STYLE_OPTIONS } from './chords';
import type { Instrument } from '../../audio/events';

export function InstrumentCombo({
  instrument,
  style,
  disabled,
  inline,
  onPick,
}: {
  instrument: Instrument;
  style: string;
  disabled?: boolean;
  inline?: boolean;
  onPick: (instrument: Instrument, style: string) => void;
}) {
  const [sheet, setSheet] = useState<'instrument' | 'style' | null>(null);
  const styleOpts = STYLE_OPTIONS[instrument];
  const instMeta = INSTRUMENTS.find((i) => i.key === instrument);
  const styleLabel = styleOpts.find((s) => s.key === style)?.label ?? styleOpts[0].label;

  function pickInstrument(next: Instrument) {
    onPick(next, STYLE_OPTIONS[next][0].key); // 악기 바꾸면 스타일 첫 값으로 리셋
    setSheet(null);
  }
  function pickStyle(next: string) {
    onPick(instrument, next);
    setSheet(null);
  }

  const comboBtn: CSSProperties = inline
    ? { flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '9px 6px', whiteSpace: 'nowrap', opacity: disabled ? 0.5 : 1 }
    : { flex: 1, justifyContent: 'space-between', display: 'flex', alignItems: 'center', opacity: disabled ? 0.5 : 1 };

  const chips = (
    <>
      <button className="chip chip-ghost" style={comboBtn} disabled={disabled} onClick={() => setSheet('instrument')}>
        <span>{instMeta?.emoji} {instMeta?.label}</span>
        <span aria-hidden style={{ opacity: 0.5 }}>▾</span>
      </button>
      <button className="chip chip-ghost" style={comboBtn} disabled={disabled} onClick={() => setSheet('style')}>
        <span>{styleLabel}</span>
        <span aria-hidden style={{ opacity: 0.5 }}>▾</span>
      </button>
    </>
  );

  return (
    <>
      {inline ? chips : <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>{chips}</div>}

      {sheet === 'instrument' && (
        <>
          <div className="backdrop" onClick={() => setSheet(null)} />
          <div className="sheet">
            <div className="sheet-grip" />
            <div className="t-title" style={{ padding: '4px 6px 8px' }}>악기 고르기</div>
            {INSTRUMENTS.map((i) => (
              <button key={i.key} className="sheet-row pick" data-on={instrument === i.key} onClick={() => pickInstrument(i.key)}>
                <span style={{ fontSize: 26, justifySelf: 'center' }}>{i.emoji}</span>
                <span className="t-body pick-label" style={{ fontWeight: 600 }}>{i.label}</span>
                <span className="pick-check" style={{ visibility: instrument === i.key ? 'visible' : 'hidden' }}>✓</span>
              </button>
            ))}
          </div>
        </>
      )}

      {sheet === 'style' && (
        <>
          <div className="backdrop" onClick={() => setSheet(null)} />
          <div className="sheet">
            <div className="sheet-grip" />
            <div className="t-title" style={{ padding: '4px 6px 8px' }}>{instMeta?.label} 스타일</div>
            {styleOpts.map((s) => (
              <button key={s.key} className="sheet-row pick" data-on={style === s.key} onClick={() => pickStyle(s.key)}>
                <span />
                <span className="t-body pick-label" style={{ fontWeight: 600 }}>{s.label}</span>
                <span className="pick-check" style={{ visibility: style === s.key ? 'visible' : 'hidden' }}>✓</span>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
