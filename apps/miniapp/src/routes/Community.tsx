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
// 작성자별 고정 시그니처색(같은 사람 곡 = 같은 색) + 이니셜 아바타
const sigOf = (name: string) => SIG[[...(name || '?')].reduce((a, c) => a + c.charCodeAt(0), 0) % SIG.length];
const initialOf = (name: string) => (name || '?').trim().charAt(0) || '?';
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
  const [progress, setProgress] = useState(0); // 재생 진행 0~1
  const [burst, setBurst] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const timers = useRef<number[]>([]);
  const progTimer = useRef<number | null>(null);
  const pausePoll = useRef(0); // 상호작용 직후 폴링이 낙관적 업데이트를 덮지 않도록

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
      if (Date.now() < pausePoll.current) return; // 방금 조작한 항목 보호
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
    if (progTimer.current != null) {
      window.clearInterval(progTimer.current);
      progTimer.current = null;
    }
    allOff();
    setPlayingId(null);
    setProgress(0);
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
    setProgress(0);
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
    const total = last + 400; // 재생 길이(꼬리 포함)
    const start = Date.now();
    progTimer.current = window.setInterval(() => setProgress(Math.min(1, (Date.now() - start) / total)), 90);
    timers.current.push(window.setTimeout(stop, total + 500));
  }

  async function toggleLike(it: FeedItem) {
    const next = !it.liked;
    pausePoll.current = Date.now() + 4000;
    if (next) {
      setBurst(it.id);
      window.setTimeout(() => setBurst(null), 340);
    }
    setItems(
      (cur) =>
        cur && cur.map((x) => (x.id === it.id ? { ...x, liked: next, likesCount: x.likesCount + (next ? 1 : -1) } : x)),
    );
    try {
      const res = await setLike(it.id, next); // 서버 확정값으로 동기화
      setItems((cur) => cur && cur.map((x) => (x.id === it.id ? { ...x, liked: res.liked, likesCount: res.likesCount } : x)));
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
                progress={playingId === it.id ? progress : 0}
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
                  <Card key={it.id} it={it} mine playing={playingId === it.id} progress={playingId === it.id ? progress : 0} onPlay={() => void play(it.id)} onDelete={() => void del(it.id)} />
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
  it, playing, progress = 0, burst, mine, onPlay, onLike, onFork, onReport, onDelete,
}: {
  it: FeedItem;
  playing: boolean;
  progress?: number;
  burst?: boolean;
  mine?: boolean;
  onPlay: () => void;
  onLike?: () => void;
  onFork?: () => void;
  onReport?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className="card fade"
      style={{
        marginBottom: 10,
        padding: 16,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: playing ? 'var(--e2), inset 0 0 0 1.5px var(--blue)' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="track-av" data-playing={playing} style={{ background: sigOf(it.owner), flex: 'none' }}>
          {initialOf(it.owner)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.35, letterSpacing: '-.3px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {it.name}
          </div>
          <div className="t-cap c-sub" style={{ marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {it.owner} · {it.bpm}BPM{it.durationTicks ? ` · ${bars(it.durationTicks)}` : ''}
          </div>
        </div>
        {!mine && (
          <button onClick={onReport} aria-label="신고" style={{ flex: 'none', alignSelf: 'flex-start', border: 0, background: 'transparent', color: 'var(--sub)', fontSize: 18, lineHeight: 1, width: 32, height: 32, borderRadius: 10, cursor: 'pointer' }}>⋯</button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center' }}>
        {/* 주 행동 = 듣기(솔리드 파랑, 재생중 코랄 정지) */}
        <button onClick={onPlay} aria-label={playing ? '정지' : '듣기'} style={{ minHeight: 44, padding: '0 18px', border: 0, borderRadius: 999, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, background: playing ? 'var(--coral)' : 'var(--blue)', color: '#fff', boxShadow: 'var(--e1)' }}>
          {playing ? '■ 정지' : '▶ 듣기'}
        </button>
        {!mine && (
          // 좋아요 = 코랄 토글(♡/♥), 누를 때 beat
          <button onClick={onLike} aria-pressed={it.liked} aria-label={`좋아요 ${it.likesCount}`} style={{ minHeight: 44, padding: '0 16px', border: 0, borderRadius: 999, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, background: it.liked ? '#ffeaea' : 'var(--bg)', color: it.liked ? 'var(--coral)' : 'var(--text-2)' }}>
            <span style={burst ? { display: 'inline-block', animation: 'beat .32s var(--spring)' } : undefined}>{it.liked ? '♥' : '♡'}</span>
            {it.likesCount}
          </button>
        )}
        {!mine && <button onClick={onFork} className="chip" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>얹기</button>}
        {mine && <button onClick={onDelete} className="chip-ghost" style={{ minHeight: 44, padding: '0 16px', border: 0, borderRadius: 999, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginLeft: 'auto' }}>삭제</button>}
      </div>
      {/* 재생 진행바 */}
      {playing && <div style={{ position: 'absolute', left: 0, bottom: 0, height: 3, width: `${Math.round(progress * 100)}%`, background: 'var(--blue)', transition: 'width .12s linear' }} />}
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
