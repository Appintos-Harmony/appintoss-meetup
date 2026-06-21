import { useState } from 'react';
import { Button } from '@toss/tds-mobile';
import { getUserKey, setNickname } from '../lib/identity';

export function Onboarding({ onDone }: { onDone: (nickname: string) => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    await getUserKey(); // 익명 식별키 발급/복원 (토스 로그인 아님)
    setNickname(name);
    onDone(name.trim());
  }

  return (
    <div className="screen">
      <div className="content fade" style={{ paddingTop: 48 }}>
        <h1 className="t-title">하모니</h1>
        <p className="t-body c-sub" style={{ marginTop: 6 }}>
          닉네임만 정하면 바로 연주해요.
          <br />
          가입·로그인 없어요.
        </p>
        <div className="card" style={{ marginTop: 20 }}>
          <input
            className="input"
            placeholder="닉네임 (예: 토스밴드)"
            value={name}
            maxLength={16}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      </div>
      <div style={{ padding: 20 }}>
        <Button display="full" size="xlarge" disabled={!name.trim() || busy} loading={busy} onClick={start}>
          시작하기
        </Button>
      </div>
    </div>
  );
}
