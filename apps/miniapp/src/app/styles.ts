import type { CSSProperties } from 'react';

// Toss 느낌: 파랑/흰색/회색, 둥근 카드, 큰 터치 영역.
export const theme = {
  blue: '#3182F6',
  blueDark: '#1B64DA',
  bg: '#F2F4F6',
  card: '#FFFFFF',
  text: '#191F28',
  sub: '#8B95A1',
  line: '#E5E8EB',
  danger: '#E5483D',
  ok: '#15803D',
} as const;

export const s: Record<string, CSSProperties> = {
  app: { fontFamily: 'system-ui, -apple-system, sans-serif', background: theme.bg, color: theme.text, minHeight: '100vh' },
  container: { maxWidth: 480, margin: '0 auto', padding: 16 },
  card: { background: theme.card, borderRadius: 16, padding: 16, marginBottom: 12, border: `1px solid ${theme.line}` },
  primaryBtn: { background: theme.blue, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 16px', fontSize: 15, fontWeight: 600, cursor: 'pointer', width: '100%' },
  ghostBtn: { background: '#fff', color: theme.text, border: `1px solid ${theme.line}`, borderRadius: 12, padding: '10px 14px', fontSize: 14, cursor: 'pointer' },
  smallBtn: { border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  input: { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1px solid ${theme.line}`, fontSize: 14, marginTop: 4 },
  label: { fontSize: 13, color: theme.sub, fontWeight: 600 },
  badge: { display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 700 },
  title: { fontSize: 20, fontWeight: 800, margin: '0 0 2px' },
  sub: { color: theme.sub, fontSize: 13 },
};
