# armory

개인 업무용 Claude Code 플러그인.

## 구성

| 종류 | 이름 | 용도 |
|---|---|---|
| 스킬 | `commit` | 여러 변경을 담은 커밋 메시지 정리 |
| 스킬 | `issue-writer` | GitHub 이슈·Jira 티켓을 표준 양식으로 작성·수정·정리 |
| 스킬 | `status-dashboard` | AI가 관리하는 JSON + HTML 진행 대시보드 |
| 스킬 | `screen-spec` | 실제 화면 캡처 + 목 API + 코드 기반 설명으로 화면설계서 생성·업데이트 (Playwright) |
| 스킬 + mod | `question-band` | 입력창 위에 현재 질문 요약(최대 4줄)과 질문 시각·경과/소요 시간 표시. `/question-band`로 켜짐/꺼짐 전환 |

## question-band (입력창 위 질문 띠)

플러그인을 설치하면 별도 설정 없이 켜집니다. 코드는 `hooks/question-band/`(표시)와 `skills/question-band/`(전환).

`/question-band`를 실행할 때마다 켜짐↔꺼짐이 바뀌고 바뀐 상태(`질문 띠: 꺼짐`)가 바로 표시됩니다. 설정은 다음 세션에도 유지됩니다.

```
❯ 로그인 엔터 제출 추가
  실패 시 3회 잠금
  ⏳ 14:32:05 질문 · 1분 23초 경과      ← 진행 중 (1초마다 갱신)
  ✓ 14:32:05 질문 · 2분 10초 걸림       ← 완료 후, 다음 질문 전까지 유지
```

- 짧은 질문은 원문 그대로, 길면 haiku로 최대 4줄 요약 (요약 전·실패 시 원문 앞 4줄)
- 직접 입력한 질문만 대상 (백그라운드 알림·자동 이어가기·서브에이전트 턴 제외)
- 다른 mod가 입력창 위 띠를 이미 그리고 있거나 설문이 떠 있으면 표시하지 않고 양보
- 중단 시 `■ 중단됨`, 오류 시 `✗ 오류로 종료`로 표시
- 테스트: `claude plugin test .`

## 설치

```
/plugin marketplace add hinyc/armory
/plugin install armory@armory
```

개발 중 로컬 테스트: `claude --plugin-dir ~/Documents/GitHub/armory`
