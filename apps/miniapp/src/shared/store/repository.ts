// 영속 계층 인터페이스. 데모는 localStorage 구현을 쓰고, 운영은 서버 API 구현으로 교체할 수 있다.
// 데모 한계: 도메인 규칙이 클라이언트에서 실행된다 → 운영 서버가 같은 규칙을 반드시 재강제해야 한다(NFR-002).
import type { Meetup, Participation } from '../../domains/meetup/types';

export interface Db {
  meetups: Meetup[];
  participations: Participation[];
  profiles: Record<string, string>; // userKey -> 닉네임
}

export const emptyDb = (): Db => ({ meetups: [], participations: [], profiles: {} });

export interface MeetupRepository {
  load(): Db;
  save(db: Db): void;
}
