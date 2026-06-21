import type { Route } from '../App';

export function Settings({ go }: { go: (r: Route) => void }) {
  return (
    <>
      <div className="appbar">설정</div>
      <div className="content fade">
        <div className="card">
          <p className="t-body c-sub">고객센터는 토스 공통 메뉴를 이용해 주세요.</p>
        </div>
        <button className="btn" style={{ marginTop: 16 }} onClick={() => go('home')}>
          홈으로
        </button>
      </div>
    </>
  );
}
