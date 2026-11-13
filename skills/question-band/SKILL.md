---
name: question-band
description: Use when the user wants to turn the question band (입력창 위 질문 요약 띠) on or off ("질문 띠 꺼줘", "질문 띠 켜줘", "question-band"). Each run toggles it and reports the new state.
---

# 질문 띠 켜짐/꺼짐 전환

이 스킬은 armory 플러그인의 `question-band` mod가 처리합니다. mod가 로드되어 있으면 이 내용은 전환 결과로 바뀌어 전달됩니다.

이 문장이 그대로 보인다면 mod가 이 세션에 로드되지 않은 상태입니다. 다른 작업은 하지 말고 사용자에게 아래만 알려주세요.

- 질문 띠 mod가 로드되지 않아 전환하지 못했습니다.
- `/reload-plugins`를 실행하거나, 개발 중이면 `claude --plugin-dir <armory 클론 경로>`로 새 세션을 열어주세요.
