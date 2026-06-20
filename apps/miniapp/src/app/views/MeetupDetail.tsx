import { useState } from 'react';
import type { MeetupService } from '../../domains/meetup/service';
import { DomainError } from '../../domains/meetup/types';
import { remainingCapacity } from '../../domains/meetup/logic';
import { s, theme } from '../styles';
import { MeetupBadge, PartBadge, fmtDate } from './common';

interface Props {
  service: MeetupService;
  userKey: string;
  nickname: string;
  meetupId: string;
  onBack: () => void;
  reload: () => void;
}

export function MeetupDetail({ service, userKey, nickname, meetupId, onBack, reload }: Props) {
  const [err, setErr] = useState('');
  const meetup = service.getMeetup(meetupId);

  if (!meetup) {
    return (
      <div>
        <button style={s.ghostBtn} onClick={onBack}>← 뒤로</button>
        <p>모임을 찾을 수 없어요.</p>
      </div>
    );
  }

  const isHost = meetup.hostKey === userKey;
  const parts = service.participationsFor(meetupId);
  const visibleParts = parts.filter((p) => p.status !== 'cancelled');
  const mine = service.myParticipation(meetupId, userKey);
  const remaining = remainingCapacity(meetup, parts);

  function run(fn: () => void) {
    try {
      fn();
      setErr('');
      reload();
    } catch (e) {
      setErr(e instanceof DomainError ? e.message : '처리 중 오류가 발생했어요.');
    }
  }

  return (
    <div>
      <button style={{ ...s.ghostBtn, marginBottom: 12 }} onClick={onBack}>← 뒤로</button>

      <div style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={s.title}>{meetup.title}</h1>
          <MeetupBadge status={meetup.status} />
        </div>
        <p style={{ ...s.sub, margin: '4px 0' }}>{fmtDate(meetup.startAt)} · {meetup.area}</p>
        <p style={{ ...s.sub, margin: '4px 0' }}>
          남은자리 {remaining}/{meetup.capacity}{meetup.supplies ? ` · 준비물: ${meetup.supplies}` : ''}
        </p>
        <div style={{ marginTop: 8, padding: 10, background: theme.bg, borderRadius: 10 }}>
          <span style={{ fontSize: 13, color: theme.sub }}>초대 코드 </span>
          <code style={{ fontSize: 15, fontWeight: 800, color: theme.blue }}>{meetup.inviteCode}</code>
        </div>
      </div>

      <div style={s.card}>
        <strong style={{ fontSize: 14 }}>안전 규칙</strong>
        <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
          {meetup.safetyRules.map((r, i) => (
            <li key={i} style={{ fontSize: 13, marginBottom: 4 }}>{r}</li>
          ))}
        </ul>
      </div>

      {err && <p style={{ color: theme.danger, fontSize: 13 }}>{err}</p>}

      {isHost ? (
        <div style={s.card}>
          <strong style={{ fontSize: 14 }}>신청자 ({visibleParts.length})</strong>
          {visibleParts.length === 0 && <p style={{ ...s.sub, margin: '8px 0 0' }}>아직 신청자가 없어요.</p>}
          {visibleParts.map((p) => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: `1px solid ${theme.line}`, marginTop: 8 }}>
              <span>{p.nickname} <PartBadge status={p.status} /></span>
              {p.status === 'pending' && meetup.status === 'open' && (
                <span style={{ display: 'flex', gap: 6 }}>
                  <button style={{ ...s.smallBtn, background: theme.blue, color: '#fff' }} onClick={() => run(() => service.approve(meetupId, p.id, userKey))}>승인</button>
                  <button style={{ ...s.smallBtn, background: theme.bg, color: theme.text }} onClick={() => run(() => service.reject(meetupId, p.id, userKey))}>거절</button>
                </span>
              )}
            </div>
          ))}
          {meetup.status === 'open' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button style={{ ...s.ghostBtn, flex: 1 }} onClick={() => run(() => service.closeMeetup(meetupId, userKey))}>모집 마감</button>
              <button style={{ ...s.ghostBtn, flex: 1, color: theme.danger }} onClick={() => run(() => service.cancelMeetup(meetupId, userKey))}>모임 취소</button>
            </div>
          )}
        </div>
      ) : (
        <div style={s.card}>
          {mine && (mine.status === 'pending' || mine.status === 'approved') ? (
            <div>
              <p style={{ margin: '0 0 10px' }}>
                내 신청 <PartBadge status={mine.status} /> {mine.status === 'pending' ? '· 주최자 승인 대기 중' : '· 참가 확정!'}
              </p>
              <button style={s.ghostBtn} onClick={() => run(() => service.cancelParticipation(mine.id, userKey))}>신청 취소</button>
            </div>
          ) : meetup.status === 'open' ? (
            <button style={s.primaryBtn} onClick={() => run(() => service.apply(meetupId, userKey, nickname))}>참가 신청 ({nickname})</button>
          ) : (
            <p style={{ ...s.sub, margin: 0 }}>모집이 마감되었거나 취소된 모임이에요.</p>
          )}
        </div>
      )}
    </div>
  );
}
