import { useState } from 'react';
import { getNickname } from './lib/identity';
import type { Song } from './lib/storage';
import { Splash } from './routes/Splash';
import { Onboarding } from './routes/Onboarding';
import { Home } from './routes/Home';
import { Studio } from './routes/Studio';
import { Community } from './routes/Community';
import { Settings } from './routes/Settings';

// 라우트 = 평면 5상태. 'community' 추가는 append-only(기존 멤버 제거/rename 금지 — 머지 계약).
export type Route = 'home' | 'studio' | 'community' | 'settings';

export function App() {
  const [splash, setSplash] = useState(true); // 매 구동마다 짧은 브랜드 스플래시(라이트 리빌)
  const [nickname, setNick] = useState<string | null>(() => getNickname());
  const [route, setRoute] = useState<Route>('home');
  const [loaded, setLoaded] = useState<Song | null>(null);

  // 스플래시(로고+이름 라이트 리빌) → 그 다음 온보딩/홈 허브.
  if (splash) {
    return <Splash onDone={() => setSplash(false)} />;
  }
  // 온보딩 게이트: 닉네임 없으면 닉네임부터(가입/로그인 아님). 완료 후 홈 허브로 착지.
  if (!nickname) {
    return <Onboarding onDone={(n) => { setNick(n); setRoute('home'); }} />;
  }
  return (
    <div className="screen">
      {route === 'home' && (
        <Home nickname={nickname} go={setRoute} onOpen={(s) => { setLoaded(s); setRoute('studio'); }} />
      )}
      {route === 'studio' && <Studio go={setRoute} loaded={loaded} />}
      {route === 'community' && <Community go={setRoute} />}
      {route === 'settings' && <Settings go={setRoute} />}
    </div>
  );
}
