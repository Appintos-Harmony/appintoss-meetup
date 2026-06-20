import { useEffect, useMemo, useState } from 'react';
import { getUserKey } from '../shared/identity/identity';
import { createLocalStorageRepository } from '../shared/store/localStorageRepository';
import { createMeetupService, type ServiceGen } from '../domains/meetup/service';
import { Home } from './views/Home';
import { CreateMeetup } from './views/CreateMeetup';
import { MeetupDetail } from './views/MeetupDetail';
import { s, theme } from './styles';

// 실제 id/초대코드/시각 생성기(불순 경계). 도메인은 이를 주입받아 순수하게 유지된다.
function realGen(): ServiceGen {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return {
    id: () => crypto.randomUUID(),
    inviteCode: () => {
      const arr = new Uint32Array(6);
      crypto.getRandomValues(arr);
      return Array.from(arr, (n) => alphabet[n % alphabet.length]).join('');
    },
    now: () => new Date().toISOString(),
  };
}

type View = { name: 'home' } | { name: 'create' } | { name: 'detail'; id: string };

export function App() {
  const service = useMemo(() => createMeetupService(createLocalStorageRepository(), realGen()), []);
  const [userKey, setUserKey] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [nickInput, setNickInput] = useState('');
  const [view, setView] = useState<View>({ name: 'home' });
  const [, setTick] = useState(0);
  const reload = () => setTick((t) => t + 1);

  useEffect(() => {
    getUserKey().then((k) => {
      setUserKey(k);
      setNickname(service.getProfile(k) ?? null);
    });
  }, [service]);

  if (!userKey) {
    return (
      <div style={s.app}>
        <div style={s.container}>불러오는 중…</div>
      </div>
    );
  }

  if (!nickname) {
    return (
      <div style={s.app}>
        <div style={s.container}>
          <h1 style={s.title}>소모임 밋업</h1>
          <p style={s.sub}>가입·로그인 없이 시작해요. 닉네임만 정해주세요.</p>
          <div style={s.card}>
            <label style={s.label}>닉네임</label>
            <input style={s.input} value={nickInput} onChange={(e) => setNickInput(e.target.value)} placeholder="예: 도둑잡는철수" />
            <div style={{ height: 12 }} />
            <button
              style={{ ...s.primaryBtn, opacity: nickInput.trim() ? 1 : 0.5 }}
              disabled={!nickInput.trim()}
              onClick={() => {
                service.setProfile(userKey, nickInput);
                setNickname(nickInput.trim());
              }}
            >
              시작하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.app}>
      <header style={{ ...s.container, paddingBottom: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ color: theme.blue, fontSize: 18, cursor: 'pointer' }} onClick={() => setView({ name: 'home' })}>
          소모임 밋업
        </strong>
        <span style={s.sub}>{nickname}</span>
      </header>
      <div style={s.container}>
        {view.name === 'home' && <Home service={service} userKey={userKey} onCreate={() => setView({ name: 'create' })} onOpen={(id) => setView({ name: 'detail', id })} />}
        {view.name === 'create' && <CreateMeetup service={service} userKey={userKey} onDone={(id) => setView({ name: 'detail', id })} onBack={() => setView({ name: 'home' })} />}
        {view.name === 'detail' && <MeetupDetail service={service} userKey={userKey} nickname={nickname} meetupId={view.id} onBack={() => setView({ name: 'home' })} reload={reload} />}
      </div>
    </div>
  );
}
