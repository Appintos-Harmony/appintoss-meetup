// 디자인 시스템 컴포넌트(theme.css 클래스 래핑). 화면설계서 §1.1 토큰 기준.
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { MeetupStatus, ParticipationStatus } from '../domains/meetup/types';

export function Screen({ children }: { children: ReactNode }) {
  return <div className="screen">{children}</div>;
}

export function AppBar({ title, right, onTitle }: { title: string; right?: ReactNode; onTitle?: () => void }) {
  return (
    <div className="appbar">
      <span className="brand" onClick={onTitle}>{title}</span>
      {right}
    </div>
  );
}

export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div className={`card${onClick ? ' tap' : ''}${className ? ` ${className}` : ''}`} onClick={onClick}>
      {children}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'weak' | 'danger-weak';
  size?: 'lg' | 'md' | 'sm';
};
export function Button({ variant = 'primary', size = 'lg', className, ...rest }: BtnProps) {
  return <button className={`btn btn-${size} btn-${variant}${className ? ` ${className}` : ''}`} {...rest} />;
}

export function BottomBar({ children }: { children: ReactNode }) {
  return <div className="bottombar">{children}</div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

export function Empty({ emoji, children }: { emoji: string; children: ReactNode }) {
  return (
    <div className="empty">
      <div className="emoji">{emoji}</div>
      <p className="t-body" style={{ marginTop: 8 }}>{children}</p>
    </div>
  );
}

const meetupBadge: Record<MeetupStatus, { cls: string; label: string }> = {
  open: { cls: 'badge-blue', label: '모집중' },
  closed: { cls: 'badge-grey', label: '마감' },
  cancelled: { cls: 'badge-red', label: '취소됨' },
};
export function MeetupBadge({ status }: { status: MeetupStatus }) {
  const b = meetupBadge[status];
  return <span className={`badge ${b.cls}`}>{b.label}</span>;
}

const partBadge: Record<ParticipationStatus, { cls: string; label: string }> = {
  pending: { cls: 'badge-grey', label: '대기' },
  approved: { cls: 'badge-green', label: '확정' },
  rejected: { cls: 'badge-red', label: '거절' },
  cancelled: { cls: 'badge-grey', label: '취소' },
};
export function PartBadge({ status }: { status: ParticipationStatus }) {
  const b = partBadge[status];
  return <span className={`badge ${b.cls}`}>{b.label}</span>;
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${hh}:${mm}`;
}
