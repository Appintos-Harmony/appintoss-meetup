// 커뮤니티 피드 (디자인스펙 기반, theme.css 재사용). 데이터=이벤트 JSON, 실시간=폴링+optimistic.
// 재생은 현 엔진(chordOn/개별음 폴백). 얹기=원본 events 복사 새 세션(fork)+스튜디오 이동.
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Route } from '../App';
import {
  getFeed,
  getPublication,
  setLike,
  report,
  myPublications,
  removePublication,
  type FeedItem,
} from '../lib/community';
import { unlockAudio, chordOn, chordOff, allOff } from '../audio/engine';
import { tickToMs } from '../audio/transport';
import { createSession } from '../lib/share';
import { getNickname } from '../lib/identity';
import type { ChordEvent } from '../audio/chordReducer';

const SIG = ['var(--t-blue)', 'var(--t-coral)', 'var(--t-mint)', 'var(--t-violet)', 'var(--t-amber)'];
const sig = (id: number) => SIG[id % SIG.length];
const bars = (ticks: number | null) => (ticks ? `${Math.max(1, Math.round(ticks / 16))}마디` : '');

type Tab = 'feed' | 'mine';
type Sort = 'recent' | 'popular';

export function Community({ go }: { go: (r: Route) => void }) {
  const [tab, setTab] = useState<Tab>('feed');
  const [sort, setSort] = useState<Sort>('recent');
  const [items, setItems] = useState<FeedItem[] | null>(null); // null = 로딩
  const [error, setError] = useState(false);
  const [mine, setMine] = useState<{ count: number; limit: number; items: FeedItem[] } | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [burst, setBurst] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const timers = useRef<number[]>([]);

  const loadFeed = useCallback(async () => {
    try {
      setError(false);
      setItems(await getFeed(sort));
    } catch {
      setError(true);
    }
  }, [sort]);

  useEffect(() => {
    if (tab === 'feed') {
      setItems(null);
      void loadFeed();
    }
  }, [tab, loadFeed]);

  // 폴링(실시간 느낌) — 피드 탭에서 5s마다 조용히 갱신.
  useEffect(() => {
    if (tab !== 'feed') return;
    const t = window.setInterval(() => {
      getFeed(sort).then(setItems).catch(() => {});
    }, 5000);
    return () => window.clearInterval(t);
  }, [tab, sort]);

  useEffect(() => {
    if (tab === 'mine') {
      setMine(null);
      myPublications()
        .then(setMine)
        .catch(() => setMine({ count: 0, limit: 5, items: [] }));
    }
  }, [tab]);

  const flash = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(''), 1800);
  };

  const stop = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    allOff();
    setPlayingId(null);
  }, []);

  useEffect(() => stop, [stop]); // 언마운트 시 정지

  async function play(id: number) {
    if (playingId === id) return stop();
    stop();
    await unlockAudio();
    let pub;
    try {
      pub = await getPublication(id);
    } catch {
      return flash('재생할 수 없어요');
    }
    setPlayingId(id);
    let last = 0;
    for (const ev of pub.events) {
      const v = ev.chord ?? ev.note;
      if (!v) continue; // 드럼(v2)은 엔진 확장 후
      const at = tickToMs(ev.tick);
      last = Math.max(last, at);
      timers.current.push(
        window.setTimeout(() => {
          if (ev.phase === 'off') chordOff(v);
          else chordOn(v);
        }, at),
      );
    }
    timers.current.push(window.setTimeout(stop, last + 1200));
  }

  async function toggleLike(it: FeedItem) {
    const next = !it.liked;
    if (next) {
      setBurst(it.id);
      window.setTimeout(() => setBurst(null), 340);
    }
    setItems(
      (cur) =>
        cur && cur.map((x) => (x.id === it.id ? { ...x, liked: next, likesCount: x.likesCount + (next ? 1 : -1) } : x)),
    );
    try {
      await setLike(it.id, next);
    } catch (e) {
      setItems((cur) => cur && cur.map((x) => (x.id === it.id ? { ...x, liked: it.liked, likesCount: it.likesCount } : x)));
      flash((e as { status?: number })?.status === 503 ? '잠시 후 다시 시도해 주세요' : '좋아요 실패');
    }
  }

  async function doReport(it: FeedItem) {
    if (!window.confirm(`"${it.name}"을(를) 신고할까요?`)) return;
    try {
      await report(it.id, '부적절');
      flash('신고했어요');
    } catch {
      flash('신고 실패');
    }
  }

  async function fork(it: FeedItem) {
    try {
      const pub = await getPublication(it.id);
      const code = await createSession({
        name: it.name,
        bpm: it.bpm,
        owner: getNickname() || '익명',
        events: pub.events as unknown as ChordEvent[],
      });
      localStorage.setItem('harmony.pendingFork', code); // 스튜디오가 받아 연다(곽소정 연동)
      flash('내 스튜디오로 가져왔어요');
      go('studio');
    } catch {
      flash('가져오기 실패');
    }
  }

  async function del(id: number) {
    if (!window.confirm('이 음원을 삭제할까요?')) return;
    try {
      await removePublication(id);
      setMine((m) => m && { ...m, count: m.count - 1, items: m.items.filter((x) => x.id !== id) });
    } catch {
      flash('삭제 실패');
    }
  }

  return (
    <>
      <div className="appbar">
        <span style={{ cursor: 'pointer', color: 'var(--text-2)' }} onClick={() => go('studio')}>
          ‹ 스튜디오
        </span>
        <span style={{ marginLeft: 12 }}>커뮤니티</span>
      </div>
      <div className="content">
        <div className="segment" style={{ marginBottom: 14 }}>
          <button className="seg" data-on={tab === 'feed'} onClick={() => setTab('feed')}>둘러보기</button>
          <button className="seg" data-on={tab === 'mine'} onClick={() => setTab('mine')}>내 음원</button>
        </div>

        {tab === 'feed' && (
          <>
            <div className="segment" style={{ marginBottom: 14 }}>
              <button className="seg" data-on={sort === 'recent'} onClick={() => setSort('recent')}>최신</button>
              <button className="seg" data-on={sort === 'popular'} onClick={() => setSort('popular')}>인기</button>
            </div>
            {items === null && <Skeleton />}
            {error && <ErrorState onRetry={() => void loadFeed()} />}
            {items && !error && items.length === 0 && <EmptyState onGo={() => go('studio')} />}
            {items?.map((it) => (
              <Card
                key={it.id}
                it={it}
                playing={playingId === it.id}
                burst={burst === it.id}
                onPlay={() => void play(it.id)}
                onLike={() => void toggleLike(it)}
                onFork={() => void fork(it)}
                onReport={() => void doReport(it)}
              />
            ))}
          </>
        )}

        {tab === 'mine' && (
          <>
            {mine === null && <Skeleton />}
            {mine && (
              <>
                <p className="t-cap c-sub" style={{ margin: '2px 0 12px' }}>{mine.count}/{mine.limit} 공개 중</p>
                {mine.items.length === 0 && <EmptyState onGo={() => go('studio')} />}
                {mine.items.map((it) => (
                  <Card key={it.id} it={it} mine playing={playingId === it.id} onPlay={() => void play(it.id)} onDelete={() => void del(it.id)} />
                ))}
              </>
            )}
          </>
        )}
      </div>

      {toast && (
        <div
          className="fade"
          style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--key-dark)', color: '#fff', padding: '10px 16px',
            borderRadius: 999, fontSize: 14, fontWeight: 600, zIndex: 60,
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}

function Card({
  it, playing, burst, mine, onPlay, onLike, onFork, onReport, onDelete,
}: {
  it: FeedItem;
  playing: boolean;
  burst?: boolean;
  mine?: boolean;
  onPlay: () => void;
  onLike?: () => void;
  onFork?: () => void;
  onReport?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
      <div className="track-av" data-playing={playing} style={{ background: sig(it.id) }}>♪</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="t-body" style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {it.name}
        </div>
        <div className="t-cap c-sub">
          {it.owner} · {it.bpm}BPM{it.durationTicks ? ` · ${bars(it.durationTicks)}` : ''}
        </div>
      </div>
      <button className="chip-ghost" onClick={onPlay} aria-label="play">{playing ? '■' : '▶'}</button>
      {!mine && (
        <button
          className="chip"
          onClick={onLike}
          style={it.liked ? { background: '#ffe3e3', color: 'var(--coral)' } : undefined}
        >
          <span style={burst ? { display: 'inline-block', animation: 'beat .32s var(--spring)' } : undefined}>♥</span> {it.likesCount}
        </button>
      )}
      {!mine && <button className="chip-ghost" onClick={onFork}>얹기</button>}
      {!mine && <button className="chip-ghost" onClick={onReport} aria-label="more">⋯</button>}
      {mine && <button className="chip-ghost" onClick={onDelete}>삭제</button>}
    </div>
  );
}

function Skeleton() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} className="card" style={{ height: 76, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--line)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: 14, width: '60%', background: 'var(--line)', borderRadius: 6, marginBottom: 8 }} />
            <div style={{ height: 11, width: '40%', background: 'var(--line-2)', borderRadius: 6 }} />
          </div>
        </div>
      ))}
    </>
  );
}

function EmptyState({ onGo }: { onGo: () => void }) {
  return (
    <div className="card fade" style={{ textAlign: 'center', padding: '36px 18px' }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>🎵</div>
      <p className="t-body" style={{ fontWeight: 700, margin: '0 0 4px' }}>아직 올라온 합주가 없어요</p>
      <p className="t-cap c-sub" style={{ margin: '0 0 16px' }}>첫 연주자가 되어보세요!</p>
      <button className="btn" style={{ maxWidth: 200, margin: '0 auto' }} onClick={onGo}>연주하러 가기</button>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="card fade" style={{ textAlign: 'center', padding: '36px 18px' }}>
      <p className="t-body" style={{ fontWeight: 700, margin: '0 0 12px' }}>앗, 잠시 연결이 끊겼어요</p>
      <button className="btn" style={{ maxWidth: 160, margin: '0 auto' }} onClick={onRetry}>다시 시도</button>
    </div>
  );
}
