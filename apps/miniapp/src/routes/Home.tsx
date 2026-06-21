import { useState } from 'react';
import { Button } from '@toss/tds-mobile';
import type { Route } from '../App';
import { listSongs, deleteSong, type Song } from '../lib/storage';

const CHORD_COLOR: Record<string, string> = { C: '#3182f6', Am: '#8b5cf6', F: '#15c47e', G: '#ff6b6b' };

export function Home({
  nickname,
  go,
  onOpen,
}: {
  nickname: string;
  go: (r: Route) => void;
  onOpen: (s: Song) => void;
}) {
  const [songs, setSongs] = useState<Song[]>(() => listSongs());

  function remove(id: string) {
    deleteSong(id);
    setSongs(listSongs());
  }

  return (
    <>
      <div className="appbar">하모니</div>
      <div className="content fade">
        <h1 className="t-title" style={{ marginTop: 4 }}>
          안녕하세요, {nickname}님 👋
        </h1>
        <p className="t-body c-sub2" style={{ marginTop: 4 }}>오늘은 어떤 곡을 만들어볼까요?</p>

        <div style={{ marginTop: 18 }}>
          <Button display="full" size="xlarge" onClick={() => go('studio')}>
            🎹 스튜디오 열기
          </Button>
        </div>

        <div className="t-cap c-sub" style={{ fontWeight: 700, margin: '24px 4px 10px' }}>최근 곡</div>
        {songs.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '34px 18px' }}>
            <div style={{ fontSize: 38 }}>🎵</div>
            <p className="t-body c-sub" style={{ marginTop: 10 }}>
              아직 만든 곡이 없어요.
              <br />
              스튜디오에서 첫 곡을 만들어보세요.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {songs.slice(0, 3).map((s) => {
              const chords = [...new Set(s.events.filter((e) => e.phase === 'on').map((e) => e.chord))];
              return (
                <div key={s.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t-body" style={{ fontWeight: 700 }}>{s.name}</div>
                    <div style={{ display: 'flex', gap: 5, marginTop: 7, flexWrap: 'wrap' }}>
                      {chords.length === 0 && <span className="t-cap c-sub">빈 곡</span>}
                      {chords.slice(0, 6).map((c, i) => (
                        <span
                          key={i}
                          style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: CHORD_COLOR[c] ?? '#8b95a1', borderRadius: 6, padding: '2px 7px' }}
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button className="chip" onClick={() => onOpen(s)}>열기</button>
                  <button className="chip chip-ghost" onClick={() => remove(s.id)}>삭제</button>
                </div>
              );
            })}
          </div>
        )}

        <button
          className="btn"
          style={{ marginTop: 20, background: 'var(--surface)', color: 'var(--text-2)', boxShadow: 'var(--e1)' }}
          onClick={() => go('settings')}
        >
          설정
        </button>
      </div>
    </>
  );
}
