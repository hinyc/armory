# 결정 로그

> 되돌리기 어렵거나 나중에 "왜 이렇게 했지?"가 나올 결정만 적는다. 새 항목은 위에 추가한다. 지난 항목은 고치지 않고, 바뀌면 새 항목으로 뒤집는다.

## 2026-11-09 · 평가 롤(evaluator)을 기본 롤로 추가
- 결정: war-room 기본 롤을 manager + evaluator로 한다. evaluator는 일을 맡기기 전에 평가 계획(항목·변경 전 수치·원래 실패 테스트)을 세우고, 끝난 뒤 기준·히스토리·부작용·개념·수치 다섯 갈래로 판정한다. 히스토리·개념(green) 위반은 실패. 수치는 한계값 초과 실패, 한계 안 10% 넘게 나빠지면 ⚠로 알리고 사용자가 정한다. 평가 중에는 war-room/.eval/<롤 id>.json을 쓰고 입력창 위 평가 띠 mod가 이전·지금 평가를 숫자까지 보여준다
- 이유: 임시 검증 에이전트는 이번 기준만 봐서 지난 결정 위반·부작용·개념 위반·느려짐을 놓쳤음. conceptpowers와 같이 쓰면 개념 점검이 붙고 없어도 동작
- 정한 사람: 사용자 (세부는 설계 문서의 매니저 판단 표시)
- 영향: skills/war-room/** (evaluation.md, verify-loop, SKILL, template), hooks/eval-band/, types/, README.md, docs/superpowers/specs·plans

## 2026-11-09 · 롤 제안을 기존 롤 갱신까지 넓힘
- 결정: 성공한 작업이라도 같은 롤에 같은 지시·맥락·범위 밖 수정·확인이 반복되면 그 롤 문서 갱신을 제안한다. 새 롤/갱신/분리는 대상 롤 수와 크기로 고른다. 스위치는 기존 `suggestRoles`를 그대로 쓴다. "지금은 안 함"은 후보에 남기고, 명시적으로 원하지 않을 때만 거절로 기록한다
- 이유: 기존에는 실패 교훈(LESSONS)으로만 롤 문서가 개선되어, 매번 같은 지시를 반복해야 했음. 설정 키를 새로 만들면 기존 설치와 어긋남
- 정한 사람: 사용자(기능 요청), 기준은 매니저
- 영향: skills/war-room/references/role-split.md, skills/war-room/SKILL.md, template/STATUS.md, template/roles/manager.md, README.md

## 2026-11-05 · war-room이 켜진 프로젝트는 mod가 시스템 프롬프트로 "담당 롤 먼저"를 강제
- 결정: armory mod(war-room-guard)가 요청마다 작업 폴더 위쪽의 war-room/config.json을 찾아, 켜져 있으면 시스템 프롬프트 끝에 "먼저 armory:war-room으로 담당 롤을 찾는다" 절을 넣는다. 서브에이전트는 따르지 않는다. 플러그인당 hooks 모듈이 하나라 hooks/register.ts 진입점이 question-band와 함께 등록한다
- 이유: 스킬 description만으로는 모델이 롤 탐색을 건너뛰고 바로 일을 시작하는 경우가 있었음. 질문마다 덧붙이는 방식은 대화 기록이 지저분해져 제외
- 정한 사람: 사용자
- 영향: hooks/war-room-guard/, hooks/register.ts, hooks/hooks.json, skills/war-room/SKILL.md, README.md

## 2026-11-05 · 설치 때 롤 후보 개수 제한을 없애고 중복은 배제
- 결정: 롤 후보를 2~4개로 묶지 않고 프로젝트 규모에 맞춰 필요한 만큼 제안한다. 맡는 일이나 scope가 겹치는 후보는 합치고, 합칠 수 없으면 경계를 적고, 그래도 같은 경로가 남으면 근거가 약한 쪽(출처 종류 수, 같으면 횟수)을 뺀다. 기존 롤과 겹치는 후보는 뺀다
- 이유: 큰 프로젝트는 영역이 많아 4개로는 부족함. 개수 대신 중복으로 과분할을 막음
- 정한 사람: 사용자
- 영향: skills/war-room/SKILL.md 설치 3번, references/role-discovery.md, references/role-template.md

## 2026-11-03 · 커밋·릴리즈로 끝나는 일은 상태 문서를 먼저 갱신
- 결정: 매니저가 STATUS·DECISIONS·LESSONS를 롤에 맡기기 전에 갱신하고, 롤이 같은 커밋에 넣는다. 커밋 전에 모르는 내용(검증 결과)은 적지 않고, 실패하면 STATUS를 고쳐 쓴다
- 이유: 릴리즈 뒤에 문서를 고치면 "작업 폴더에 남은 변경 없음" 완료 기준과 항상 부딪힘
- 정한 사람: 사용자
- 영향: skills/war-room/SKILL.md 배정 5·7번과 롤 프롬프트 규칙, roles/manager.md, roles/release.md

## 2026-11-03 · 롤 제안은 수집 sonnet → 제안 opus 두 단계
- 결정: 이전 세션·메모리·git 이력은 sonnet 에이전트가 사실만 모으고, 롤 후보는 opus 에이전트가 만든다
- 이유: 큰 기록 훑기는 싼 모델로 충분하고, 롤 경계 설계는 판단이 많이 필요함. 메인 세션 컨텍스트에 원문을 넣지 않음
- 정한 사람: 사용자
- 영향: skills/war-room/references/role-discovery.md, SKILL.md 설치 3단계

## 2026-11-03 · 이 레포에 war-room 롤 4개로 운영
- 결정: skill-author(스킬 문서), template-dev(템플릿 코드), mod-dev(mod), release(버전·배포) 롤을 둔다
- 이유: 레포의 일이 문서·템플릿 코드·mod·배포로 뚜렷이 나뉨. 검증 명령도 영역마다 다름
- 정한 사람: 사용자
- 영향: war-room/roles/, config.json

<!-- 형식
## YYYY-MM-DD · 결정 제목
- 결정: 무엇으로 정했나
- 이유: 왜 (버린 대안 포함)
- 정한 사람: 사용자 | <롤 id> (사용자 승인)
- 영향: 관련 롤·파일
-->
