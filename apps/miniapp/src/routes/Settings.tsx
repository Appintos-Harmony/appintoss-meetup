import { useState, useEffect, lazy, Suspense } from 'react';
import type { CSSProperties } from 'react';
import type { Route } from '../App';
import { getNickname, getEmoji, setEmoji, EMOJI_CHOICES, getUserKey } from '../lib/identity';
import { TERMS, PRIVACY, type LegalDoc } from '../lib/legal';
import { getRuntimeEnv, isToss } from '../lib/platform';

// 샌드박스 폰 실증용 TDS 배지(토스에서만 동적 로드 → AWS 번들은 평가하지 않음).
const TdsBadge = isToss() ? lazy(() => import('../ui/TdsBadge')) : null;

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 8px' }}>
      <span className="t-body" style={{ fontWeight: 600 }}>{label}</span>
      <span className="t-body c-sub">{value}</span>
    </div>
  );
}

const legalRow: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 8px', width: '100%', border: 0, background: 'transparent', cursor: 'pointer', font: 'inherit', color: 'var(--text)' };

// 법적 고지 모달(스크롤). 내용은 lib/legal.ts(초안).
function LegalSheet({ doc, onClose }: { doc: LegalDoc; onClose: () => void }) {
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" style={{ maxHeight: '82vh', display: 'flex', flexDirection: 'column' }}>
        <div className="sheet-grip" />
        <div className="t-title" style={{ padding: '2px 6px 2px' }}>{doc.title}</div>
        <div className="t-cap c-sub" style={{ padding: '0 6px 8px' }}>{doc.updated}</div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 6px' }}>
          <p className="t-body c-sub2" style={{ lineHeight: 1.7, marginTop: 0 }}>{doc.intro}</p>
          {doc.sections.map((s, i) => (
            <div key={i} style={{ marginTop: 14 }}>
              <div className="t-body" style={{ fontWeight: 700 }}>{s.h}</div>
              {s.p.map((para, j) => (
                <p key={j} className="t-cap c-sub2" style={{ lineHeight: 1.7, margin: '6px 0 0' }}>· {para}</p>
              ))}
            </div>
          ))}
          <div style={{ height: 6 }} />
        </div>
        <button className="btn" style={{ marginTop: 10, background: 'var(--bg)', color: 'var(--text-2)' }} onClick={onClose}>닫기</button>
      </div>
    </>
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
  const [legal, setLegal] = useState<'terms' | 'privacy' | null>(null);
  const [proofKey, setProofKey] = useState<string>('…');
  const runtimeEnv = getRuntimeEnv();

  // 2트랙 실증 패널용: 실제 식별키(토스=toss_hash, web=anon_)를 비동기로 읽는다.
  useEffect(() => {
    let alive = true;
    getUserKey().then((k) => {
      if (alive) setProofKey(k);
    });
    return () => {
      alive = false;
    };
  }, []);

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

        {/* 2트랙 실증 패널: 개발자 모드일 때만. 샌드박스 폰에서 한 화면 = 환경·식별키·TDS 증거 */}
        {devMode && (
          <div className="card" style={{ marginTop: 14, padding: '4px 10px' }}>
            <div className="t-body" style={{ fontWeight: 700, padding: '12px 8px 6px' }}>🔬 2트랙 실증</div>
            <InfoRow label="실행 환경" value={runtimeEnv === 'web' ? 'web (브라우저/AWS)' : runtimeEnv} />
            <div style={{ height: 1, background: 'var(--line)' }} />
            <InfoRow label="식별키" value={proofKey.length > 16 ? proofKey.slice(0, 16) + '…' : proofKey} />
            <div style={{ height: 1, background: 'var(--line)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 8px' }}>
              <span className="t-body" style={{ fontWeight: 600 }}>TDS 렌더</span>
              <span className="t-body c-sub">
                {TdsBadge ? (
                  <Suspense fallback={<>로딩…</>}>
                    <TdsBadge />
                  </Suspense>
                ) : (
                  '미적용 (web)'
                )}
              </span>
            </div>
          </div>
        )}

        <div className="t-cap c-sub" style={{ fontWeight: 700, margin: '20px 4px 8px' }}>법적 고지 (초안)</div>
        <div className="card" style={{ padding: '4px 10px' }}>
          <button type="button" style={legalRow} onClick={() => setLegal('terms')}>
            <span className="t-body" style={{ fontWeight: 600 }}>이용약관</span>
            <span className="t-body c-sub">보기 ›</span>
          </button>
          <div style={{ height: 1, background: 'var(--line)' }} />
          <button type="button" style={legalRow} onClick={() => setLegal('privacy')}>
            <span className="t-body" style={{ fontWeight: 600 }}>개인정보 처리방침</span>
            <span className="t-body c-sub">보기 ›</span>
          </button>
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
      {legal && <LegalSheet doc={legal === 'terms' ? TERMS : PRIVACY} onClose={() => setLegal(null)} />}
    </>
  );
}
