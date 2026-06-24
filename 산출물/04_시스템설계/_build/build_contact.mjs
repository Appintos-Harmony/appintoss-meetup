import fs from 'node:fs';
import path from 'node:path';

const SRC = 'C:/Users/김민혁/Desktop/dev/appintoss-meetup/산출물/04_시스템설계/아키텍처_아이콘';
const OUT = 'C:/Users/Public/arch_tmp';
fs.mkdirSync(OUT, { recursive: true });

const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.svg')).sort();
const tiles = files.map((f) => {
  const svg = fs.readFileSync(path.join(SRC, f), 'utf8');
  const uri = 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64');
  return `<div class="t"><div class="ic"><img src="${uri}"/></div><div class="lb">${f.replace('.svg', '')}</div></div>`;
}).join('');

const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#fff;font-family:'Segoe UI',Arial,sans-serif}
.grid{display:flex;flex-wrap:wrap;gap:14px;padding:22px;width:860px;box-sizing:border-box}
.t{width:118px;display:flex;flex-direction:column;align-items:center;gap:7px}
.ic{width:74px;height:74px;display:flex;align-items:center;justify-content:center;border:1px solid #e5e7eb;border-radius:16px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.07)}
.ic img{width:46px;height:46px;object-fit:contain}
.lb{font-size:12px;color:#334155;text-align:center;word-break:break-all;line-height:1.2}
</style><div class="grid">${tiles}</div>`;

fs.writeFileSync(path.join(OUT, 'contact.html'), html, 'utf8');
console.log('icons:', files.length, '→', files.join(', '));
