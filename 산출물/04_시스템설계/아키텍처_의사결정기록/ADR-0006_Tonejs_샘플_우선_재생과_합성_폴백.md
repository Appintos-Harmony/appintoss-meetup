---
status: Draft
owner: 김민혁
reviewers: [이상혁]
last_updated: 2026-06-24
related_requirements: []
related_adrs: [ADR-0001]
---

# ADR-0006 · Tone.js 샘플 우선 재생 + 합성 폴백

## 상태

Accepted. 근거: [DL-018](../../00_프로젝트관리/의사결정_기록.md#dl-018--주제-전환-제안-소모임-밋업--악기-합주-미니앱-팀-합의-대기)(스파이크 Tone.js), [DL-022](../../00_프로젝트관리/의사결정_기록.md#dl-022--풀버전-복귀축소-mvp--곽소정-원안-전체--앱-도메인-서빙)(악기 4종 풀버전). 구현: `apps/miniapp/src/audio/engine.ts`.

## 맥락

하모니(ADR-0001)는 피아노·기타·베이스·드럼을 "실제 악기처럼" 들리게 해야 하지만, 미니앱은 번들 크기·로딩 시간·
토스 WebView CSP·네트워크 변동성 제약을 받는다. 실제 샘플 음원은 음질이 좋지만 외부 CDN에서 비동기 로드되므로
로딩 전/실패 시 소리가 안 나면 데모가 깨진다.

## 결정

오디오 엔진을 **"실제 샘플 우선, 합성 폴백"** 2단 구조로 만든다(engine.ts).

- **샘플 우선:** `Tone.Sampler`/`Tone.ToneAudioBuffer`로 악기×스타일별 실제 샘플을 로드한다(engine.ts 44~51행).
  출처: 피아노=Salamander(CC-BY), 기타/베이스/오르간=nbrosowsky tonejs-instruments(jsDelivr), 드럼=Tone.js drum-samples(engine.ts 33행).
- **합성 폴백:** 샘플 로딩 전/실패 시 오실레이터+엔벨로프 프리셋(`PRESETS`, `makeDrumKit`)으로 폴백한다 → **항상 소리는 난다**(engine.ts 34행).
  발음 시 `curSampler()`가 로드 완료면 샘플, 아니면 `synth`로 재생(engine.ts `attack`/`release` 272~277행).
- **첫 탭 unlock:** 첫 사용자 제스처에서 `Tone.start()`로 AudioContext를 해제하고 lookAhead/updateInterval을 0.02s로 낮춰
  입력 지연을 줄인다(engine.ts `unlockAudio` 182행). 공식 정책상 첫 탭 후 재생([공식문서 근거 #8](../../02_정책준수/공식문서_근거목록.md))과 일치.

## 결과

- 네트워크가 느리거나 CDN 샘플이 실패해도 합성음으로 즉시 연주된다(데모 무중단).
- 베이스는 저음 기본파가 폰 스피커에서 안 들려 배음 풍부한 파형으로 가청성을 확보(engine.ts 23행), 악기별 볼륨 밸런스를 둠(`PRESET_VOLUME`/`SAMPLE_VOLUME`).
- 음정은 `tuning.ts`(평균율 A4=440, 순수함수)를 단일 진실원으로 따른다(engine.ts 1행, import만·수정 금지).
- 합주 트랙별 독립 음색은 `createVoice(instrument, style)`로 분리 재생(engine.ts 354행).

### 미해결 / Open Question

- **토스 WebView CSP 미확정:** 외부 CDN(jsDelivr·tonejs.github.io) 샘플 로드가 토스 WebView CSP에서 허용되는지 미확인이다
  (engine.ts 34행 주석 "토스 WebView CSP는 추후 확인", Open Question). CSP가 외부 fetch를 막으면 합성 폴백으로 동작한다(설계상 안전).
- 일부 드럼 심벌(크래시·라이드)은 샘플이 없어 합성 폴백을 사용한다(engine.ts 76행).

## 대안

- **(a) 합성(신스)만:** 번들·CDN 의존 0이나 음질이 단조로움. 폴백으로만 사용.
- **(b) 샘플만:** 음질 최선이나 로딩 실패 시 무음 → 데모 리스크. 거부.
- **(c) 샘플을 번들에 포함:** CDN 의존 제거하나 번들 크기 급증(JS 이미 646KB). 외부 CDN + 폴백으로 절충.
