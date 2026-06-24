// 오디오 엔진 v2 (Tone.js). 음정(음이름→주파수)은 tuning.ts(평균율 A4=440, 순수함수)를 단일 진실원으로 따른다.
// v1(고정 4코드·setTimbre·chordOn) export를 전부 보존(무파괴)하고, 그 위에 v2를 추가한다(TASK-030 §3-B):
//   28코드 buildChord / 악기4×스타일 setVoice(화면동일·소리만) / downChord·upChord·downNote·upNote /
//   드럼 triggerHit / 합주 createVoice(instrument,style). 음정값은 tuning.ts(김민혁) — import만, 수정 금지.
import * as Tone from 'tone';
import { noteToFreq, midiToFreq, isChordName } from './tuning';
import { buildChordName, type Root, type Quality } from '../components/studio/chords';
import type { Instrument, DrumPiece } from './events';

// ---- v1 호환 타입(보존) ----
export type Timbre = 'acoustic' | 'electric';
export type Chord = 'C' | 'Am' | 'F' | 'G';
export const CHORDS: Chord[] = ['C', 'Am', 'F', 'G'];
export const TIMBRES: Timbre[] = ['acoustic', 'electric'];
export type { Instrument, DrumPiece } from './events';

// ---- 악기/스타일 프리셋(오실레이터+엔벨로프). 'inst:style' 키. ----
const PRESETS = {
  'piano:grand': { oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.9, sustain: 0.15, release: 1.2 } },
  'piano:electric': { oscillator: { type: 'fmsine' }, envelope: { attack: 0.005, decay: 0.6, sustain: 0.3, release: 0.9 } },
  'guitar:acoustic': { oscillator: { type: 'fmsquare' }, envelope: { attack: 0.004, decay: 0.7, sustain: 0.08, release: 0.8 } },
  'guitar:electric': { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.005, decay: 0.5, sustain: 0.25, release: 0.7 } },
  // 베이스는 저음 기본파가 폰 스피커에서 안 들려서, 배음 풍부한 파형(fmsquare/sawtooth)으로 가청성 확보.
  'bass:precision': { oscillator: { type: 'fmsquare' }, envelope: { attack: 0.01, decay: 0.25, sustain: 0.7, release: 0.4 } },
  'bass:jazz': { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.02, decay: 0.3, sustain: 0.6, release: 0.5 } },
} as const;
type PresetKey = keyof typeof PRESETS;

// 합성 폴백·예시음 볼륨(악기 밸런스). 피아노·드럼·베이스 추가 상향.
const PRESET_VOLUME: Record<Instrument, number> = { piano: -1, guitar: -9, bass: -8, drum: 3 };

// ---- 실제 샘플 음원(Tone.Sampler/Buffer) + 합성 폴백 ----
// 출처: 피아노=Salamander(CC-BY), 기타/베이스/오르간=nbrosowsky tonejs-instruments(jsDelivr), 드럼=Tone.js drum-samples.
// 로딩 전/실패 시엔 위 합성(PRESETS/makeDrumKit)으로 폴백 → 항상 소리는 난다. (토스 WebView CSP는 추후 확인)
const SAL = 'https://tonejs.github.io/audio/salamander/';
const NB = 'https://cdn.jsdelivr.net/gh/nbrosowsky/tonejs-instruments@master/samples/';
const DRUM_BASE = 'https://tonejs.github.io/audio/drum-samples/';

interface SampleDef {
  baseUrl: string;
  urls: Record<string, string>;
}
// 악기×스타일별 '확실히 다른' 실제 악기 샘플. 키=음이름(#), 값=파일(s).
const SAMPLE_DEFS: Record<string, SampleDef> = {
  'piano:grand': { baseUrl: SAL, urls: { A1: 'A1.mp3', C2: 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3', A2: 'A2.mp3', C3: 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3', A3: 'A3.mp3', C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3', A4: 'A4.mp3', C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3', A5: 'A5.mp3', C6: 'C6.mp3' } },
  'piano:electric': { baseUrl: NB + 'organ/', urls: { C2: 'C2.mp3', 'F#2': 'Fs2.mp3', A2: 'A2.mp3', C3: 'C3.mp3', 'F#3': 'Fs3.mp3', A3: 'A3.mp3', C4: 'C4.mp3', 'F#4': 'Fs4.mp3', A4: 'A4.mp3', C5: 'C5.mp3' } },
  'guitar:acoustic': { baseUrl: NB + 'guitar-acoustic/', urls: { E2: 'E2.mp3', A2: 'A2.mp3', D3: 'D3.mp3', G3: 'G3.mp3', B3: 'B3.mp3', E4: 'E4.mp3' } },
  'guitar:electric': { baseUrl: NB + 'guitar-electric/', urls: { E2: 'E2.mp3', A2: 'A2.mp3', C3: 'C3.mp3', A3: 'A3.mp3', C4: 'C4.mp3', A4: 'A4.mp3', C5: 'C5.mp3' } },
  'bass:precision': { baseUrl: NB + 'bass-electric/', urls: { E1: 'E1.mp3', G1: 'G1.mp3', 'A#1': 'As1.mp3', 'C#2': 'Cs2.mp3', E2: 'E2.mp3', G2: 'G2.mp3', 'A#2': 'As2.mp3', E3: 'E3.mp3' } },
  'bass:jazz': { baseUrl: NB + 'contrabass/', urls: { 'F#1': 'Fs1.mp3', 'A#1': 'As1.mp3', D2: 'D2.mp3', E2: 'E2.mp3', 'G#2': 'Gs2.mp3', A2: 'A2.mp3', E3: 'E3.mp3', B3: 'B3.mp3' } },
};
// 샘플 재생 볼륨(악기 밸런스). 피아노·베이스 추가 상향(피아노는 Salamander가 조용히 녹음됨).
const SAMPLE_VOLUME: Record<Instrument, number> = { piano: 0, guitar: -7, bass: -6, drum: 0 };

interface SamplerEntry {
  node: Tone.Sampler | null;
  loaded: boolean;
}
const samplerCache = new Map<string, SamplerEntry>();
function ensureSampler(key: string): void {
  if (samplerCache.has(key)) return;
  const def = SAMPLE_DEFS[key];
  if (!def) return;
  const entry: SamplerEntry = { node: null, loaded: false };
  samplerCache.set(key, entry);
  const inst = key.slice(0, key.indexOf(':')) as Instrument;
  const node = new Tone.Sampler({ urls: def.urls, baseUrl: def.baseUrl, release: 0.8, onload: () => { entry.loaded = true; } }).toDestination();
  node.volume.value = SAMPLE_VOLUME[inst] ?? -6;
  entry.node = node;
}
function curSampler(): Tone.Sampler | null {
  const e = samplerCache.get(`${instrument}:${style}`);
  return e && e.loaded ? e.node : null;
}

// 드럼 실제 샘플(킷별 킥/스네어/하이햇/탐). 크래시·라이드는 샘플 없어 합성 폴백.
const DRUM_KIT_NAME: Record<string, string> = { analog: 'acoustic-kit', electronic: 'Techno' };
const DRUM_FILE: Partial<Record<DrumPiece, string>> = { kick: 'kick', snare: 'snare', hihat: 'hihat', hitom: 'tom1', midtom: 'tom2', floortom: 'tom3' };
const drumSampleCache = new Map<string, Partial<Record<DrumPiece, Tone.ToneAudioBuffer>>>();
function ensureDrumSamples(st: string): void {
  if (drumSampleCache.has(st)) return;
  const kit = DRUM_KIT_NAME[st] ?? 'acoustic-kit';
  const buffers: Partial<Record<DrumPiece, Tone.ToneAudioBuffer>> = {};
  drumSampleCache.set(st, buffers);
  (Object.keys(DRUM_FILE) as DrumPiece[]).forEach((piece) => {
    const file = DRUM_FILE[piece];
    if (!file) return;
    const buf = new Tone.ToneAudioBuffer(`${DRUM_BASE}${kit}/${file}.mp3`, () => { buffers[piece] = buf; });
  });
}
// 드럼 출력 게인(+로 드럼 전체를 조금 키움).
let drumOut: Tone.Volume | null = null;
function playDrumSample(st: string, piece: DrumPiece): boolean {
  const buf = drumSampleCache.get(st)?.[piece];
  if (!buf || !buf.loaded) return false;
  if (!drumOut) drumOut = new Tone.Volume(9).toDestination();
  const src = new Tone.ToneBufferSource(buf).connect(drumOut);
  src.start();
  src.onended = () => src.dispose();
  return true;
}

function presetKey(inst: Instrument, st: string): PresetKey {
  const k = `${inst}:${st}`;
  return (k in PRESETS ? k : 'piano:grand') as PresetKey;
}

function makeSynthFor(inst: Instrument, st: string): Tone.PolySynth {
  const s = new Tone.PolySynth(Tone.Synth, PRESETS[presetKey(inst, st)]).toDestination();
  s.volume.value = PRESET_VOLUME[inst] ?? -8;
  return s;
}

// ---- 드럼 키트(원샷) ----
interface DrumKit {
  hit(piece: DrumPiece, time?: number): void;
  dispose(): void;
}
function makeDrumKit(st: string): DrumKit {
  const electronic = st === 'electronic';
  // 킥: 피치 엔벨로프로 '둥' 펀치(멤브레인).
  const kick = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 6, oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.45, sustain: 0, release: 0.4 } }).toDestination();
  kick.volume.value = -2;
  // 탐: 피치 다른 멤브레인.
  const tom1 = new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 4 }).toDestination();
  tom1.volume.value = -7;
  const tom2 = new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 4 }).toDestination();
  tom2.volume.value = -7;
  const floortom = new Tone.MembraneSynth({ pitchDecay: 0.1, octaves: 3 }).toDestination();
  floortom.volume.value = -5;
  // 스네어: 노이즈(스냅) + 짧은 토널 바디.
  const snareNoise = new Tone.NoiseSynth({ noise: { type: electronic ? 'white' : 'pink' }, envelope: { attack: 0.001, decay: 0.16, sustain: 0 } }).toDestination();
  snareNoise.volume.value = -9;
  const snareBody = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.02 } }).toDestination();
  snareBody.volume.value = -15;
  // 햇·심벌: 노이즈 → 하이패스 필터(금속 광택).
  const hpf = new Tone.Filter(electronic ? 9000 : 7000, 'highpass').toDestination();
  const hihat = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: electronic ? 0.02 : 0.045, sustain: 0 } }).connect(hpf);
  hihat.volume.value = -11;
  // 라이드: 짧은 노이즈 + 금속 벨 톤(ping).
  const ride = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.4, sustain: 0 } }).connect(hpf);
  ride.volume.value = -17;
  const rideBell = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.05 } }).connect(hpf);
  rideBell.volume.value = -20;
  const crash = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 1.2, sustain: 0 } }).connect(hpf);
  crash.volume.value = -16;
  const all = [kick, tom1, tom2, floortom, snareNoise, snareBody, hihat, ride, rideBell, crash, hpf];
  return {
    hit(piece, time) {
      switch (piece) {
        case 'kick': kick.triggerAttackRelease('C1', '8n', time); break;
        case 'hitom': tom1.triggerAttackRelease('A2', '8n', time); break;
        case 'midtom': tom2.triggerAttackRelease('F2', '8n', time); break;
        case 'floortom': floortom.triggerAttackRelease('C2', '8n', time); break;
        case 'snare':
          snareNoise.triggerAttackRelease('8n', time);
          snareBody.triggerAttackRelease('G3', '16n', time);
          break;
        case 'hihat': hihat.triggerAttackRelease('16n', time); break;
        case 'ride':
          ride.triggerAttackRelease('8n', time);
          rideBell.triggerAttackRelease('E6', '8n', time);
          break;
        case 'crash': crash.triggerAttackRelease('1n', time); break;
      }
    },
    dispose() {
      all.forEach((s) => s.dispose());
    },
  };
}

// ---- 메인 엔진 상태 ----
let synth: Tone.PolySynth | null = null;
let drumKit: DrumKit | null = null;
let timbre: Timbre = 'acoustic';
let instrument: Instrument = 'piano';
let style = 'grand';
let unlocked = false;

/** 첫 사용자 제스처에서 호출해야 소리가 난다(AudioContext unlock). */
export async function unlockAudio(): Promise<void> {
  if (unlocked) return;
  await Tone.start();
  // 라이브 입력 지연↓: Tone 기본 lookAhead 0.1s(≈100ms 지연)가 터치/제스처가 늦게 들리는 주원인.
  // lookAhead·updateInterval 동반 축소(0.02 ≈20ms)로 즉답. (제스처는 카메라/추론 지연이 별도로 존재.)
  const ctx = Tone.getContext();
  ctx.lookAhead = 0.02;
  (ctx as unknown as { updateInterval: number }).updateInterval = 0.02; // Tone 타입 누락 — 런타임 존재(클럭 갱신 주기)
  synth = makeSynthFor(instrument, style);
  unlocked = true;
  ensureSampler(`${instrument}:${style}`);
}

/** 현재 오디오 클럭 시각(초, lookAhead 포함). 샘플정확 스케줄(재생/모니터) 기준. */
export function audioNow(): number {
  return Tone.now();
}

export function isUnlocked(): boolean {
  return unlocked;
}

// ---- v2 악기/스타일 ----
/** 악기+스타일 설정. 화면은 그대로, 소리만 바뀐다(스튜디오 콤보의 단일 수렴점). */
export function setVoice(nextInstrument: Instrument, nextStyle: string): void {
  instrument = nextInstrument;
  style = nextStyle;
  if (nextInstrument === 'piano') timbre = nextStyle === 'electric' ? 'electric' : 'acoustic';
  if (!unlocked) return;
  if (nextInstrument === 'drum') {
    drumKit?.dispose();
    drumKit = makeDrumKit(nextStyle);
    ensureDrumSamples(nextStyle);
    return;
  }
  synth?.releaseAll();
  synth?.dispose();
  synth = makeSynthFor(nextInstrument, nextStyle);
  ensureSampler(`${nextInstrument}:${nextStyle}`);
}

export function getVoice(): { instrument: Instrument; style: string } {
  return { instrument, style };
}

// ---- v1 호환: setTimbre/getTimbre (piano 스타일로 위임) ----
export function setTimbre(t: Timbre): void {
  setVoice('piano', t === 'electric' ? 'electric' : 'grand');
}
export function getTimbre(): Timbre {
  return timbre;
}

// ---- 28코드 ----
/** (root, quality) → 코드 이름. 실제 음정은 voiceFreqs에서 통일 옥타브로 산출(아래). */
export function buildChord(root: Root, quality: Quality): string {
  return buildChordName(root, quality);
}

// ---- 코드 음 통일 옥타브 계산 ----
// tuning의 CHORD_NOTES는 코드마다 옥타브가 달라(C·D=4, E~B=3) 진행이 들쭉날쭉 → 엔진에서 통일 옥타브로 직접 계산.
const ROOT_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const QUAL_IV: Record<string, number[]> = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10] };
const CHORD_OCTAVE = 3; // 피아노/기타(코드) 통일 옥타브(루트 기준)
const BASS_OCTAVE = 2; // 베이스 코드 근음(옥타브1은 째져서 한 옥타브 올림)

function parseChord(name: string): { pc: number; iv: number[] } | null {
  const pc = ROOT_PC[name[0]];
  if (pc === undefined) return null;
  const iv = QUAL_IV[name.slice(1)];
  return iv ? { pc, iv } : null;
}

// 발음할 주파수. 코드 = 통일 옥타브 트라이어드(베이스는 근음만·한 옥타브 아래), 멜로디 = 음 그대로.
function voiceFreqs(v: string, inst: Instrument): number[] {
  if (isChordName(v)) {
    const c = parseChord(v);
    if (!c) return [];
    if (inst === 'bass') return [midiToFreq(12 * (BASS_OCTAVE + 1) + c.pc)];
    const base = 12 * (CHORD_OCTAVE + 1) + c.pc;
    return c.iv.map((i) => midiToFreq(base + i));
  }
  return [noteToFreq(v)];
}

// ---- 발음 (샘플 로드됐으면 샘플, 아니면 합성). 코드는 통일 옥타브. ----
function attack(v: string): void {
  const freqs = voiceFreqs(v, instrument);
  // 코드 모드 베이스는 작게(멜로디 베이스는 키우되 코드는 과음/째짐 방지) — velocity로 분리.
  const vel = instrument === 'bass' && isChordName(v) ? 0.4 : 1;
  const sp = curSampler();
  if (sp) {
    sp.triggerAttack(freqs, undefined, vel);
    return;
  }
  for (const f of freqs) synth?.triggerAttack(f, undefined, vel);
}
function release(v: string): void {
  const freqs = voiceFreqs(v, instrument);
  const sp = curSampler();
  if (sp) {
    sp.triggerRelease(freqs);
    return;
  }
  for (const f of freqs) synth?.triggerRelease(f);
}

// v1 호환(코드 or 개별음).
export function chordOn(v: string): void {
  attack(v);
}
export function chordOff(v: string): void {
  release(v);
}
export function allOff(): void {
  synth?.releaseAll();
  curSampler()?.releaseAll();
}

// v2 명시 API(코드/멜로디 분리 — source는 reducer용, 엔진은 무시).
export function downChord(chord: string, _source?: string): void {
  attack(chord);
}
export function upChord(chord: string, _source?: string): void {
  release(chord);
}
export function downNote(note: string, _source?: string): void {
  const sp = curSampler();
  if (sp) sp.triggerAttack(note);
  else synth?.triggerAttack(noteToFreq(note));
}
export function upNote(note: string, _source?: string): void {
  const sp = curSampler();
  if (sp) sp.triggerRelease(note);
  else synth?.triggerRelease(noteToFreq(note));
}

/** 드럼 원샷. 샘플 로드됐으면 실제 드럼 샘플, 아니면 합성 키트. */
export function triggerHit(piece: DrumPiece, _source?: string): void {
  const st = instrument === 'drum' ? style : 'analog';
  ensureDrumSamples(st);
  if (playDrumSample(st, piece)) return;
  if (!drumKit) drumKit = makeDrumKit(st);
  drumKit.hit(piece);
}

// ---- 메트로놈 클릭 ----
let click: Tone.Synth | null = null;
/** 메트로놈 클릭. accent=다운비트(첫 박). time은 Tone 스케줄 시각(정확한 타이밍). */
export function playClick(accent: boolean, time?: number): void {
  if (!click) {
    click = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 },
    }).toDestination();
    click.volume.value = -16;
  }
  click.triggerAttackRelease(noteToFreq(accent ? 'C6' : 'G5'), '32n', time);
}

// ---- 합주 합쳐듣기용 독립 보이스(트랙별 음색) ----
export interface Voice {
  on(v: string, time?: number): void;
  off(v: string, time?: number): void;
  hit(piece: DrumPiece, time?: number): void;
  dispose(): void;
}

/**
 * 트랙별 독립 보이스. instrument+style(또는 v1 Timbre)로 코드/멜로디/드럼 재생.
 * dispose 후 호출은 무시(no-op).
 */
export function createVoice(voice: Instrument | Timbre, voiceStyle?: string): Voice {
  // v1 호환: 'acoustic'|'electric'(Timbre)로 부르면 piano로 매핑(삼항 인라인으로 narrowing).
  const inst: Instrument = voice === 'acoustic' || voice === 'electric' ? 'piano' : voice;
  const st = voice === 'electric' ? 'electric' : voice === 'acoustic' ? 'grand' : voiceStyle ?? 'grand';

  let dead = false;
  const isDrum = inst === 'drum';
  const s = isDrum ? null : makeSynthFor(inst, st);
  const kit = isDrum ? makeDrumKit(st) : null;

  return {
    on: (c, time) => {
      if (dead || !s) return;
      for (const f of voiceFreqs(c, inst)) s.triggerAttack(f, time);
    },
    off: (c, time) => {
      if (dead || !s) return;
      for (const f of voiceFreqs(c, inst)) s.triggerRelease(f, time);
    },
    hit: (piece, time) => {
      if (!dead) kit?.hit(piece, time);
    },
    dispose: () => {
      if (dead) return;
      dead = true;
      s?.releaseAll();
      s?.dispose();
      kit?.dispose();
    },
  };
}
