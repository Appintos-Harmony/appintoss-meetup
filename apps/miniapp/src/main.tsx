import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { UiShell } from './ui/UiShell';
import './theme.css';

// 2트랙 셸: 토스(WebView/샌드박스)에서만 UiShell 이 TDS 를 동적 로드한다.
// 일반 브라우저(AWS)에서는 UiShell 이 children 만 렌더 → 자체 theme.css 그대로(TDS 미평가).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UiShell>
      <App />
    </UiShell>
  </StrictMode>,
);
