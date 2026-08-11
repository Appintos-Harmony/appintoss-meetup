// ERD DA# drawio만 생성(다른 6개 drawio는 건드리지 않음).
// 속성·순서·키 표기를 테이블_정의서.md(=apps/api/server.mjs 스키마)와 1:1 일치시킨다.
import fs from 'node:fs';
import path from 'node:path';
const OUTDIR = path.resolve(import.meta.dirname, '..'); // 산출물/04_시스템설계 (이식성: 사용자 경로 하드코딩 제거)
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

// 속성 = 테이블_정의서.md 순서 그대로(컬럼명만, 키/FK 표기). 합쳐 쓰지 않고 1컬럼 1행.
entity('ses', 640, 180, 340, 392, '곡', 'sessions', '#4F46E5',
  [{ f: 'code' }],
  [{ f: 'name' }, { f: 'bpm' }, { f: 'created_at' }, { f: 'published' }, { f: 'author' }, { f: 'author_key' }, { f: 'origin_code', tag: 'FK' }, { f: 'play_count' }, { f: 'hidden' }, { f: 'content_hash' }, { f: 'track_count' }]);
entity('trk', 100, 210, 330, 282, '트랙', 'tracks', '#2563EB',
  [{ f: 'id' }],
  [{ f: 'code', tag: 'FK' }, { f: 'owner' }, { f: 'events' }, { f: 'instrument' }, { f: 'style' }, { f: 'author_key' }, { f: 'created_at' }]);
entity('rea', 1240, 200, 330, 150, '좋아요', 'reactions', '#DB2777',
  [{ f: 'code', tag: 'FK' }, { f: 'anon_key' }],
  [{ f: 'created_at' }]);
entity('cmt', 640, 690, 340, 300, '댓글', 'comments', '#0D9488',
  [{ f: 'id' }],
  [{ f: 'code', tag: 'FK' }, { f: 'author_key' }, { f: 'author' }, { f: 'text' }, { f: 'created_at' }, { f: 'reports' }, { f: 'hidden' }]);
entity('rep', 1240, 690, 330, 150, '신고', 'comment_reports', '#D97706',
  [{ f: 'comment_id', tag: 'FK' }, { f: 'reporter_key' }],
  [{ f: 'created_at' }]);

rel('ses', 'trk', false, '비식별 1:N');
rel('ses', 'rea', true, '식별 1:N');
rel('ses', 'cmt', false, '비식별 1:N');
rel('cmt', 'rep', true, '식별 1:N');
rel('ses', 'ses', false, 'origin_code (파생·비식별)');

// 부재 콜아웃 + 범례 (텍스트 박스)
cells.push(`<mxCell id="${nid()}" value="${xml('<b style="color:#C2410C">⌀ users / auth 개체: 없음</b><br>회원·세션·토큰 개체 부재.<br>식별 = 익명키 컬럼만(author_key·anon_key·reporter_key)<br>→ 인증 없음 = 의도된 데모 범위.')}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFF7ED;strokeColor=#FB923C;dashed=1;dashPattern=7 5;align=left;verticalAlign=top;spacingLeft=10;spacingTop=8;fontSize=11;fontColor=#9A3412;" vertex="1" parent="1"><mxGeometry x="100" y="560" width="330" height="120" as="geometry"/></mxCell>`);
cells.push(`<mxCell id="${nid()}" value="${xml('<b>DA# 표기</b>  실선=식별 관계(FK가 자식 PK 구성: 좋아요·신고) · 점선=비식별(트랙·댓글·자기참조) · ERmany(까마귀발)=N · ERone(바)=1 · <u>밑줄</u>=식별자(PK) · [FK]=외래키 · 속성=실제 SQLite 컬럼(테이블_정의서.md 순서·이름 1:1)')}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#F8FAFC;strokeColor=#E2E8F0;align=left;verticalAlign=middle;spacingLeft=12;fontSize=11;fontColor=#334155;" vertex="1" parent="1"><mxGeometry x="100" y="1030" width="1470" height="56" as="geometry"/></mxCell>`);

const out = `<mxfile host="app.diagrams.net" type="device"><diagram name="하모니_데이터모델_ERD_DA" id="erd-da"><mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1720" pageHeight="1150" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells.join('\n')}</root></mxGraphModel></diagram></mxfile>`;
fs.writeFileSync(path.join(OUTDIR, '하모니_데이터모델_ERD.drawio'), out, 'utf8');
console.log('OK ERD DA# drawio written (only ERD) · cells', cells.length, '· out', path.join(OUTDIR, '하모니_데이터모델_ERD.drawio'));
