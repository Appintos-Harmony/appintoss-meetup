import { useState } from 'react';
import type { Route } from '../App';
import { getNickname, getEmoji, setEmoji, EMOJI_CHOICES } from '../lib/identity';

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
  const [emoji, setEmojiState] = useState<string>(() => getEmoji());
  const [picker, setPicker] = useState(false);

  function pick(e: string) {
    setEmoji(e);
    setEmojiState(e);
    setPicker(false);
  }

  return (
    <>
      <div className="appbar">설정</div>
      <div className="content fade">
        {/* 프로필 미리보기 */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--blue-weak)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, flex: 'none' }}>
            {emoji}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t-body" style={{ fontWeight: 800 }}>{getNickname() ?? '게스트'}</div>
            <div className="t-cap c-sub" style={{ marginTop: 2 }}>내 프로필</div>
          </div>
        </div>

        <div className="card" style={{ padding: '4px 10px', marginTop: 14 }}>
          <InfoRow label="닉네임" value={getNickname() ?? '-'} />
          <div style={{ height: 1, background: 'var(--line)' }} />
          <InfoRow label="버전" value="1.0.0" />
          <div style={{ height: 1, background: 'var(--line)' }} />
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 8px', cursor: 'pointer' }}
            onClick={() => setPicker(true)}
          >
            <span className="t-body" style={{ fontWeight: 600 }}>이모지 프로필</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 24 }}>{emoji}</span>
              <span className="t-body c-sub">변경 ›</span>
            </span>
          </div>
        </div>

        {/* 개발자 모드 토글 */}
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
            <span style={{ position: 'absolute', top: 3, left: devMode ? 23 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', boxShadow: 'var(--e1)', transition: 'left .18s var(--spring)' }} />
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

        <button className="btn" style={{ marginTop: 20, background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--e2)' }} onClick={() => go('home')}>
          홈으로
        </button>
      </div>

      {/* 이모지 선택 바텀시트 */}
      {picker && (
        <>
          <div className="backdrop" onClick={() => setPicker(false)} />
          <div className="sheet">
            <div className="sheet-grip" />
            <div className="t-title" style={{ padding: '4px 6px 12px' }}>이모지 프로필 고르기</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, paddingBottom: 8 }}>
              {EMOJI_CHOICES.map((e) => (
                <button
                  key={e}
                  onClick={() => pick(e)}
                  style={{
                    aspectRatio: '1',
                    border: emoji === e ? '2px solid var(--blue)' : '1.5px solid var(--line)',
                    borderRadius: 14,
                    background: emoji === e ? 'var(--blue-weak)' : 'var(--surface)',
                    fontSize: 26,
                    cursor: 'pointer',
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
