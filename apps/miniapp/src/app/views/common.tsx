import { s, theme } from '../styles';
import type { MeetupStatus, ParticipationStatus } from '../../domains/meetup/types';

const meetupLabels: Record<MeetupStatus, string> = { open: '모집중', closed: '마감', cancelled: '취소됨' };
const meetupColors: Record<MeetupStatus, string> = { open: theme.blue, closed: theme.sub, cancelled: theme.danger };

export function MeetupBadge({ status }: { status: MeetupStatus }) {
  return <span style={{ ...s.badge, background: '#EAF2FE', color: meetupColors[status] }}>{meetupLabels[status]}</span>;
}

const partLabels: Record<ParticipationStatus, string> = { pending: '대기', approved: '확정', rejected: '거절', cancelled: '취소' };

export function PartBadge({ status }: { status: ParticipationStatus }) {
  const color = status === 'approved' ? theme.ok : status === 'rejected' || status === 'cancelled' ? theme.danger : theme.sub;
  return <span style={{ ...s.badge, background: '#F2F4F6', color }}>{partLabels[status]}</span>;
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${hh}:${mm}`;
}
