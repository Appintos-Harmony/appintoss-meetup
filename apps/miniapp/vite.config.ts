import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import aitDevtools from "@apps-in-toss/devtools/unplugin";

export default defineConfig({
  plugins: [aitDevtools.vite(), react()],
  // TDS(@toss/tds-mobile-ait) + emotion 이 React 사본을 중복 로드하지 않도록 단일화.
  resolve: { dedupe: ['react', 'react-dom', '@emotion/react'] },
  // host:true=0.0.0.0 바인딩, allowedHosts:true=Cloudflare 터널(*.trycloudflare.com) Host 허용(모바일 HTTPS QA용).
  server: { host: true, port: 5173, strictPort: true, allowedHosts: true },
});
