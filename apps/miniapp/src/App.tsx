import { useState } from 'react';
import { getNickname } from './lib/identity';
import type { Song } from './lib/storage';
import { Onboarding } from './routes/Onboarding';
import { Home } from './routes/Home';
import { Studio } from './routes/Studio';
import { Settings } from './routes/Settings';
import { Community } from './routes/Community';

export type Route = 'home' | 'studio' | 'settings' | 'community';

export function App() {
  const [nickname, setNick] = useState<string | null>(() => getNickname());
  const [route, setRoute] = useState<Route>('studio');
  const [loaded, setLoaded] = useState<Song | null>(null);

  // 온보딩 게이트: 닉네임 없으면 닉네임부터(가입/로그인 아님).
  if (!nickname) {
    return <Onboarding onDone={(n) => { setNick(n); setRoute('studio'); }} />;
  }
  return (
    <div className="screen">
      {route === 'home' && (
        <Home nickname={nickname} go={setRoute} onOpen={(s) => { setLoaded(s); setRoute('studio'); }} />
      )}
      {route === 'studio' && <Studio go={setRoute} loaded={loaded} />}
      {route === 'settings' && <Settings go={setRoute} />}
      {route === 'community' && <Community go={setRoute} />}
    </div>
  );
}
