import { useState, useEffect } from 'react';
import { getNickname } from './lib/identity';
import type { Song } from './lib/storage';
import { Onboarding } from './routes/Onboarding';
import { Home } from './routes/Home';
import { Studio } from './routes/Studio';
import { Community } from './routes/Community';
import { Settings } from './routes/Settings';

// 라우트 = 평면 4상태. 'community' 추가는 append-only(기존 멤버 제거/rename 금지 — 머지 계약).
export type Route = 'home' | 'studio' | 'community' | 'settings';

const ROUTES: Route[] = ['home', 'studio', 'community', 'settings'];
// URL 해시 딥링크(공유용): #community 등으로 바로 진입. 없으면 홈 허브로 착지.
function routeFromHash(): Route {
  const h = (typeof location !== 'undefined' ? location.hash : '').replace(/^#\/?/, '');
  return (ROUTES as string[]).includes(h) ? (h as Route) : 'home';
}

export function App() {
  const [nickname, setNick] = useState<string | null>(() => getNickname());
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [loaded, setLoaded] = useState<Song | null>(null);

  // 수동 해시 변경(#community 등)을 추종.
  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // 온보딩 게이트: 닉네임 없으면 닉네임부터(가입/로그인 아님). 완료 후 (해시 지정 화면 또는) 홈 허브로 착지.
  if (!nickname) {
    return <Onboarding onDone={(n) => { setNick(n); setRoute(routeFromHash()); }} />;
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
