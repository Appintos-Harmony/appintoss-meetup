import type { CSSProperties } from 'react';
import type { Instrument } from '../../audio/events';
import { INSTRUMENT_EMOJI } from './chords';

// 악기 아이콘. 베이스는 전용 이모지가 없어 🎻(바이올린·활)로 잘못 보였다 → 활 없는 베이스 기타 실루엣 SVG로 대체.
// 나머지 악기는 그대로 이모지. SVG는 currentColor라 칩/시트/카드의 글자색을 따른다.
export function InstrumentIcon({ instrument, size = 16, style }: { instrument: Instrument; size?: number; style?: CSSProperties }) {
  if (instrument === 'bass') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="베이스" style={{ display: 'inline-block', verticalAlign: '-0.16em', flex: 'none', ...style }}>
        <ellipse cx="7.6" cy="16" rx="5.2" ry="4.1" fill="currentColor" transform="rotate(-18 7.6 16)" />
        <path d="M10 13.4 L20 3.4 L22 1.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="21" cy="2.7" r="1.05" fill="currentColor" />
        <circle cx="19.1" cy="4.6" r="1.05" fill="currentColor" />
      </svg>
    );
  }
  return <span aria-hidden="true" style={{ fontSize: size, ...style }}>{INSTRUMENT_EMOJI[instrument]}</span>;
}
