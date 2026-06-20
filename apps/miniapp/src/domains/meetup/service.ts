// 서비스 계층: 순수 도메인 로직 + 영속(repo) + id/코드/시각 생성을 잇는 불순 경계.
// id/inviteCode/now는 주입(gen)해 테스트에서 결정적으로 만든다.
import type { MeetupRepository } from '../../shared/store/repository';
import { DomainError, type Meetup, type Participation } from './types';
import {
  applyToMeetup,
  approveParticipation,
  cancelMeetup,
  cancelParticipation,
  closeMeetup,
  createMeetup,
  rejectParticipation,
  type CreateMeetupInput,
} from './logic';

export interface ServiceGen {
  id(): string;
  inviteCode(): string;
  now(): string;
}

export type CreateInput = Omit<CreateMeetupInput, 'hostKey'>;

export function createMeetupService(repo: MeetupRepository, gen: ServiceGen) {
  function requireMeetup(id: string): Meetup {
    const m = repo.load().meetups.find((x) => x.id === id);
    if (!m) throw new DomainError('NOT_FOUND', '모임을 찾을 수 없음');
    return m;
  }

  return {
    createMeetup(hostKey: string, input: CreateInput): Meetup {
      const db = repo.load();
      const meetup = createMeetup(
        { ...input, hostKey },
        { id: gen.id(), inviteCode: gen.inviteCode(), now: gen.now() },
      );
      db.meetups.push(meetup);
      repo.save(db);
      return meetup;
    },

    getMeetup(id: string): Meetup | undefined {
      return repo.load().meetups.find((m) => m.id === id);
    },

    getByInviteCode(code: string): Meetup | undefined {
      const norm = code.trim().toUpperCase();
      return repo.load().meetups.find((m) => m.inviteCode.toUpperCase() === norm);
    },

    // FR-014: 내가 만든 모임 + 신청한 모임(초대코드 진입 후 신청하면 목록에 포함). 공개 추천 없음.
    listForUser(userKey: string): Meetup[] {
      const db = repo.load();
      const appliedIds = new Set(
        db.participations.filter((p) => p.applicantKey === userKey).map((p) => p.meetupId),
      );
      return db.meetups
        .filter((m) => m.hostKey === userKey || appliedIds.has(m.id))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    participationsFor(meetupId: string): Participation[] {
      return repo.load().participations.filter((p) => p.meetupId === meetupId);
    },

    myParticipation(meetupId: string, userKey: string): Participation | undefined {
      return repo
        .load()
        .participations.filter((p) => p.meetupId === meetupId && p.applicantKey === userKey)
        .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt))[0];
    },

    apply(meetupId: string, applicantKey: string, nickname: string): Participation {
      const db = repo.load();
      const meetup = db.meetups.find((m) => m.id === meetupId);
      if (!meetup) throw new DomainError('NOT_FOUND', '모임을 찾을 수 없음');
      const participation = applyToMeetup(meetup, db.participations, { applicantKey, nickname }, {
        id: gen.id(),
        now: gen.now(),
      });
      db.participations.push(participation);
      repo.save(db);
      return participation;
    },

    approve(meetupId: string, participationId: string, actorKey: string): void {
      const db = repo.load();
      const meetup = requireMeetup(meetupId);
      db.participations = approveParticipation(meetup, db.participations, participationId, actorKey);
      repo.save(db);
    },

    reject(meetupId: string, participationId: string, actorKey: string): void {
      const db = repo.load();
      const meetup = requireMeetup(meetupId);
      db.participations = rejectParticipation(meetup, db.participations, participationId, actorKey);
      repo.save(db);
    },

    cancelParticipation(participationId: string, actorKey: string): void {
      const db = repo.load();
      db.participations = cancelParticipation(db.participations, participationId, actorKey);
      repo.save(db);
    },

    closeMeetup(meetupId: string, actorKey: string): void {
      const db = repo.load();
      const meetup = requireMeetup(meetupId);
      const updated = closeMeetup(meetup, actorKey);
      db.meetups = db.meetups.map((m) => (m.id === updated.id ? updated : m));
      repo.save(db);
    },

    cancelMeetup(meetupId: string, actorKey: string): void {
      const db = repo.load();
      const meetup = requireMeetup(meetupId);
      const updated = cancelMeetup(meetup, actorKey);
      db.meetups = db.meetups.map((m) => (m.id === updated.id ? updated : m));
      repo.save(db);
    },

    getProfile(userKey: string): string | undefined {
      return repo.load().profiles[userKey];
    },

    setProfile(userKey: string, nickname: string): void {
      const db = repo.load();
      db.profiles[userKey] = nickname.trim();
      repo.save(db);
    },
  };
}

export type MeetupService = ReturnType<typeof createMeetupService>;
