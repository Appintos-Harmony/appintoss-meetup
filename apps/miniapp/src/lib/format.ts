// ms → 'm:ss' 표시 포매터(재생바·미리듣기 공용). 음수는 0으로 클램프.
// rounding: 호출부별 기존 동작 보존 — 스튜디오 재생바는 'round'(반올림), 커뮤니티 미리듣기는 'floor'(내림).
export function formatMmSs(ms: number, rounding: 'round' | 'floor' = 'round'): string {
  const s = Math.max(0, (rounding === 'floor' ? Math.floor : Math.round)(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
