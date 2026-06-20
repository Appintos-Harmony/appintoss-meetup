import { describe, it, expect } from 'vitest';
import { DomainError, type DomainErrorCode, type Participation } from './types';
import {
  createMeetup,
  applyToMeetup,
  approveParticipation,
  rejectParticipation,
  cancelParticipation,
  closeMeetup,
  cancelMeetup,
  approvedCount,
  remainingCapacity,
  isFull,
} from './logic';

const NOW = '2026-06-21T00:00:00.000Z';
const FUTURE = '2026-06-25T10:00:00.000Z';

function makeMeetup(over: Partial<Parameters<typeof createMeetup>[0]> = {}) {
  return createMeetup(
    {
      hostKey: 'host',
      title: '경찰과 도둑',
      startAt: FUTURE,
      area: '서울 강북',
      capacity: 2,
      safetyRules: ['차도·공사장 진입 금지', '즉시 중단 신호'],
      ...over,
    },
    { id: 'm1', inviteCode: 'ABC123', now: NOW },
  );
}

function apply(
  meetup: ReturnType<typeof makeMeetup>,
  parts: Participation[],
  key: string,
  id: string,
) {
  return applyToMeetup(meetup, parts, { applicantKey: key, nickname: key }, { id, now: NOW });
}

function expectCode(fn: () => unknown, code: DomainErrorCode) {
  try {
    fn();
    throw new Error('did not throw');
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    expect((e as DomainError).code).toBe(code);
  }
}

describe('createMeetup', () => {
  it('정상 생성 시 status=open, inviteCode 설정', () => {
    const m = makeMeetup();
    expect(m.status).toBe('open');
    expect(m.inviteCode).toBe('ABC123');
    expect(m.capacity).toBe(2);
  });

  it('과거 일시는 INVALID_INPUT', () => {
    expectCode(() => makeMeetup({ startAt: '2020-01-01T00:00:00.000Z' }), 'INVALID_INPUT');
  });

  it('정원 0 이하는 INVALID_INPUT', () => {
    expectCode(() => makeMeetup({ capacity: 0 }), 'INVALID_INPUT');
  });

  it('안전 규칙 없으면 INVALID_INPUT(§14 기능 강제)', () => {
    expectCode(() => makeMeetup({ safetyRules: [] }), 'INVALID_INPUT');
  });

  it('빈 제목은 INVALID_INPUT', () => {
    expectCode(() => makeMeetup({ title: '   ' }), 'INVALID_INPUT');
  });
});

describe('applyToMeetup', () => {
  it('신청 시 pending', () => {
    const m = makeMeetup();
    const p = apply(m, [], 'a', 'p1');
    expect(p.status).toBe('pending');
    expect(p.meetupId).toBe('m1');
  });

  it('중복 신청 차단(활성 신청 보유)', () => {
    const m = makeMeetup();
    const p1 = apply(m, [], 'a', 'p1');
    expectCode(() => apply(m, [p1], 'a', 'p2'), 'DUPLICATE_APPLICATION');
  });

  it('모집 중 아니면 MEETUP_NOT_OPEN', () => {
    const closed = closeMeetup(makeMeetup(), 'host');
    expectCode(() => apply(closed, [], 'a', 'p1'), 'MEETUP_NOT_OPEN');
  });

  it('취소 후 재신청 허용', () => {
    const m = makeMeetup();
    const p1 = apply(m, [], 'a', 'p1');
    const afterCancel = cancelParticipation([p1], 'p1', 'a');
    expect(() => apply(m, afterCancel, 'a', 'p2')).not.toThrow();
  });
});

describe('approveParticipation / 정원', () => {
  it('주최자만 승인 가능(NOT_HOST)', () => {
    const m = makeMeetup();
    const p1 = apply(m, [], 'a', 'p1');
    expectCode(() => approveParticipation(m, [p1], 'p1', 'intruder'), 'NOT_HOST');
  });

  it('정원 초과 승인 차단(CAPACITY_EXCEEDED)', () => {
    const m = makeMeetup({ capacity: 1 });
    let parts = [apply(m, [], 'a', 'p1'), apply(m, [], 'b', 'p2')];
    parts = approveParticipation(m, parts, 'p1', 'host');
    expect(approvedCount(parts, 'm1')).toBe(1);
    expect(isFull(m, parts)).toBe(true);
    expectCode(() => approveParticipation(m, parts, 'p2', 'host'), 'CAPACITY_EXCEEDED');
  });

  it('승인 취소로 정원 복구되면 다음 승인 가능', () => {
    const m = makeMeetup({ capacity: 1 });
    let parts = [apply(m, [], 'a', 'p1'), apply(m, [], 'b', 'p2')];
    parts = approveParticipation(m, parts, 'p1', 'host');
    parts = cancelParticipation(parts, 'p1', 'a');
    expect(remainingCapacity(m, parts)).toBe(1);
    parts = approveParticipation(m, parts, 'p2', 'host');
    expect(approvedCount(parts, 'm1')).toBe(1);
  });

  it('대기 상태가 아니면 INVALID_STATE', () => {
    const m = makeMeetup();
    let parts = [apply(m, [], 'a', 'p1')];
    parts = approveParticipation(m, parts, 'p1', 'host');
    expectCode(() => approveParticipation(m, parts, 'p1', 'host'), 'INVALID_STATE');
  });
});

describe('reject / cancel / meetup 상태', () => {
  it('거절 후 재신청 허용', () => {
    const m = makeMeetup();
    let parts = [apply(m, [], 'a', 'p1')];
    parts = rejectParticipation(m, parts, 'p1', 'host');
    expect(parts[0].status).toBe('rejected');
    expect(() => apply(m, parts, 'a', 'p2')).not.toThrow();
  });

  it('본인 아닌 취소는 FORBIDDEN', () => {
    const m = makeMeetup();
    const p1 = apply(m, [], 'a', 'p1');
    expectCode(() => cancelParticipation([p1], 'p1', 'b'), 'FORBIDDEN');
  });

  it('모임 취소는 주최자만, 취소 후 승인 불가', () => {
    const m = makeMeetup();
    const parts = [apply(m, [], 'a', 'p1')];
    expectCode(() => cancelMeetup(m, 'intruder'), 'NOT_HOST');
    const cancelled = cancelMeetup(m, 'host');
    expect(cancelled.status).toBe('cancelled');
    expectCode(() => approveParticipation(cancelled, parts, 'p1', 'host'), 'MEETUP_NOT_OPEN');
  });
});
