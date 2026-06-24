import { useState } from 'react';
import { getNickname } from './lib/identity';
import type { Song } from './lib/storage';
import type { Session } from './lib/share';
import { getDevMode, setDevMode } from './lib/settings';
import { Splash } from './routes/Splash';
import { Onboarding } from './routes/Onboarding';
import { Home } from './routes/Home';
import { Studio } from './routes/Studio';
import { Community } from './routes/Community';
import { Settings } from './routes/Settings';

// 라우트 = 평면 4상태. 'community' append-only(머지 계약). 통합: 031 셸(스플래시+홈허브) + 030 풀스튜디오.
export type Route = 'home' | 'studio' | 'community' | 'settings';

export function App() {
  const [splash, setSplash] = useState(true); // 매 구동 짧은 라이트 브랜드 리빌
  const [nickname, setNick] = useState<string | null>(() => getNickname());
  const [route, setRoute] = useState<Route>('home');
  const [loaded, setLoaded] = useState<Song | null>(null); // 홈 '이어하기'로 연 내 곡
  const [forked, setForked] = useState<Session | null>(null); // 커뮤니티에서 얹을 친구 세션
  const [devMode, setDev] = useState<boolean>(() => getDevMode());

  function toggleDev(on: boolean) {
    setDev(on);
    setDevMode(on);
  }

  if (splash) return <Splash onDone={() => setSplash(false)} />;
  // 온보딩 게이트(가입/로그인 아님). 완료 후 홈 허브로 착지.
  if (!nickname) return <Onboarding onDone={(n) => { setNick(n); setRoute('home'); }} />;

  return (
    <div className="screen">
      {route === 'home' && (
        <Home
          nickname={nickname}
          go={setRoute}
          onNew={() => { setLoaded(null); setForked(null); setRoute('studio'); }}
          onOpen={(s) => { setForked(null); setLoaded(s); setRoute('studio'); }}
        />
      )}
      {route === 'studio' && <Studio go={setRoute} loaded={loaded} forked={forked} devMode={devMode} />}
      {route === 'community' && <Community go={setRoute} onFork={(s) => { setLoaded(null); setForked(s); setRoute('studio'); }} />}
      {route === 'settings' && <Settings go={setRoute} devMode={devMode} onToggleDev={toggleDev} />}
    </div>
  );
}
