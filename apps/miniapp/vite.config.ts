import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // TDS(@toss/tds-mobile-ait) + emotion 이 React 사본을 중복 로드하지 않도록 단일화.
  resolve: { dedupe: ['react', 'react-dom', '@emotion/react'] },
  server: { host: true, port: 5173, strictPort: true },
});
