// 커뮤니티 진입 스텁. 본체(SCR-C01~04)는 조장(이상혁) 스트림. 초기화면 허브에서 라우팅만 연결.
import type { Route } from '../App';

export function Community({ go }: { go: (r: Route) => void }) {
  return (
    <>
      <div className="appbar">
        커뮤니티
        <span className="c-sub" style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 500, cursor: 'pointer' }} onClick={() => go('home')}>
          홈
        </span>
      </div>
      <div
        className="content fade"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, textAlign: 'center', gap: 12, paddingBottom: 64 }}
      >
        <div style={{ fontSize: 44 }}>🎧</div>
        <h1 className="t-title">커뮤니티 준비 중</h1>
        <p className="t-body c-sub">
          다른 사람 음원을 둘러보고
          <br />
          내 연주를 얹는 기능이 곧 추가돼요.
        </p>
        <button className="btn" style={{ marginTop: 8, background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--e2)' }} onClick={() => go('home')}>
          홈으로
        </button>
      </div>
    </>
  );
}
