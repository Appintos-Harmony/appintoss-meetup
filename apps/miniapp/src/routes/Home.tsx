import type { Route } from '../App';

export function Home({ nickname, go }: { nickname: string; go: (r: Route) => void }) {
  return (
    <>
      <div className="appbar">하모니</div>
      <div className="content fade">
        <p className="t-body">
          안녕하세요, <b>{nickname}</b>님
        </p>
        <div className="card" style={{ marginTop: 12 }}>
          <p className="t-body c-sub">아직 만든 곡이 없어요. 스튜디오에서 첫 곡을 만들어보세요.</p>
        </div>
        <button className="btn" style={{ marginTop: 16 }} onClick={() => go('studio')}>
          스튜디오 열기
        </button>
        <button
          className="btn"
          style={{ marginTop: 10, background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--shadow)' }}
          onClick={() => go('settings')}
        >
          설정
        </button>
      </div>
    </>
  );
}
