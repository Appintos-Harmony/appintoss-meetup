// ERD DA# drawio만 생성(다른 6개 drawio는 건드리지 않음)
import fs from 'node:fs';
import path from 'node:path';
const OUTDIR = 'C:/Users/김민혁/Desktop/dev/appintoss-meetup/산출물/04_시스템설계';
const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let id = 2; const nid = () => 'c' + (id++);
const cells = []; const ref = {};
function entity(key, x, y, w, h, ko, en, accent, pks, attrs) {
  const cid = nid(); ref[key] = cid;
  const head = `<b style="font-size:14px;color:${accent}">${ko}</b>&nbsp;<font style="font-size:9px;color:#94A3B8">${en}</font>`;
  const pkRows = pks.map((p) => `<u><b>${p.f}</b></u>${p.tag ? ' <font style="color:#2563EB;font-size:9px">[' + p.tag + ']</font>' : ''}`).join('<br>');
  const atRows = attrs.map((a) => `${a.f}${a.tag ? ' <font style="color:#2563EB;font-size:9px">[' + a.tag + ']</font>' : ''}`).join('<br>');
  const html = `${head}<hr size="1">${pkRows}<hr size="1">${atRows}`;
  cells.push(`<mxCell id="${cid}" value="${xml(html)}" style="rounded=1;arcSize=4;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=${accent};align=left;verticalAlign=top;spacingLeft=10;spacingTop=8;spacingRight=8;fontSize=12;fontColor=#1E293B;shadow=1;" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
}
function rel(a, b, identifying, label) {
  const dash = identifying ? '' : 'dashed=1;dashPattern=6 4;';
  cells.push(`<mxCell id="${nid()}" value="${xml(label || '')}" style="edgeStyle=entityRelationEdgeStyle;rounded=0;html=1;${dash}startArrow=ERone;startFill=0;endArrow=ERmany;endFill=0;strokeColor=#475569;fontSize=10;fontColor=#475569;labelBackgroundColor=#FFFFFF;" edge="1" parent="1" source="${ref[a]}" target="${ref[b]}"><mxGeometry relative="1" as="geometry"/></mxCell>`);
}

entity('ses', 640, 190, 340, 360, '곡', 'sessions', '#4F46E5',
  [{ f: 'code' }],
  [{ f: 'name' }, { f: 'bpm' }, { f: 'published' }, { f: 'hidden' }, { f: 'author' }, { f: 'author_key' }, { f: 'origin_code', tag: 'FK' }, { f: 'play_count' }, { f: 'created_at' }, { f: 'content_hash · track_count' }]);
entity('trk', 100, 220, 330, 250, '트랙', 'tracks', '#2563EB',
  [{ f: 'id' }],
  [{ f: 'code', tag: 'FK' }, { f: 'owner' }, { f: 'author_key' }, { f: 'events (JSON)' }, { f: 'instrument · style' }, { f: 'created_at' }]);
entity('rea', 1240, 200, 330, 150, '좋아요', 'reactions', '#DB2777',
  [{ f: 'code', tag: 'FK' }, { f: 'anon_key' }],
  [{ f: 'created_at' }]);
entity('cmt', 640, 680, 340, 280, '댓글', 'comments', '#0D9488',
  [{ f: 'id' }],
  [{ f: 'code', tag: 'FK' }, { f: 'author_key' }, { f: 'author' }, { f: 'text (≤200)' }, { f: 'reports' }, { f: 'hidden' }, { f: 'created_at' }]);
entity('rep', 1240, 680, 330, 150, '신고', 'comment_reports', '#D97706',
  [{ f: 'comment_id', tag: 'FK' }, { f: 'reporter_key' }],
  [{ f: 'created_at' }]);

rel('ses', 'trk', false, '비식별 1:N');
rel('ses', 'rea', true, '식별 1:N');
rel('ses', 'cmt', false, '비식별 1:N');
rel('cmt', 'rep', true, '식별 1:N');
rel('ses', 'ses', false, 'origin_code (파생·비식별)');

// 부재 콜아웃 + 범례 (텍스트 박스)
cells.push(`<mxCell id="${nid()}" value="${xml('<b style="color:#C2410C">⌀ users / auth 개체 — 없음</b><br>회원·세션·토큰 개체 부재.<br>식별 = 익명키 컬럼만(author_key·anon_key·reporter_key)<br>→ 인증 없음 = 의도된 데모 범위.')}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFF7ED;strokeColor=#FB923C;dashed=1;dashPattern=7 5;align=left;verticalAlign=top;spacingLeft=10;spacingTop=8;fontSize=11;fontColor=#9A3412;" vertex="1" parent="1"><mxGeometry x="100" y="540" width="330" height="120" as="geometry"/></mxCell>`);
cells.push(`<mxCell id="${nid()}" value="${xml('<b>DA# 표기</b>  실선=식별 관계(FK가 자식 PK 구성: 좋아요·신고) · 점선=비식별(트랙·댓글·자기참조) · ERmany(까마귀발)=N · ERone(바)=1 · <u>밑줄</u>=식별자(PK) · [FK]=외래키')}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#F8FAFC;strokeColor=#E2E8F0;align=left;verticalAlign=middle;spacingLeft=12;fontSize=11;fontColor=#334155;" vertex="1" parent="1"><mxGeometry x="100" y="1000" width="1470" height="56" as="geometry"/></mxCell>`);

const out = `<mxfile host="app.diagrams.net" type="device"><diagram name="하모니_데이터모델_ERD_DA" id="erd-da"><mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1720" pageHeight="1120" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells.join('\n')}</root></mxGraphModel></diagram></mxfile>`;
fs.writeFileSync(path.join(OUTDIR, '하모니_데이터모델_ERD.drawio'), out, 'utf8');
console.log('OK ERD DA# drawio written (only ERD) · cells', cells.length);
