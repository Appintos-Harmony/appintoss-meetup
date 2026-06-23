import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';

// 2트랙: TDS(@toss-design-system/*)는 Toss 환경에서만 설치되는 optional 의존성.
// 미설치(브라우저 데모 빌드)면 external 처리 → rollup 이 해석을 시도하지 않아 빌드가 깨지지 않는다.
// 설치된 Toss 빌드에서는 external 목록이 비어 정상 번들된다. 런타임 로드는 Providers.tsx 가 isInToss() 로 가드.
const require = createRequire(import.meta.url);
const externalTds = ['@toss-design-system/mobile', '@toss-design-system/mobile-ait'].filter((p) => {
  try {
    require.resolve(p);
    return false; // 설치됨 → 번들
  } catch {
    return true; // 미설치 → external
  }
});

export default defineConfig({
  plugins: [react()],
  // TDS(@toss-design-system/mobile-ait) + emotion 이 React 사본을 중복 로드하지 않도록 단일화.
  resolve: { dedupe: ['react', 'react-dom', '@emotion/react'] },
  // host:true=0.0.0.0 바인딩, allowedHosts:true=Cloudflare 터널(*.trycloudflare.com) Host 허용(모바일 HTTPS QA용).
  server: { host: true, port: 5173, strictPort: true, allowedHosts: true },
  build: { rollupOptions: { external: externalTds } },
});
