import { useState } from 'react';
import type { MeetupService } from '../../domains/meetup/service';
import { remainingCapacity } from '../../domains/meetup/logic';
import { s, theme } from '../styles';
import { MeetupBadge, fmtDate } from './common';

interface Props {
  service: MeetupService;
  userKey: string;
  onCreate: () => void;
  onOpen: (id: string) => void;
}

export function Home({ service, userKey, onCreate, onOpen }: Props) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const meetups = service.listForUser(userKey);

  function enter() {
    const m = service.getByInviteCode(code);
    if (!m) {
      setErr('해당 초대 코드의 모임이 없어요.');
      return;
    }
    setErr('');
    onOpen(m.id);
  }

  return (
    <div>
      <button style={s.primaryBtn} onClick={onCreate}>+ 모임 만들기</button>
      <div style={{ height: 12 }} />
      <div style={s.card}>
        <label style={s.label}>초대 코드로 입장</label>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <input style={{ ...s.input, marginTop: 0 }} value={code} onChange={(e) => setCode(e.target.value)} placeholder="예: ABC123" />
          <button style={{ ...s.ghostBtn, whiteSpace: 'nowrap' }} onClick={enter}>입장</button>
        </div>
        {err && <p style={{ color: theme.danger, fontSize: 13, margin: '6px 0 0' }}>{err}</p>}
      </div>

      <h2 style={{ fontSize: 15, color: theme.sub, margin: '16px 4px 8px' }}>내 모임</h2>
      {meetups.length === 0 && (
        <div style={s.card}>
          <p style={{ ...s.sub, margin: 0 }}>아직 모임이 없어요. 만들거나 초대 코드로 입장해 보세요.</p>
        </div>
      )}
      {meetups.map((m) => (
        <div key={m.id} style={{ ...s.card, cursor: 'pointer' }} onClick={() => onOpen(m.id)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>{m.title}</strong>
            <MeetupBadge status={m.status} />
          </div>
          <p style={{ ...s.sub, margin: '4px 0 0' }}>
            {fmtDate(m.startAt)} · {m.area} · 남은자리 {remainingCapacity(m, service.participationsFor(m.id))}/{m.capacity}
          </p>
        </div>
      ))}
    </div>
  );
}
