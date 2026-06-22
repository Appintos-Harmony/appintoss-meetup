import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { Route } from '../App';
import { listSongs, songTracks, type Song } from '../lib/storage';
import { isChordName } from '../audio/tuning';

const CHORD_COLOR: Record<string, string> = { C: '#3182f6', Am: '#8b5cf6', F: '#15c47e', G: '#ff6b6b' };

// 홈 = 얇은 디스패처 허브(DEBATE-013). 콘텐츠/편집 UI 없이 스튜디오·커뮤니티로 '보내기'
// + 이어하기(최근곡 읽기 전용) + 설정 진입. (개발자 모드 토글은 설정으로 이동)
export function Home({
  nickname,
  go,
  onOpen,
}: {
  nickname: string;
  go: (r: Route) => void;
  onOpen: (s: Song) => void;
}) {
  const [songs] = useState<Song[]>(() => listSongs());
  const empty = songs.length === 0;

  const entryCard = (accent: boolean): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    textAlign: 'left',
    font: 'inherit',
    color: 'var(--text)',
    background: accent ? 'var(--blue-weak, #eaf1ff)' : 'var(--surface)',
    border: accent ? '2px solid var(--blue)' : '0.5px solid var(--line-2)',
    borderRadius: 'var(--r-xl)',
    padding: 16,
    boxShadow: 'var(--e1)',
    cursor: 'pointer',
  });

  return (
    <>
      <div className="appbar">
        하모니
        <span style={{ marginLeft: 'auto', fontSize: 20, cursor: 'pointer' }} onClick={() => go('settings')} aria-label="설정" role="button">
          ⚙️
        </span>
      </div>
      <div className="content fade">
        <h1 className="t-title" style={{ marginTop: 4 }}>안녕하세요, {nickname}님 👋</h1>
        <p className="t-body c-sub2" style={{ marginTop: 4 }}>{empty ? '첫 트랙을 녹음해볼까요?' : '이어서 만들어볼까요?'}</p>

        <button style={{ ...entryCard(empty), marginTop: 18 }} onClick={() => go('studio')}>
          <span style={{ fontSize: 26 }}>🎹</span>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontWeight: 700 }}>스튜디오</span>
            <span className="t-cap c-sub" style={{ display: 'block' }}>새 곡 만들기 · 트랙 녹음</span>
          </span>
          <span className="c-sub" style={{ fontSize: 18 }}>›</span>
        </button>

        <button style={{ ...entryCard(false), marginTop: 12 }} onClick={() => go('community')}>
          <span style={{ fontSize: 26 }}>🎧</span>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontWeight: 700 }}>커뮤니티</span>
            <span className="t-cap c-sub" style={{ display: 'block' }}>다른 사람 곡에 얹기 · 둘러보기</span>
          </span>
          <span className="c-sub" style={{ fontSize: 18 }}>›</span>
        </button>

        <div className="t-cap c-sub" style={{ fontWeight: 700, margin: '24px 4px 10px' }}>이어하기</div>
        {empty ? (
          <div className="card" style={{ textAlign: 'center', padding: '28px 18px' }}>
            <div style={{ fontSize: 34 }}>🎵</div>
            <p className="t-body c-sub" style={{ marginTop: 8 }}>
              아직 녹음한 곡이 없어요.
              <br />
              스튜디오에서 첫 곡을 만들어보세요.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {songs.slice(0, 3).map((s) => {
              const onVals = songTracks(s).flatMap((t) => t.events).filter((e) => e.phase === 'on').map((e) => e.chord);
              const chords = [...new Set(onVals.filter(isChordName))]; // 코드만 색칩
              const hasMelody = onVals.some((v) => !isChordName(v)); // 멜로디(개별음)는 배지로
              return (
                <button
                  key={s.id}
                  onClick={() => onOpen(s)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    textAlign: 'left',
                    font: 'inherit',
                    color: 'var(--text)',
                    background: 'var(--surface)',
                    border: '0.5px solid var(--line-2)',
                    borderRadius: 'var(--r-lg, 14px)',
                    padding: '12px 14px',
                    boxShadow: 'var(--e1)',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 700 }}>{s.name}</span>
                    <span style={{ display: 'flex', gap: 5, marginTop: 7, flexWrap: 'wrap' }}>
                      {chords.length === 0 && !hasMelody && <span className="t-cap c-sub">빈 곡</span>}
                      {chords.slice(0, 6).map((c, i) => (
                        <span key={i} style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: CHORD_COLOR[c] ?? '#8b95a1', borderRadius: 6, padding: '2px 7px' }}>
                          {c}
                        </span>
                      ))}
                      {hasMelody && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', background: 'var(--bg)', borderRadius: 6, padding: '2px 7px' }}>🎵 멜로디</span>}
                    </span>
                  </span>
                  <span className="c-sub" style={{ fontSize: 18 }}>›</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
