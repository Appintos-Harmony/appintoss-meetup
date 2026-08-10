---
status: 확정 · A안(carve-out). 초기화면 = 이 세션(김민혁측) 구현 / 곽소정 = 스튜디오+audio
supersedes: (없음 · B안 미채택, 파일 미작성)
last_updated: 2026-06-23
related: [DEBATE-20260622-013_초기화면설계, TASK-20260622-030_풀스튜디오UI_곽소정]
branch: develop (머지 완료, 6372dc3)
---

# 초기화면 carve-out + 머지 조율 계약

## 0. 결정 (B안 검토 → A안 확정)
초기화면 설계(DEBATE-013)는 스튜디오/커뮤니티와 **내용상 비중복**이나, **파일(App.tsx·Home.tsx·Onboarding.tsx·Community.tsx)은 곽소정 TASK-030 경로락(`src/**`)과 파일단위로 겹친다.** 충돌 방지를 위해 이 파일들을 **이 세션(김민혁측)이 단독 소유(carve-out)** 하고, 곽소정 TASK-030 = `Studio.tsx` + `components/studio/**` + `audio/**`(tuning.ts import-only)로 분담. **곽소정은 carve-out 파일을 편집하지 않는다.**

## 1. 경로 분담
- **A(초기화면):** `App.tsx`, `routes/Home.tsx`, `routes/Onboarding.tsx`, `routes/Community.tsx`(신규 스텁), `routes/Settings.tsx`(진입).
- **B(곽소정 TASK-030):** `routes/Studio.tsx`, `components/studio/**`, `audio/**`(tuning.ts 수정 금지).
- **공유:** `lib/storage.ts`·`lib/identity.ts`(A 읽기·편집 없음), `lib/share.ts`(이상혁), `audio/events.ts`·`chordReducer.ts`·`engine.ts`(곽소정/이상혁).

## 2. 구현 상태
- `feat/TASK-20260622-031-home-hub`: `App.tsx`(기본 route `home` + `community` append + Community 렌더) · `Home.tsx`(스튜디오/커뮤니티 2카드 + 이어하기 + 설정 진입, 빈 상태 스튜디오 강조) · `Community.tsx`(스텁) · 온보딩 완료→home 착지.
- 검증: `tsc --noEmit` exit 0 · `npm test` **24/24 PASS**.

## 3. 머지 조율 계약 (각 측이 고정 · 실파일 분석 검증)
> **진짜 git 충돌 파일은 `App.tsx` 하나**: A 단독 소유하면 충돌 0. 나머지는 런타임/타입 계약.

| 접점 | 정의자 | 고정 계약 |
|---|---|---|
| `Route` union (App.tsx) | A | **append-only.** `community` 추가, 기존 멤버 제거/rename 금지 |
| `Studio` props `{go, loaded:Song\|null}` | 호출 A / 정의 B | **2 props 동결.** 새 prop은 **optional+기본값**만(필수 추가 시 App.tsx 깨짐) |
| `Song` (storage.ts 5필드) | 공유 | 5필드 동결, storage.ts 편집 안 함 |
| `ChordEvent` `{tick,phase,chord:string,source}` | 곽소정 | **4필드 불변+옵셔널만.** `chord:string`을 리터럴로 좁히기 금지(멜로디 개별음·Home 칩 깨짐) |
| `Source`/`Phase` | 곽소정 | 멤버 유지(PRELOAD·테스트 의존) |
| `SessionTrack`/`Session`+share 함수 | 이상혁 | 필드명·시그니처 동결. Studio가 **인라인 리터럴**로 생성하므로 필드 변경 주의. events를 NoteEvent[]로 넓히면 ChordEvent[] 대입 호환 |
| `Chord`/`CHORDS` → `components/studio/chords.ts` | 곽소정(B 내부) | 이전은 한 커밋에. A 무관 |
| `audio/events.ts` NoteEvent | 곽소정+이상혁 | NoteEvent↔ChordEvent 관계 **contract-first 명문화** |
| `getNickname()` | 공유 | 시그니처 동결 |
| `tuning.ts` | 김민혁(완료) | API 동결, import-only |

## 4. 머지 순서 (3 = 먼저 끝나는 쪽, 단 계약 우선)
0. (선행) **계약 동결:** events.ts NoteEvent·`Route` 최종형·Studio props를 타입스텁+문서로 develop 먼저.
1. 하류 공유타입(곽소정 ChordEvent/engine, 이상혁 share) 확정.
2. **A: App.tsx Route·렌더·Community 단독 확정 머지** · App.tsx 충돌면을 닫는 주체.
3. **B(TASK-030) 마지막:** `git merge develop`로 A의 Route 흡수 후 Studio props 정합 확인. B는 carve-out 파일 미편집.
- 통합 오너: App.tsx/Route=A · ChordEvent=곽소정 · share=이상혁 · **머지 게이트=조장**(develop 흡수 후 `tsc`+테스트 그린).

## 5. 남는 위험 (정적검사 사각 · 사람 주의)
- Studio가 `SessionTrack`을 **인라인 리터럴**로 생성 → 이상혁이 optional 필드 추가 시 런타임 누락(tsc 통과).
- `ChordEvent.chord`의 **의미**(코드명 vs 개별음) 변경 시 Home 칩·Studio 보이스 분기 조용히 오작동(타입 string 유지).
- `storage`/`share`는 **JSON 직렬화** 의존 → 비직렬화 필드 추가 시 런타임 깨짐.
- `share` ↔ `apps/api` 백엔드 스키마 드리프트(프런트만으론 미검증).
- `audio/gesture.ts` 오너 미명시(곽소정 도메인 추정) → 조장 확정 필요.

## 6. 식별/데이터 계약 (김민혁 · 확정, A 구현이 사용)
익명키 `getUserKey()`→`localStorage['harmony.anonKey']`(클라 생성, prod=토스 getAnonymousKey) · 닉 `getNickname()/setNickname()`→`harmony.nickname` · 이어하기 `listSongs()`→`harmony.songs`(읽기전용·오프라인 안전). **백엔드 API 의존 0.**
