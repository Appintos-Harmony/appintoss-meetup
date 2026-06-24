import { useState } from 'react';
import { getUserKey, setNickname } from '../lib/identity';

export function Onboarding({ onDone }: { onDone: (nickname: string) => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      await getUserKey(); // 익명 식별키 발급/복원 (토스 로그인 아님)
      setNickname(name);
      onDone(name.trim());
    } catch {
      setBusy(false); // 식별키 발급 실패(프로드 getAnonymousKey 등) 시 버튼 복구
    }
  }

  return (
    <div className="screen">
      <div className="content fade" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, paddingBottom: 64 }}>
        <img
          src="/logo.png"
          width={72}
          height={72}
          alt="하모니"
          style={{ borderRadius: 16, boxShadow: 'var(--e3)' }}
        />
        <h1 className="t-display" style={{ marginTop: 24 }}>하모니</h1>
        <p className="t-body c-sub2" style={{ marginTop: 8 }}>
          토스에서 악기를 연주하고,
          <br />
          친구와 한 곡을 완성해요.
        </p>

        <div style={{ marginTop: 30 }}>
          <label className="t-cap c-sub" style={{ fontWeight: 700 }}>닉네임</label>
          <input
            className="input"
            style={{ marginTop: 8 }}
            placeholder="예: 토스밴드"
            value={name}
            maxLength={16}
            onChange={(e) => setName(e.target.value)}
          />
          <p className="t-cap c-sub" style={{ marginTop: 10 }}>가입·로그인 없어요. 닉네임만 정하면 끝이에요.</p>
        </div>
      </div>
      <div style={{ padding: 20 }}>
        <button className="btn" style={{ padding: 17, fontSize: 17 }} disabled={!name.trim() || busy} onClick={start}>
          {busy ? '잠시만요…' : '시작하기'}
        </button>
      </div>
    </div>
  );
}
