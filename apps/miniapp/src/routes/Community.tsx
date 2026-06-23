// 커뮤니티 = 음원 공유 보드(서버 listCommunity 기반 — 진짜 타인의 공유물) + 곽소정 UI(이모지 아바타·카드·들어보기·담기 다중·좋아요) 보존.
// 베이스 = 곽소정 her_Community.tsx(이모지/좋아요/담기/들어보기 UI 그대로). 데이터 소스만 로컬(PRELOAD+listSongs) → 서버 listCommunity()로 전환,
//   트랙(events)이 필요한 지점(들어보기·담기)은 getSession(code)로 lazy 확보해 동일 동작 재배선.
// 비파괴 추가(내 서버 기능): 댓글(작성/신고) · 출처 크레딧 · 3상태(로딩/빈/실패) · 내 곡 올리기(publishSession) · toast/busy 피드백.
// ※ 좋아요는 스펙 v2상 '비범위'지만 곽소정 작업물 보존 원칙으로 로컬(likes.ts) 방식 그대로 유지(삭제 금지). changeNotes 참고.
// ※ 이 파일은 곽소정 브랜치가 함께 가져오는 ../lib/likes 와 ../lib/identity 의 getEmoji/EMOJI_CHOICES 에 의존한다(현 develop 트리엔 부재 → 머지 시 동반 필수).
import { useEffect, useRef, useState } from 'react';
import type { Route } from '../App';
import {
  type Session, type CommunityItem, type Comment,
  listCommunity, publishSession, getSession, addTrack, getComments, addComment, reportComment,
} from '../lib/share';
import { listSongs, songTracks } from '../lib/storage';
import { unlockAudio, createVoice, type Voice } from '../audio/engine';
import { normalizeEvents } from '../audio/events';
import { tickToMs } from '../audio/transport';
import { getUserKey, getNickname, getEmoji, EMOJI_CHOICES } from '../lib/identity';
import { isLiked, toggleLike, baseLikes } from '../lib/likes';

const SIG = ['#3182f6', '#ff6b6b', '#15c47e', '#8b5cf6', '#ff9f1c'];
function hashIdx(s: string, n: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h) % n;
}

// 곽소정 이모지 아바타(보존) — 서버 항목엔 mine/id가 없으므로 키를 item.code로, 내 곡 여부는 author===닉네임으로 근사.
function ownerEmoji(item: CommunityItem): string {
  const nick = getNickname();
  if (nick && item.author === nick) return getEmoji();
  return EMOJI_CHOICES[hashIdx(item.code, EMOJI_CHOICES.length)];
}

export function Community({ go, onFork }: { go: (r: Route) => void; onFork: (s: Session) => void }) {
  const [items, setItems] = useState<CommunityItem[] | null>(null); // null=로딩
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [busyPreview, setBusyPreview] = useState<string | null>(null);
  const [picks, setPicks] = useState<Set<string>>(() => new Set());
  const [importing, setImporting] = useState(false);
  const [likes, setLikes] = useState<Record<string, { liked: boolean; count: number }>>({});
  const [openCode, setOpenCode] = useState<string | null>(null); // 댓글 펼친 카드
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [commentText, setCommentText] = useState('');
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const voicesRef = useRef<Voice[]>([]);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    void load();
    return () => stopPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function flash(m: string) {
    setToast(m);
    window.setTimeout(() => setToast(''), 1800);
  }

  async function load() {
    setItems(null);
    setError(false);
    try {
      const list = await listCommunity(30);
      setItems(list);
      // 좋아요 맵을 서버 목록(code 키)으로 구성 — 로컬 likes.ts 방식 유지.
      const m: Record<string, { liked: boolean; count: number }> = {};
      for (const it of list) {
        const liked = isLiked(it.code);
        m[it.code] = { liked, count: baseLikes(it.code) + (liked ? 1 : 0) };
      }
      setLikes(m);
    } catch {
      setError(true);
      setItems([]);
    }
  }

  function stopPreview() {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
    voicesRef.current.forEach((v) => v.dispose());
    voicesRef.current = [];
    setPlaying(null);
  }

  // 들어보기(곽소정 ▶/■ 토글 UI 그대로) — 데이터만 getSession(code)로 확보 후 트랙별 음색 복원 재생.
  async function preview(code: string) {
    if (playing === code) { stopPreview(); return; }
    stopPreview();
    setBusyPreview(code);
    let session: Session;
    try {
      session = await getSession(code);
    } catch {
      setBusyPreview(null);
      flash('음원을 불러오지 못했어요');
      return;
    }
    setBusyPreview(null);
    if (!session.tracks.length) { flash('재생할 내용이 없어요'); return; }
    await unlockAudio();
    const voices: Voice[] = [];
    let maxMs = 0;
    for (const track of session.tracks) {
      const voice = createVoice(track.instrument ?? 'piano', track.style ?? 'grand');
      voices.push(voice);
      for (const ev of normalizeEvents(track.events)) {
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
    }
    voicesRef.current = voices;
    timersRef.current.push(window.setTimeout(() => stopPreview(), maxMs + 800));
    setPlaying(code);
  }

  function togglePick(code: string) {
    setPicks((p) => {
      const n = new Set(p);
      if (n.has(code)) n.delete(code);
      else n.add(code);
      return n;
    });
  }

  // 담기(다중) — 곽소정 합본 의도(여러 곡의 트랙을 하나의 로컬 합본 세션으로 스튜디오에 적재) 그대로.
  //   서버 항목엔 tracks가 없으므로 선택한 각 code를 getSession으로 확보(Promise.all) 후 트랙을 합쳐 onFork.
  async function importPicks() {
    if (picks.size === 0 || importing) return;
    stopPreview();
    setImporting(true);
    const codes = [...picks];
    try {
      const sessions = await Promise.all(codes.map((c) => getSession(c)));
      const tracks = sessions.flatMap((s) => s.tracks);
      if (!tracks.length) { flash('가져올 트랙이 없어요'); return; }
      // 단일 가져오기 = 그 곡 위에 쌓기 → 서버 code 보존(스튜디오 '커뮤니티에 올리기'가 origin_code로 사용, 출처 강제).
      // 다중 담기 = 재료 합본(LOCAL, 출처 없음).
      if (sessions.length === 1 && sessions[0]) {
        onFork(sessions[0]);
      } else {
        const bpm = sessions[0]?.bpm ?? 100;
        onFork({ code: 'LOCAL-import', name: `가져온 음원 ${sessions.length}개`, bpm, tracks });
      }
    } catch {
      flash('가져오기 실패 — 잠시 후 다시');
    } finally {
      setImporting(false);
    }
  }

  // 좋아요(곽소정 로컬 하트) — 키를 item.code로. likes.ts 방식 그대로 유지.
  function like(code: string) {
    const liked = toggleLike(code);
    setLikes((m) => ({ ...m, [code]: { liked, count: (m[code]?.count ?? baseLikes(code)) + (liked ? 1 : -1) } }));
  }

  async function toggleComments(code: string) {
    if (openCode === code) { setOpenCode(null); return; }
    setOpenCode(code);
    setComments(null);
    try {
      setComments(await getComments(code));
    } catch {
      setComments([]);
    }
  }

  async function submitComment(code: string) {
    const text = commentText.trim();
    if (!text) return;
    try {
      const key = await getUserKey();
      await addComment(code, text, getNickname() ?? '익명', key);
      setCommentText('');
      setComments(await getComments(code));
      setItems((arr) => (arr ? arr.map((it) => (it.code === code ? { ...it, commentCount: it.commentCount + 1 } : it)) : arr));
    } catch {
      flash('댓글 전송 실패');
    }
  }

  async function report(code: string, id: number) {
    try {
      const key = await getUserKey();
      await reportComment(code, id, key);
      setComments((c) => (c ? c.filter((x) => x.id !== id) : c));
      flash('신고 접수됐어요');
    } catch {
      flash('신고 실패');
    }
  }

  async function publish(song: { id: string; name: string; bpm: number }) {
    setPublishing(song.id);
    try {
      const tracks = songTracks(song as never);
      if (!tracks.length) { flash('빈 곡은 올릴 수 없어요'); return; }
      const key = await getUserKey();
      const nick = getNickname() ?? '익명';
      const first = tracks[0]!;
      const code = await publishSession({
        name: song.name, bpm: song.bpm, owner: nick, author: nick, authorKey: key,
        events: first.events, instrument: first.instrument, style: first.style,
        idempotencyToken: crypto.randomUUID(),
      });
      for (const t of tracks.slice(1)) await addTrack(code, nick, t.events, t.instrument, t.style);
      setPublishOpen(false);
      flash('보드에 올라갔어요');
      await load();
    } catch {
      flash('공유 실패 — 네트워크 확인');
    } finally {
      setPublishing(null);
    }
  }

  const myShongs = listSongs();

  return (
    <>
      <div className="appbar">
        <span onClick={() => { stopPreview(); go('studio'); }} style={{ cursor: 'pointer' }}>‹ 스튜디오</span>
        <span style={{ marginLeft: 'auto', fontWeight: 800 }}>커뮤니티</span>
        <button className="chip" style={{ marginLeft: 'auto' }} onClick={() => setPublishOpen((v) => !v)}>＋ 올리기</button>
      </div>

      <div className="content" style={{ paddingBottom: picks.size > 0 ? 92 : undefined }}>
        <div className="t-cap c-sub" style={{ marginBottom: 12 }}>
          마음에 드는 음원을 담아(여러 개 OK) 가져오면 내 스튜디오에 레이어로 올라가요. 들어보고 좋아요·한마디 코멘트도!
        </div>

        {publishOpen && (
          <div className="card" style={{ marginBottom: 12, padding: 14 }}>
            <div className="t-body" style={{ fontWeight: 700, marginBottom: 8 }}>내 곡 올리기</div>
            {myShongs.length === 0 && <div className="t-cap c-sub">아직 녹음한 곡이 없어요 — 스튜디오에서 먼저 녹음하세요.</div>}
            {myShongs.map((s) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                <div className="t-body" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                <button className="chip" disabled={publishing === s.id} onClick={() => void publish(s)}>
                  {publishing === s.id ? '올리는 중…' : '올리기'}
                </button>
              </div>
            ))}
          </div>
        )}

        {items === null && <div className="t-cap c-sub" style={{ textAlign: 'center', padding: 24 }}>불러오는 중…</div>}
        {items !== null && error && (
          <div className="t-cap c-sub" style={{ textAlign: 'center', padding: 24 }}>
            불러오지 못했어요. <button className="chip chip-ghost" onClick={() => void load()}>다시 시도</button>
          </div>
        )}
        {items !== null && !error && items.length === 0 && (
          <div className="t-cap c-sub" style={{ textAlign: 'center', padding: 24 }}>
            아직 음원이 없어요 — 첫 곡의 주인공이 되어보세요.
            <div style={{ marginTop: 10 }}><button className="chip" onClick={() => go('studio')}>스튜디오로</button></div>
          </div>
        )}

        {(items ?? []).map((item) => {
          const lk = likes[item.code] ?? { liked: false, count: baseLikes(item.code) };
          const picked = picks.has(item.code);
          return (
            <div
              key={item.code}
              className="card"
              style={{ marginBottom: 10, padding: 14, border: picked ? '2px solid var(--blue)' : '2px solid transparent', background: picked ? 'var(--blue-weak)' : undefined }}
            >
              {/* 상단: 이모지 아바타(곽소정) + 음원명·닉네임·메타 + 출처 크레딧 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 44, height: 44, borderRadius: '50%', background: SIG[hashIdx(item.code, SIG.length)] + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flex: 'none' }}>
                  {ownerEmoji(item)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-body" style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name} <span className="c-sub" style={{ fontWeight: 500 }}>– {item.author}</span>
                  </div>
                  <div className="t-cap c-sub" style={{ marginTop: 2 }}>
                    트랙 {item.trackCount}개 · ▶ {item.playCount} · 이어 {item.forkCount}
                  </div>
                  {item.originCode && (
                    <div className="t-cap c-sub" style={{ marginTop: 2, color: '#8b5cf6' }}>
                      🎵 {item.originAuthor}님의 {item.originName} 위에 쌓음
                    </div>
                  )}
                </div>
              </div>
              {/* 하단: 들어보기 / 담기(선택) / 좋아요 / 댓글 — 곽소정 3버튼 + 댓글 칩(비파괴 추가) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                <button className="chip chip-ghost" style={{ flex: 1 }} disabled={busyPreview === item.code} onClick={() => void preview(item.code)}>
                  {busyPreview === item.code ? '여는 중…' : playing === item.code ? '■ 정지' : '▶ 들어보기'}
                </button>
                <button
                  className="chip"
                  style={{ flex: 1, background: picked ? 'var(--blue)' : undefined, color: picked ? '#fff' : undefined }}
                  onClick={() => togglePick(item.code)}
                >
                  {picked ? '✓ 담음' : '＋ 담기'}
                </button>
                <button
                  className="chip chip-ghost"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, color: lk.liked ? 'var(--coral)' : 'var(--text-2)', background: lk.liked ? '#ffecec' : 'var(--bg)' }}
                  onClick={() => like(item.code)}
                >
                  <span style={{ fontSize: 15 }}>{lk.liked ? '❤️' : '🤍'}</span>
                  <span style={{ fontWeight: 800 }}>{lk.count}</span>
                </button>
                <button className="chip chip-ghost" onClick={() => void toggleComments(item.code)}>💬 {item.commentCount}</button>
              </div>

              {openCode === item.code && (
                <div style={{ marginTop: 12, borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 10 }}>
                  {comments === null && <div className="t-cap c-sub">댓글 불러오는 중…</div>}
                  {comments !== null && comments.length === 0 && <div className="t-cap c-sub">첫 코멘트를 남겨보세요.</div>}
                  {(comments ?? []).map((c) => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span className="t-cap" style={{ fontWeight: 700 }}>{c.author}</span>{' '}
                        <span className="t-cap c-sub">{c.text}</span>
                      </div>
                      <button className="chip chip-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => void report(item.code, c.id)}>신고</button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <input
                      value={commentText}
                      maxLength={200}
                      placeholder="한마디 남기기"
                      onChange={(e) => setCommentText(e.target.value)}
                      style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)', fontSize: 14 }}
                    />
                    <button className="chip" onClick={() => void submitComment(item.code)}>보내기</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 다중 가져오기 바(곽소정) — getSession 합본 직렬화 중엔 비활성/표시 */}
      {picks.size > 0 && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40, maxWidth: 480, margin: '0 auto', padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', background: 'var(--surface)', boxShadow: '0 -6px 20px rgba(17,24,39,.10)' }}>
          <button className="btn" style={{ background: 'var(--blue)', color: '#fff' }} disabled={importing} onClick={() => void importPicks()}>
            {importing ? '여는 중…' : `🎚 가져오기 (${picks.size}개) → 스튜디오에 얹기`}
          </button>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', background: 'rgba(17,24,39,0.92)', color: '#fff', padding: '8px 16px', borderRadius: 20, fontSize: 13, zIndex: 60 }}>
          {toast}
        </div>
      )}
    </>
  );
}
