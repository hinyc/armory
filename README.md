# armory

개인 업무용 Claude Code 플러그인.

## 구성

| 종류 | 이름 | 용도 |
|---|---|---|
| 스킬 | `commit` | 여러 변경을 담은 커밋 메시지 정리 |
| 스킬 | `issue-writer` | GitHub 이슈·Jira 티켓을 표준 양식으로 작성·수정·정리 |
| 스킬 | `status-dashboard` | AI가 관리하는 JSON + HTML 진행 대시보드 |
| 스킬 | `screen-spec` | 실제 화면 캡처 + 목 API + 코드 기반 설명으로 화면설계서 생성·업데이트 (Playwright) |

## 설치

```
/plugin marketplace add hinyc/armory
/plugin install armory@armory
```

개발 중 로컬 테스트: `claude --plugin-dir ~/Documents/GitHub/armory`
