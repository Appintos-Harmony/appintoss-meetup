// 모임 도메인 순수 로직. id/inviteCode/now는 주입(결정적 — 테스트 가능, 재현 가능).
// 서버에서 강제해야 할 규칙(정원·중복·권한·상태 전이, NFR-002)을 도메인에 모아 단일 기준으로 둔다.
import {
  DomainError,
  type Meetup,
  type Participation,
  type ParticipationStatus,
} from './types';

export interface CreateMeetupInput {
  hostKey: string;
  title: string;
  startAt: string;
  area: string;
  capacity: number;
  supplies?: string;
  intensity?: string;
  cancelPolicy?: string;
  safetyRules: string[];
}

export function createMeetup(
  input: CreateMeetupInput,
  ctx: { id: string; inviteCode: string; now: string },
): Meetup {
  if (!input.hostKey) throw new DomainError('INVALID_INPUT', '주최자 식별자 필요');
  if (!input.title.trim()) throw new DomainError('INVALID_INPUT', '제목 필요');
  if (Number.isNaN(Date.parse(input.startAt)))
    throw new DomainError('INVALID_INPUT', '일시 형식 오류');
  if (Date.parse(input.startAt) <= Date.parse(ctx.now))
    throw new DomainError('INVALID_INPUT', '과거 일시는 불가');
  if (!Number.isInteger(input.capacity) || input.capacity <= 0)
    throw new DomainError('INVALID_INPUT', '정원은 1 이상의 정수');
  if (input.safetyRules.length === 0)
    throw new DomainError('INVALID_INPUT', '안전 규칙 1개 이상 필요'); // §14: 기능으로 강제

  return {
    id: ctx.id,
    hostKey: input.hostKey,
    title: input.title.trim(),
    startAt: input.startAt,
    area: input.area,
    capacity: input.capacity,
    supplies: input.supplies ?? '',
    intensity: input.intensity ?? '',
    cancelPolicy: input.cancelPolicy ?? '',
    safetyRules: input.safetyRules,
    inviteCode: ctx.inviteCode,
    status: 'open',
    createdAt: ctx.now,
  };
}

// 활성 참가 = 정원/중복 판정 대상(pending·approved). rejected·cancelled는 재신청 허용.
function isActive(p: Participation): boolean {
  return p.status === 'pending' || p.status === 'approved';
}

export function approvedCount(parts: Participation[], meetupId: string): number {
  return parts.filter((p) => p.meetupId === meetupId && p.status === 'approved').length;
}

export function remainingCapacity(meetup: Meetup, parts: Participation[]): number {
  return Math.max(0, meetup.capacity - approvedCount(parts, meetup.id));
}

export function isFull(meetup: Meetup, parts: Participation[]): boolean {
  return remainingCapacity(meetup, parts) <= 0;
}

export function applyToMeetup(
  meetup: Meetup,
  existing: Participation[],
  input: { applicantKey: string; nickname: string },
  ctx: { id: string; now: string },
): Participation {
  if (meetup.status !== 'open') throw new DomainError('MEETUP_NOT_OPEN', '모집 중이 아님');
  if (!input.applicantKey) throw new DomainError('INVALID_INPUT', '참가자 식별자 필요');
  if (!input.nickname.trim()) throw new DomainError('INVALID_INPUT', '닉네임 필요');
  const duplicated = existing.some(
    (p) => p.meetupId === meetup.id && p.applicantKey === input.applicantKey && isActive(p),
  );
  if (duplicated) throw new DomainError('DUPLICATE_APPLICATION', '이미 신청한 모임'); // 중복 차단(NFR-002)

  return {
    id: ctx.id,
    meetupId: meetup.id,
    applicantKey: input.applicantKey,
    nickname: input.nickname.trim(),
    status: 'pending',
    appliedAt: ctx.now,
  };
}

function setStatus(
  parts: Participation[],
  participationId: string,
  status: ParticipationStatus,
): Participation[] {
  return parts.map((p) => (p.id === participationId ? { ...p, status } : p));
}

function requireParticipation(
  parts: Participation[],
  meetupId: string,
  participationId: string,
): Participation {
  const found = parts.find((p) => p.id === participationId && p.meetupId === meetupId);
  if (!found) throw new DomainError('NOT_FOUND', '신청을 찾을 수 없음');
  return found;
}

export function approveParticipation(
  meetup: Meetup,
  parts: Participation[],
  participationId: string,
  actorKey: string,
): Participation[] {
  if (meetup.hostKey !== actorKey) throw new DomainError('NOT_HOST', '주최자만 승인 가능');
  if (meetup.status !== 'open') throw new DomainError('MEETUP_NOT_OPEN', '모집 중이 아님');
  const target = requireParticipation(parts, meetup.id, participationId);
  if (target.status !== 'pending') throw new DomainError('INVALID_STATE', '대기 상태만 승인 가능');
  if (isFull(meetup, parts)) throw new DomainError('CAPACITY_EXCEEDED', '정원 초과'); // 정원 강제(NFR-002)
  return setStatus(parts, participationId, 'approved');
}

export function rejectParticipation(
  meetup: Meetup,
  parts: Participation[],
  participationId: string,
  actorKey: string,
): Participation[] {
  if (meetup.hostKey !== actorKey) throw new DomainError('NOT_HOST', '주최자만 거절 가능');
  const target = requireParticipation(parts, meetup.id, participationId);
  if (target.status !== 'pending') throw new DomainError('INVALID_STATE', '대기 상태만 거절 가능');
  return setStatus(parts, participationId, 'rejected');
}

// 취소: 본인(참가자)만. 승인됐던 자리가 비면 정원은 approvedCount 재계산으로 자동 복구.
export function cancelParticipation(
  parts: Participation[],
  participationId: string,
  actorKey: string,
): Participation[] {
  const target = parts.find((p) => p.id === participationId);
  if (!target) throw new DomainError('NOT_FOUND', '신청을 찾을 수 없음');
  if (target.applicantKey !== actorKey) throw new DomainError('FORBIDDEN', '본인만 취소 가능');
  if (!isActive(target)) throw new DomainError('INVALID_STATE', '대기/승인 상태만 취소 가능');
  return setStatus(parts, participationId, 'cancelled');
}

export function closeMeetup(meetup: Meetup, actorKey: string): Meetup {
  if (meetup.hostKey !== actorKey) throw new DomainError('NOT_HOST', '주최자만 마감 가능');
  if (meetup.status !== 'open') throw new DomainError('INVALID_STATE', '모집 중만 마감 가능');
  return { ...meetup, status: 'closed' };
}

export function cancelMeetup(meetup: Meetup, actorKey: string): Meetup {
  if (meetup.hostKey !== actorKey) throw new DomainError('NOT_HOST', '주최자만 취소 가능');
  if (meetup.status === 'cancelled') throw new DomainError('INVALID_STATE', '이미 취소됨');
  return { ...meetup, status: 'cancelled' };
}
