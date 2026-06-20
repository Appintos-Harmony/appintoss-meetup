import { useState } from 'react';
import type { MeetupService } from '../../domains/meetup/service';
import { remainingCapacity } from '../../domains/meetup/logic';
import { Card, Field, Button, BottomBar, MeetupBadge, Empty, fmtDate } from '../ui';

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
    <>
      <Card>
        <Field label="초대 코드로 입장">
          <div className="row" style={{ gap: 8 }}>
            <input className="input" style={{ flex: 1 }} value={code} onChange={(e) => setCode(e.target.value)} placeholder="예: ABC123" />
            <Button variant="weak" size="md" onClick={enter} style={{ whiteSpace: 'nowrap' }}>입장</Button>
          </div>
        </Field>
        {err && <p className="hint">{err}</p>}
      </Card>

      <div className="section-label">내 모임</div>
      {meetups.length === 0 && (
        <Card>
          <Empty emoji="🗓️">
            아직 모임이 없어요.
            <br />
            만들거나 초대 코드로 입장해 보세요.
          </Empty>
        </Card>
      )}
      {meetups.map((m) => (
        <Card key={m.id} onClick={() => onOpen(m.id)}>
          <div className="row">
            <strong className="t-heading">{m.title}</strong>
            <MeetupBadge status={m.status} />
          </div>
          <p className="t-cap c-sub" style={{ margin: '6px 0 0' }}>
            {fmtDate(m.startAt)} · {m.area} · 남은자리 {remainingCapacity(m, service.participationsFor(m.id))}/{m.capacity}
          </p>
        </Card>
      ))}

      <BottomBar>
        <Button onClick={onCreate}>+ 모임 만들기</Button>
      </BottomBar>
    </>
  );
}
