import { emptyDb, type Db, type MeetupRepository } from './repository';

const STORAGE_KEY = 'meetup-lite.db.v1';

// localStorage 기반 데모 저장소. 운영에서는 동일 인터페이스의 서버 API 구현으로 교체한다.
export function createLocalStorageRepository(): MeetupRepository {
  return {
    load(): Db {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return emptyDb();
        return { ...emptyDb(), ...(JSON.parse(raw) as Partial<Db>) };
      } catch {
        return emptyDb();
      }
    },
    save(db: Db): void {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    },
  };
}
