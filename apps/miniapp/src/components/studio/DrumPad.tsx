// 드럼 4분할 터치 패드(SCR-ST-05). 원샷 hit(kick·snare·hat·crash) — onPointerDown 1회.
// 재생/기록은 부모(triggerHit + chordReducer 'hit'). 제스처 드럼킷은 게이트(후속).
import type { CSSProperties } from 'react';
import { DRUM_PIECES } from './chords';
import type { DrumPiece } from '../../audio/events';

export function DrumPad({ onHit, disabled, flash }: { onHit: (piece: DrumPiece) => void; disabled?: boolean; flash?: DrumPiece | null }) {
  return (
    <div className="drum-grid">
      {DRUM_PIECES.map((d) => (
        <button
          key={d.key}
          className="pad"
          data-on={flash === d.key}
          disabled={disabled}
          style={{ ['--accent' as string]: d.color, ['--accent-d' as string]: d.color } as CSSProperties}
          onPointerDown={() => onHit(d.key)}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}
