// 구간 반복(루프): 녹음 앞 loopTicks 구간을 잘라 count회 이어붙인다.
// 이벤트 복제 방식이라 저장/공유/재생 결과가 동일하게 일관된다.
import type { ChordEvent } from '../audio/chordReducer';
import { isDrumKey } from '../audio/events';

/**
 * events의 앞 [0, loopTicks) 구간을 단위로 count회 타일링한다.
 * 경계를 넘어 열려 있는 비드럼 노트(코드/멜로디)는 루프 끝(loopTicks-1)에서 off로 닫아 hanging을 막는다.
 * 드럼('drum:*')은 off 없는 원샷이라 닫지 않는다.
 */
export function loopEvents(events: ChordEvent[], loopTicks: number, count: number): ChordEvent[] {
  if (loopTicks <= 0 || count <= 0) return events.map((e) => ({ ...e }));
  const unit = events.filter((e) => e.tick < loopTicks).map((e) => ({ ...e }));
  const open = new Map<string, ChordEvent['source']>();
  for (const e of unit) {
    if (isDrumKey(e.chord)) continue;
    if (e.phase === 'on') open.set(e.chord, e.source);
    else open.delete(e.chord);
  }
  for (const [chord, source] of open) unit.push({ tick: loopTicks - 1, phase: 'off', chord, source });
  const out: ChordEvent[] = [];
  for (let k = 0; k < count; k++) {
    for (const e of unit) out.push({ ...e, tick: e.tick + k * loopTicks });
  }
  return out;
}
