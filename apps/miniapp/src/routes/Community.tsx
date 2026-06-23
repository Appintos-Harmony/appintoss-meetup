// 커뮤니티 = 음원 공유 보드 + 합 쌓기 + 코멘트(기능명세서 v2). 서버(apps/api) 목록 기반 — 진짜 타인의 공유물.
// 올리기(내 곡 publish) · 들어보기(트랙별 음색 복원) · 가져오기(스튜디오 레이어 로드) · 코멘트(작성/신고) · 출처 크레딧.
// ※ "합 더하기"(가져온 곡에 얹어 origin_code 박고 재공유)는 Studio 경로 변경 필요 → 곽소정 푸시 정합 후. 여기선 '가져오기'까지.
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
import { getUserKey, getNickname } from '../lib/identity';

const SIG = ['#3182f6', '#ff6b6b', '#15c47e', '#8b5cf6', '#ff9f1c'];
function hashIdx(s: string, n: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h) % n;
}

export function Community({ go, onFork }: { go: (r: Route) => void; onFork: (s: Session) => void }) {
  const [items, setItems] = useState<CommunityItem[] | null>(null); // null=로딩
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [busyPreview, setBusyPreview] = useState<string | null>(null);
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
      setItems(await listCommunity(30));
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

  async function importToStudio(code: string) {
    stopPreview();
    try {
      onFork(await getSession(code));
    } catch {
      flash('가져오기 실패 — 잠시 후 다시');
    }
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
        <span onClick={() => { stopPreview(); go('home'); }} style={{ cursor: 'pointer' }}>‹ 홈</span>
        <span style={{ marginLeft: 'auto', fontWeight: 800 }}>커뮤니티</span>
        <button className="chip" style={{ marginLeft: 'auto' }} onClick={() => setPublishOpen((v) => !v)}>＋ 올리기</button>
      </div>

      <div className="content">
        <div className="t-cap c-sub" style={{ marginBottom: 12 }}>
          올리고, 마음에 들면 가져와 내 연주에 얹어보세요. 한마디 코멘트도 남길 수 있어요.
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

        {(items ?? []).map((item) => (
          <div key={item.code} className="card" style={{ marginBottom: 10, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="track-av" style={{ background: SIG[hashIdx(item.code, SIG.length)] }}>{(item.author || '?').slice(0, 1)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t-body" style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.name} <span className="c-sub" style={{ fontWeight: 500 }}>– {item.author}</span>
                </div>
                <div className="t-cap c-sub" style={{ marginTop: 2 }}>
                  트랙 {item.trackCount} · ▶ {item.playCount} · 이어 {item.forkCount}
                </div>
                {item.originCode && (
                  <div className="t-cap c-sub" style={{ marginTop: 2, color: '#8b5cf6' }}>
                    🎵 {item.originAuthor}님의 {item.originName} 위에 쌓음
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <button className="chip chip-ghost" style={{ flex: 1 }} disabled={busyPreview === item.code} onClick={() => void preview(item.code)}>
                {busyPreview === item.code ? '여는 중…' : playing === item.code ? '■ 정지' : '▶ 들어보기'}
              </button>
              <button className="chip" style={{ flex: 1 }} onClick={() => void importToStudio(item.code)}>가져오기</button>
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
        ))}
      </div>

      {toast && (
        <div style={{ position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', background: 'rgba(17,24,39,0.92)', color: '#fff', padding: '8px 16px', borderRadius: 20, fontSize: 13, zIndex: 60 }}>
          {toast}
        </div>
      )}
    </>
  );
}
