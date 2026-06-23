import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Providers } from './Providers';
import './theme.css';

// 2트랙: 토스 WebView 안 = TDS 정본(Providers 가 TDSMobileBedrockProvider 주입) / 일반 브라우저 = theme.css 폴백.
// (TDS 는 토스 WebView 밖에서 throw → Providers 가 isInToss() 로 가드. 폴백은 theme.css 그대로 동작.)
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
);
