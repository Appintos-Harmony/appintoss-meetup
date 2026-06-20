---
name: create-deliverable
description: 산출물 문서를 한글 경로 규칙·메타데이터·추적성에 맞게 생성하거나 갱신할 때 사용한다.
---

산출물은 `산출물_목록.md`의 경로 매핑을 기준으로 한다(CLAUDE.md §8.1·§9·§11).

1. 대상 산출물의 한글 경로·파일명을 `산출물_목록.md`에서 확인한다(영문 docs/·중복본 금지).
2. 메타데이터 헤더(status/owner/reviewers/last_updated/related_requirements/related_adrs)를 넣는다. owner·reviewer는 실제 팀원만.
3. 문서 제목은 자연스러운 한글 띄어쓰기, 파일명은 밑줄 구분.
4. 결정에는 선택지·근거·장단점·영향을 쓴다. 사실/가정을 구분(`Assumption`/`Open Question`).
5. 같은 내용을 복제하지 않고 기준 문서를 링크한다. 빈 목차·장식 표현 금지.
6. 경로를 바꾸면 링크·`산출물_목록`·요구사항 추적표를 같은 변경에서 함께 고친다.
