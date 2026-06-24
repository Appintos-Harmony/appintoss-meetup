// 읽기 전용: 모든 .drawio를 diagrams.net 뷰어 미리보기 HTML로 생성(파일 수정 안 함)
import fs from 'node:fs';
import path from 'node:path';
const OUT = 'C:/Users/김민혁/Desktop/dev/appintoss-meetup/산출물/04_시스템설계';
const TMP = 'C:/Users/Public/arch_tmp';
const MAP = {
  system: '하모니_시스템_아키텍처', flow: '하모니_서비스_흐름도', aws: '하모니_AWS_배포_아키텍처',
  deploy: '하모니_배포_인프라_구성도', erd: '하모니_데이터모델_ERD', dfd: '하모니_신뢰경계_DFD', state: '하모니_라이프사이클_상태도',
};
for (const [k, name] of Object.entries(MAP)) {
  const xml = fs.readFileSync(path.join(OUT, name + '.drawio'), 'utf8');
  const cfg = { xml, toolbar: null, nav: false, highlight: '#ffffff', center: true, zoom: 1 };
  const attr = JSON.stringify(cfg).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#fff}.mxgraph{background:#fff}</style></head><body><div class="mxgraph" style="border:none;" data-mxgraph="${attr}"></div><script src="https://viewer.diagrams.net/js/viewer-static.min.js"></script></body></html>`;
  fs.writeFileSync(path.join(TMP, `dxv_${k}.html`), html, 'utf8');
}
console.log('OK dxv_*.html written for 7 diagrams');
