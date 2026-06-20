// 모임 도메인 타입. 날짜는 ISO 8601(UTC 저장) 문자열로 다룬다(§13.1).

export type MeetupStatus = 'open' | 'closed' | 'cancelled';
export type ParticipationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface Meetup {
  id: string;
  hostKey: string; // 주최자 식별자(getAnonymousKey hash). 클라이언트 식별 → 민감 권한은 서버 보강 대상(DL-016)
  title: string;
  startAt: string; // ISO 8601 (UTC)
  area: string; // 넓은 지역만(POL-003, 정밀 위치 미수집)
  capacity: number; // 정원 > 0
  supplies: string;
  intensity: string;
  cancelPolicy: string;
  safetyRules: string[]; // §14 안전 규칙(최소 1개) — 약관 장식이 아니라 기능 데이터
  inviteCode: string; // 초대 코드형 진입 키(FR-004/014)
  status: MeetupStatus;
  createdAt: string;
}

export interface Participation {
  id: string;
  meetupId: string;
  applicantKey: string; // 참가자 식별자(getAnonymousKey hash)
  nickname: string;
  status: ParticipationStatus;
  appliedAt: string;
}

export type DomainErrorCode =
  | 'INVALID_INPUT'
  | 'MEETUP_NOT_OPEN'
  | 'DUPLICATE_APPLICATION'
  | 'NOT_HOST'
  | 'FORBIDDEN'
  | 'CAPACITY_EXCEEDED'
  | 'INVALID_STATE'
  | 'NOT_FOUND';

// 비즈니스 규칙 위반은 코드가 붙은 DomainError로 표현한다(사용자 메시지/운영 로그 분리, §13.1).
export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'DomainError';
  }
}
