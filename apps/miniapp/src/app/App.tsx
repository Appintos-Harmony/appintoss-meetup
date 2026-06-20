import { useEffect, useMemo, useState } from 'react';
import { getUserKey } from '../shared/identity/identity';
import { createLocalStorageRepository } from '../shared/store/localStorageRepository';
import { createMeetupService, type ServiceGen } from '../domains/meetup/service';
import { Home } from './views/Home';
import { CreateMeetup } from './views/CreateMeetup';
import { MeetupDetail } from './views/MeetupDetail';
import { Screen, AppBar, Card, Field, Button, BottomBar } from './ui';

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

function Splash() {
  return (
    <div className="splash">
      <img src="/logo.svg" alt="소모임 밋업 로고" />
      <div className="s-name">소모임 밋업</div>
      <div className="s-tag">초대 코드로 여는 우리들의 모임</div>
    </div>
  );
}

type View = { name: 'home' } | { name: 'create' } | { name: 'detail'; id: string };

export function App() {
  const service = useMemo(() => createMeetupService(createLocalStorageRepository(), realGen()), []);
  const [showSplash, setShowSplash] = useState(true);
  const [userKey, setUserKey] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [nickInput, setNickInput] = useState('');
  const [view, setView] = useState<View>({ name: 'home' });
  const [, setTick] = useState(0);
  const reload = () => setTick((t) => t + 1);

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1450);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    getUserKey().then((k) => {
      setUserKey(k);
      setNickname(service.getProfile(k) ?? null);
    });
  }, [service]);

  if (showSplash) return <Splash />;

  if (!userKey) {
    return (
      <Screen>
        <div className="content c-sub">불러오는 중…</div>
      </Screen>
    );
  }

  if (!nickname) {
    return (
      <Screen>
        <div className="content fade">
          <h1 className="t-display">소모임 밋업</h1>
          <p className="t-body c-sub" style={{ marginTop: 2 }}>
            가입·로그인 없이 시작해요.
            <br />
            닉네임만 정하면 끝이에요.
          </p>
          <Card>
            <Field label="닉네임">
              <input className="input" value={nickInput} onChange={(e) => setNickInput(e.target.value)} placeholder="예: 도둑잡는철수" maxLength={16} />
            </Field>
          </Card>
        </div>
        <BottomBar>
          <Button
            disabled={!nickInput.trim()}
            onClick={() => {
              service.setProfile(userKey, nickInput);
              setNickname(nickInput.trim());
            }}
          >
            시작하기
          </Button>
        </BottomBar>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar
        title="소모임 밋업"
        right={<span className="me">{nickname}</span>}
        onTitle={() => setView({ name: 'home' })}
      />
      <div className="content fade" key={view.name + ('id' in view ? view.id : '')}>
        {view.name === 'home' && <Home service={service} userKey={userKey} onCreate={() => setView({ name: 'create' })} onOpen={(id) => setView({ name: 'detail', id })} />}
        {view.name === 'create' && <CreateMeetup service={service} userKey={userKey} onDone={(id) => setView({ name: 'detail', id })} onBack={() => setView({ name: 'home' })} />}
        {view.name === 'detail' && <MeetupDetail service={service} userKey={userKey} nickname={nickname} meetupId={view.id} onBack={() => setView({ name: 'home' })} reload={reload} />}
      </div>
    </Screen>
  );
}
