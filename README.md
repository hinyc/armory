# armory

개인 업무용 Claude Code 플러그인.

## 구성

| 종류 | 이름 | 용도 |
|---|---|---|
| 스킬 | `commit` | 여러 변경을 담은 커밋 메시지 정리 |
| 스킬 | `issue-cleanup` | GitHub 이슈·Jira 티켓 본문을 표준 양식으로 정리 |
| 스킬 | `status-dashboard` | AI가 관리하는 JSON + HTML 진행 대시보드 |

## 설치

```
/plugin marketplace add hinyc/armory
/plugin install armory@armory
```

개발 중 로컬 테스트: `claude --plugin-dir ~/Documents/GitHub/armory`
