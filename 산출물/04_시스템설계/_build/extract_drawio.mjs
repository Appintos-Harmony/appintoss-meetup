// 읽기 전용: 각 .drawio의 노드/엣지 텍스트를 추출해 리뷰용 요약 출력(파일 수정 안 함)
import fs from 'node:fs';
import path from 'node:path';
const OUT = 'C:/Users/김민혁/Desktop/dev/appintoss-meetup/산출물/04_시스템설계';
const FILES = ['하모니_시스템_아키텍처', '하모니_서비스_흐름도', '하모니_AWS_배포_아키텍처', '하모니_배포_인프라_구성도', '하모니_데이터모델_ERD', '하모니_신뢰경계_DFD', '하모니_라이프사이클_상태도'];
const dec = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#10;/g, ' / ').replace(/&amp;/g, '&').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
for (const f of FILES) {
  const xml = fs.readFileSync(path.join(OUT, f + '.drawio'), 'utf8');
  const cells = [...xml.matchAll(/<mxCell\b([^>]*)>/g)].map((m) => m[1]);
  let vtx = [], edg = [];
  for (const a of cells) {
    const vm = a.match(/\bvalue="([^"]*)"/); const val = vm ? dec(vm[1]) : '';
    if (/\bvertex="1"/.test(a)) { if (val) vtx.push(val); }
    else if (/\bedge="1"/.test(a)) { edg.push(val || '(라벨없음)'); }
  }
  console.log('\n===== ' + f + ' =====');
  console.log('[노드 ' + vtx.length + ']');
  vtx.forEach((v) => console.log('  • ' + v));
  console.log('[엣지 ' + edg.length + '] ' + edg.map((e) => e).join(' | '));
}
