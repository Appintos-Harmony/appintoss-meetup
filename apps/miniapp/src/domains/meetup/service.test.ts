import { describe, it, expect } from 'vitest';
import { emptyDb, type Db, type MeetupRepository } from '../../shared/store/repository';
import { createMeetupService, type ServiceGen } from './service';
import { DomainError } from './types';

function memRepo(): MeetupRepository {
  let db: Db = emptyDb();
  return {
    load: () => structuredClone(db),
    save: (next) => {
      db = structuredClone(next);
    },
  };
}

function seqGen(): ServiceGen {
  let n = 0;
  return {
    id: () => `id${++n}`,
    inviteCode: () => `CODE${n}`,
    now: () => '2026-06-21T00:00:00.000Z',
  };
}

const baseInput = {
  title: '경찰과 도둑',
  startAt: '2026-06-25T10:00:00.000Z',
  area: '서울 강북',
  capacity: 2,
  safetyRules: ['차도 진입 금지'],
};

describe('MeetupService (도메인 + 영속 통합)', () => {
  it('생성 후 초대 코드로 조회 가능', () => {
    const svc = createMeetupService(memRepo(), seqGen());
    const m = svc.createMeetup('host', baseInput);
    expect(svc.getByInviteCode(m.inviteCode)).toBeTruthy();
    expect(svc.getByInviteCode(m.inviteCode.toLowerCase())?.id).toBe(m.id); // 대소문자 무시
  });

  it('신청 → 승인 흐름 + 정원 초과 차단', () => {
    const svc = createMeetupService(memRepo(), seqGen());
    const m = svc.createMeetup('host', { ...baseInput, capacity: 1 });
    const p1 = svc.apply(m.id, 'a', '에이');
    svc.apply(m.id, 'b', '비');
    svc.approve(m.id, p1.id, 'host');
    const parts = svc.participationsFor(m.id);
    expect(parts.find((p) => p.id === p1.id)?.status).toBe('approved');
    // 정원 1 초과 → 두 번째 승인 차단
    const p2 = svc.participationsFor(m.id).find((p) => p.applicantKey === 'b')!;
    expect(() => svc.approve(m.id, p2.id, 'host')).toThrow(DomainError);
  });

  it('listForUser = 내가 만든 + 신청한 모임만(공개 추천 없음)', () => {
    const svc = createMeetupService(memRepo(), seqGen());
    const mine = svc.createMeetup('host', baseInput);
    const other = svc.createMeetup('someoneElse', baseInput);
    svc.apply(other.id, 'host', '호스트'); // host가 남의 모임에 신청
    const list = svc.listForUser('host').map((m) => m.id);
    expect(list).toContain(mine.id);
    expect(list).toContain(other.id);
    expect(svc.listForUser('stranger')).toHaveLength(0); // 무관한 사용자는 아무것도 안 보임
  });

  it('주최자가 아닌 사용자의 승인은 거부', () => {
    const svc = createMeetupService(memRepo(), seqGen());
    const m = svc.createMeetup('host', baseInput);
    const p = svc.apply(m.id, 'a', '에이');
    expect(() => svc.approve(m.id, p.id, 'a')).toThrow(DomainError);
  });

  it('프로필(닉네임) 저장/조회', () => {
    const svc = createMeetupService(memRepo(), seqGen());
    expect(svc.getProfile('a')).toBeUndefined();
    svc.setProfile('a', '에이스');
    expect(svc.getProfile('a')).toBe('에이스');
  });
});
