import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './theme.css';

// TDS(@toss/tds-mobile)는 실제 토스 WebView 밖에서 런타임 throw → 일반 브라우저 배포용은 자체 테마 사용.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
