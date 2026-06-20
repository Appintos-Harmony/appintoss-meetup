import { useState } from 'react';
import type { MeetupService } from '../../domains/meetup/service';
import { DomainError } from '../../domains/meetup/types';
import { s, theme } from '../styles';

interface Props {
  service: MeetupService;
  userKey: string;
  onDone: (id: string) => void;
  onBack: () => void;
}

// §14 안전 규칙 기본값(주최자가 수정/추가). 약관 장식이 아니라 모임 데이터로 저장된다.
const DEFAULT_RULES = [
  '차도·철도·공사장·출입 제한 구역 진입 금지',
  '실제 무기처럼 보이는 물품 금지',
  '실제 경찰 제복·표식과 혼동되는 표현 금지',
  '음주 상태 참가 금지, 즉시 중단 신호 준수',
].join('\n');

export function CreateMeetup({ service, userKey, onDone, onBack }: Props) {
  const [title, setTitle] = useState('');
  const [startAt, setStartAt] = useState('');
  const [area, setArea] = useState('');
  const [capacity, setCapacity] = useState('4');
  const [supplies, setSupplies] = useState('');
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [err, setErr] = useState('');

  function submit() {
    try {
      const iso = startAt ? new Date(startAt).toISOString() : '';
      const meetup = service.createMeetup(userKey, {
        title,
        startAt: iso,
        area,
        capacity: Number(capacity),
        supplies,
        safetyRules: rules
          .split('\n')
          .map((r) => r.trim())
          .filter(Boolean),
      });
      onDone(meetup.id);
    } catch (e) {
      setErr(e instanceof DomainError ? e.message : '생성 중 오류가 발생했어요.');
    }
  }

  return (
    <div>
      <button style={{ ...s.ghostBtn, marginBottom: 12 }} onClick={onBack}>← 뒤로</button>
      <h1 style={s.title}>모임 만들기</h1>
      <div style={s.card}>
        <label style={s.label}>제목</label>
        <input style={s.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 토요일 경찰과 도둑" />
        <div style={{ height: 12 }} />
        <label style={s.label}>일시</label>
        <input style={s.input} type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
        <div style={{ height: 12 }} />
        <label style={s.label}>장소 (넓은 지역만)</label>
        <input style={s.input} value={area} onChange={(e) => setArea(e.target.value)} placeholder="예: 서울 강북 — 정확한 집결지는 참가자에게만" />
        <div style={{ height: 12 }} />
        <label style={s.label}>정원</label>
        <input style={s.input} type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        <div style={{ height: 12 }} />
        <label style={s.label}>준비물</label>
        <input style={s.input} value={supplies} onChange={(e) => setSupplies(e.target.value)} placeholder="예: 편한 운동화" />
        <div style={{ height: 12 }} />
        <label style={s.label}>안전 규칙 (줄바꿈으로 구분, 1개 이상 필수)</label>
        <textarea style={{ ...s.input, minHeight: 96, resize: 'vertical' }} value={rules} onChange={(e) => setRules(e.target.value)} />
      </div>
      {err && <p style={{ color: theme.danger, fontSize: 13 }}>{err}</p>}
      <button style={s.primaryBtn} onClick={submit}>모임 만들기</button>
    </div>
  );
}
