// 커뮤니티(음원 게시판) 진입 스캐폴드(SCR-ST-06). 본체 페이지는 조장(이상혁) 구현 예정.
// 여기서는 데모 목록 + 들어보기 + 가져오기(fork)만 — fork = 트랙을 스튜디오로 복사해 새 레이어로 얹기 준비.
import { useRef, useState } from 'react';
import type { Route } from '../App';
import { PRELOAD, type Session } from '../lib/share';
import { listSongs } from '../lib/storage';
import { unlockAudio, createVoice, type Voice } from '../audio/engine';
import { normalizeEvents, type ChordEvent } from '../audio/events';
import { tickToMs } from '../audio/transport';

interface CommunityItem {
  id: string;
  title: string;
  owner: string;
  events: ChordEvent[];
  session: Session;
}

function buildItems(): CommunityItem[] {
  const items: CommunityItem[] = [];
  const p = PRELOAD.tracks[0];
  if (p) items.push({ id: 'preload', title: PRELOAD.name, owner: p.owner, events: p.events, session: PRELOAD });
  for (const s of listSongs()) {
    items.push({
      id: s.id,
      title: s.name,
      owner: '나',
      events: s.events,
      session: { code: 'LOCAL-' + s.id, name: s.name, bpm: s.bpm, tracks: [{ owner: '나', events: s.events, createdAt: s.createdAt }] },
    });
  }
  return items;
}

function lengthSec(events: ChordEvent[]): number {
  const maxTick = events.reduce((m, e) => Math.max(m, e.tick), 0);
  return Math.max(1, Math.round(tickToMs(maxTick) / 1000));
}

const SIG = ['#3182f6', '#ff6b6b', '#15c47e', '#8b5cf6', '#ff9f1c'];

export function Community({ go, onFork }: { go: (r: Route) => void; onFork: (s: Session) => void }) {
  const [items] = useState<CommunityItem[]>(() => buildItems());
  const [playing, setPlaying] = useState<string | null>(null);
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

  return (
    <>
      <div className="appbar">
        <span onClick={() => { stopPreview(); go('studio'); }} style={{ cursor: 'pointer' }}>‹ 스튜디오</span>
        <span style={{ marginLeft: 'auto', fontWeight: 800 }}>커뮤니티</span>
      </div>

      <div className="content">
        <div className="t-cap c-sub" style={{ marginBottom: 12 }}>
          다른 사람 음원을 들어보고 가져와 내 연주에 얹어보세요. (목록 본체는 추후 확장)
        </div>

        {items.map((item, i) => (
          <div key={item.id} className="card" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="track-av" style={{ background: SIG[i % SIG.length] }}>{(item.owner || '?').slice(0, 1)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t-body" style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
              <div className="t-cap c-sub">{item.owner} · 약 {lengthSec(item.events)}초</div>
            </div>
            <button className="chip chip-ghost" onClick={() => void preview(item)}>{playing === item.id ? '■ 정지' : '▶ 들어보기'}</button>
            <button className="chip" onClick={() => fork(item)}>가져오기</button>
          </div>
        ))}

        {items.length === 0 && <div className="t-cap c-sub" style={{ textAlign: 'center', padding: 24 }}>아직 음원이 없어요</div>}
      </div>
    </>
  );
}
