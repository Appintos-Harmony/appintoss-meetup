---
name: execute-work-order
description: TASK 작업지시서에 따라 경계가 명확한 구현을 수행하고 검증 증거를 남길 때 사용한다.
---

1. 작업지시서의 수락 기준, `allowed_paths`, `forbidden_paths`, 검증 명령을 먼저 요약한다.
2. `allowed_paths` 밖 변경은 하지 않는다. 같은 파일을 수정 중인 Claude 작업과 병렬 쓰기 금지. 가능하면 worktree/격리 브랜치에서 작업한다.
3. 작은 검증 가능 단위로 구현한다. TypeScript strict, 입력 검증, 객체 단위 권한, 서버 측 도메인 규칙을 지킨다.
4. 지정된 검증 명령(lint·typecheck·unit·integration·build)을 실행한다.
5. 결과를 §7.3 결과 계약으로 반환한다:
   ① 작업 ID·상태 ② 확인 입력·근거 ③ 가정·미확정 ④ 변경 내용 ⑤ 변경 파일 ⑥ 실행 명령 ⑦ 실제 결과 ⑧ 실패·생략 검증(Not Run) ⑨ 남은 위험 ⑩ 검토자 요청 ⑪ 다음 사람 확인 항목.
6. 비밀값·테스트 우회 경로를 남기지 않는다. merge·push·tag·migration·production 배포 금지(사람 승인).
