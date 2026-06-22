import type { Route } from '../App';
import { getNickname } from '../lib/identity';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 8px' }}>
      <span className="t-body" style={{ fontWeight: 600 }}>{label}</span>
      <span className="t-body c-sub">{value}</span>
    </div>
  );
}

export function Settings({
  go,
  devMode,
  onToggleDev,
}: {
  go: (r: Route) => void;
  devMode: boolean;
  onToggleDev: (on: boolean) => void;
}) {
  return (
    <>
      <div className="appbar">설정</div>
      <div className="content fade">
        <div className="card" style={{ padding: '4px 10px' }}>
          <InfoRow label="닉네임" value={getNickname() ?? '-'} />
          <div style={{ height: 1, background: 'var(--line)' }} />
          <InfoRow label="버전" value="1.0.0" />
        </div>

        {/* 개발자 모드 토글 (FPS·네트워크·손 스켈레톤) */}
        <div
          className="card"
          style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
          onClick={() => onToggleDev(!devMode)}
        >
          <div style={{ flex: 1 }}>
            <div className="t-body" style={{ fontWeight: 700 }}>🛠 개발자 모드</div>
            <div className="t-cap c-sub" style={{ marginTop: 2 }}>FPS · 네트워크 · 손 스켈레톤 표시</div>
          </div>
          <div
            style={{
              width: 48,
              height: 28,
              borderRadius: 999,
              background: devMode ? 'var(--blue)' : 'var(--line-2)',
              position: 'relative',
              transition: 'background .18s var(--ease)',
              flex: 'none',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 3,
                left: devMode ? 23 : 3,
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: '#fff',
                boxShadow: 'var(--e1)',
                transition: 'left .18s var(--spring)',
              }}
            />
          </div>
        </div>

        <div className="t-cap c-sub" style={{ fontWeight: 700, margin: '20px 4px 8px' }}>법적 고지 (초안)</div>
        <div className="card" style={{ padding: '4px 10px' }}>
          <InfoRow label="이용약관" value="준비 중" />
          <div style={{ height: 1, background: 'var(--line)' }} />
          <InfoRow label="개인정보 처리방침" value="준비 중" />
        </div>

        <p className="t-cap c-sub" style={{ marginTop: 14, lineHeight: 1.7 }}>
          고객센터는 토스 공통 메뉴를 이용해 주세요. 하모니는 토스 익명 식별(getAnonymousKey)만 사용하며,
          별도의 개인정보를 수집하지 않아요.
        </p>

        <button
          className="btn"
          style={{ marginTop: 20, background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--e2)' }}
          onClick={() => go('home')}
        >
          홈으로
        </button>
      </div>
    </>
  );
}
