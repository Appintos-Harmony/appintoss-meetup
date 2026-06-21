import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Button } from '@toss/tds-mobile';
import type { Route } from '../App';
import { listSongs, deleteSong, type Song } from '../lib/storage';

const chip = (bg: string, color: string): CSSProperties => ({
  border: 0,
  borderRadius: 10,
  padding: '8px 14px',
  fontWeight: 700,
  fontSize: 14,
  background: bg,
  color,
});

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
        <p className="t-body">
          안녕하세요, <b>{nickname}</b>님
        </p>

        {songs.length === 0 ? (
          <div className="card" style={{ marginTop: 12 }}>
            <p className="t-body c-sub">아직 만든 곡이 없어요. 스튜디오에서 첫 곡을 만들어보세요.</p>
          </div>
        ) : (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {songs.slice(0, 3).map((s) => (
              <div key={s.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-body" style={{ fontWeight: 700 }}>{s.name}</div>
                  <div className="t-cap c-sub">{s.events.filter((e) => e.phase === 'on').length}개 코드</div>
                </div>
                <button onClick={() => onOpen(s)} style={chip('var(--blue)', '#fff')}>열기</button>
                <button onClick={() => remove(s.id)} style={chip('var(--bg)', 'var(--sub)')}>삭제</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Button display="full" size="large" onClick={() => go('studio')}>
            스튜디오 열기
          </Button>
          <Button display="full" size="large" variant="weak" color="dark" onClick={() => go('settings')}>
            설정
          </Button>
        </div>
      </div>
    </>
  );
}
