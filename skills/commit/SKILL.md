---
name: commit
description: Use when creating git commits with multiple changes, to structure messages with clear titles and concise details that make changes easy to understand
---

# 커밋 메시지 작성

커밋하는 이 세션이 메시지를 직접 쓴다. 다른 에이전트에 초안을 맡기지 않는다.

## 절차

1. 커밋할 파일을 `git add` 한다.
2. `git diff --cached`로 스테이징된 내용이 메시지와 맞는지 확인한다. 이 세션이 만들지 않은 변경이 있으면 그 diff를 읽고 쓴다.
3. 아래 형식으로 메시지를 써서 `git commit` 한다.

## 형식

```
<타입>: <한글 요약 제목>

- 수정사항 1
- 수정사항 2
- 수정사항 3
```

- 타입: `feat` 새 기능, `fix` 버그 수정, `refactor` 코드 개선, `perf` 성능 최적화, `docs` 문서 수정, `test` 테스트 추가·수정, `chore` 빌드·의존성 등
- 제목: 전체 변경을 동사로 요약, 50자 이내, 마침표 없음
- 제목 다음에 공백줄을 둔다.
- 상세내용: 3-5줄 `- ` bullet, 한 줄에 수정사항 하나, 끝에 마침표 없음. 수정사항이 1개면 생략해도 된다.
- 관련 이슈는 제목 끝에 번호·코드를 붙인다. 예: `fix: 로그인 오류 수정 (#123)`
- `Co-Authored-By:` 줄은 제거한다.
- 한글로 쓴다.
- 파일명 대신 기능·컴포넌트 이름을 쓰고, 무엇을 바꿨는지 분명히 적는다. 기술 용어는 필요할 때만 쓴다.

## 예시

```
feat: 사용자 역할 요청 기능 추가

- 역할 요청 API 엔드포인트 구현
- 요청 현황 조회 화면 추가
- 승인/거절 상태 관리 로직 완성
```
