// 커뮤니티(음원 게시판). 이모지 프로필 아바타 + 음원명·닉네임·길이 + 들어보기/가져오기/좋아요(개수).
// 좋아요는 로컬(데모) — networked 집계는 후속. fork = 트랙을 스튜디오로 복사해 얹기.
import { useRef, useState } from 'react';
import type { Route } from '../App';
import { PRELOAD, type Session } from '../lib/share';
import { listSongs, songTracks } from '../lib/storage';
import { unlockAudio, createVoice, type Voice } from '../audio/engine';
import { normalizeEvents, type ChordEvent } from '../audio/events';
import { tickToMs } from '../audio/transport';
import { getEmoji, getNickname, EMOJI_CHOICES } from '../lib/identity';
import { isLiked, toggleLike, baseLikes } from '../lib/likes';

interface CommunityItem {
  id: string;
  title: string;
  owner: string;
  mine: boolean;
  events: ChordEvent[];
  session: Session;
}

function buildItems(): CommunityItem[] {
  const items: CommunityItem[] = [];
  const p = PRELOAD.tracks[0];
  if (p) items.push({ id: 'preload', title: PRELOAD.name, owner: p.owner, mine: false, events: p.events, session: PRELOAD });
  for (const s of listSongs()) {
    const tks = songTracks(s);
    items.push({
      id: s.id,
      title: s.name,
      owner: '나',
      mine: true,
      events: tks.flatMap((t) => t.events),
      session: { code: 'LOCAL-' + s.id, name: s.name, bpm: s.bpm, tracks: tks },
    });
  }
  return items;
}

function lengthSec(events: ChordEvent[]): number {
  const maxTick = events.reduce((m, e) => Math.max(m, e.tick), 0);
  return Math.max(1, Math.round(tickToMs(maxTick) / 1000));
}

const SIG = ['#3182f6', '#ff6b6b', '#15c47e', '#8b5cf6', '#ff9f1c'];
function hashIdx(id: string, n: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return Math.abs(h) % n;
}
function ownerEmoji(item: CommunityItem): string {
  if (item.mine) return getEmoji();
  if (item.id === 'preload') return '🎸';
  return EMOJI_CHOICES[hashIdx(item.id, EMOJI_CHOICES.length)];
}
function nicknameOf(item: CommunityItem): string {
  return item.mine ? getNickname() || '나' : item.owner;
}

export function Community({ go, onFork }: { go: (r: Route) => void; onFork: (s: Session) => void }) {
  const [items] = useState<CommunityItem[]>(() => buildItems());
  const [playing, setPlaying] = useState<string | null>(null);
  const [likes, setLikes] = useState<Record<string, { liked: boolean; count: number }>>(() => {
    const m: Record<string, { liked: boolean; count: number }> = {};
    for (const it of buildItems()) {
      const liked = isLiked(it.id);
      m[it.id] = { liked, count: baseLikes(it.id) + (liked ? 1 : 0) };
    }
    return m;
  });
  const voiceRef = useRef<Voice | null>(null);
  const timersRef = useRef<number[]>([]);

  function stopPreview() {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
    voiceRef.current?.dispose();
    voiceRef.current = null;
    setPlaying(null);
  }

  async function preview(item: CommunityItem) {
    if (playing === item.id) {
      stopPreview();
      return;
    }
    stopPreview();
    await unlockAudio();
    const voice = createVoice('piano', 'grand');
    voiceRef.current = voice;
    let maxMs = 0;
    for (const ev of normalizeEvents(item.events)) {
      const ms = tickToMs(ev.tick);
      if (ms > maxMs) maxMs = ms;
      const id = window.setTimeout(() => {
        if (ev.kind === 'drum') voice.hit(ev.piece);
        else if (ev.kind === 'melody') {
          if (ev.phase === 'on') voice.on(ev.note);
          else voice.off(ev.note);
        } else {
          if (ev.phase === 'on') voice.on(ev.chord);
          else voice.off(ev.chord);
        }
      }, ms);
      timersRef.current.push(id);
    }
    timersRef.current.push(window.setTimeout(() => stopPreview(), maxMs + 800));
    setPlaying(item.id);
  }

  function fork(item: CommunityItem) {
    stopPreview();
    onFork(item.session);
  }

  function like(id: string) {
    const liked = toggleLike(id);
    setLikes((m) => ({ ...m, [id]: { liked, count: (m[id]?.count ?? baseLikes(id)) + (liked ? 1 : -1) } }));
  }

  return (
    <>
      <div className="appbar">
        <span onClick={() => { stopPreview(); go('studio'); }} style={{ cursor: 'pointer' }}>‹ 스튜디오</span>
        <span style={{ marginLeft: 'auto', fontWeight: 800 }}>커뮤니티</span>
      </div>

      <div className="content">
        <div className="t-cap c-sub" style={{ marginBottom: 12 }}>
          다른 사람 음원을 들어보고 좋아요·가져와 내 연주에 얹어보세요.
        </div>

        {items.map((item, i) => {
          const lk = likes[item.id] ?? { liked: false, count: baseLikes(item.id) };
          return (
            <div key={item.id} className="card" style={{ marginBottom: 10, padding: 14 }}>
              {/* 상단: 아바타 + 음원명·닉네임·길이 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 44, height: 44, borderRadius: '50%', background: SIG[i % SIG.length] + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flex: 'none' }}>
                  {ownerEmoji(item)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-body" style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title} <span className="c-sub" style={{ fontWeight: 500 }}>– {nicknameOf(item)}</span>
                  </div>
                  <div className="t-cap c-sub" style={{ marginTop: 2 }}>약 {lengthSec(item.events)}초</div>
                </div>
              </div>
              {/* 하단: 들어보기 / 가져오기 / 좋아요 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                <button className="chip chip-ghost" style={{ flex: 1 }} onClick={() => void preview(item)}>
                  {playing === item.id ? '■ 정지' : '▶ 들어보기'}
                </button>
                <button className="chip" style={{ flex: 1 }} onClick={() => fork(item)}>가져오기</button>
                <button
                  className="chip chip-ghost"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, color: lk.liked ? 'var(--coral)' : 'var(--text-2)', background: lk.liked ? '#ffecec' : 'var(--bg)' }}
                  onClick={() => like(item.id)}
                >
                  <span style={{ fontSize: 15 }}>{lk.liked ? '❤️' : '🤍'}</span>
                  <span style={{ fontWeight: 800 }}>{lk.count}</span>
                </button>
              </div>
            </div>
          );
        })}

        {items.length === 0 && <div className="t-cap c-sub" style={{ textAlign: 'center', padding: 24 }}>아직 음원이 없어요</div>}
      </div>
    </>
  );
}
