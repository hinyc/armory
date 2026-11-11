# 현재 상황

> 매니저가 작업이 끝날 때마다 통째로 다시 쓴다. 지난 내용은 남기지 않는다.

갱신: 2026-11-11 14:01

## 진행 중

- 없음

## 다음 할 일

- 매니저 판단 규칙 배포 여부 결정 (커밋 완료, 버전 0.6.0 올림·push·릴리즈는 사용자 승인 대기). 배포 뒤 다른 프로젝트에서 시험: 기준 초안을 묻지 않고 `정한 것:`으로 알리는지, 중·상 일에서 STATUS `점검할 결정`이 쌓이고 평가 ③의 `결정 점검`으로 지워지는지
- ccs-front에서 v0.5.0 검증: 플러그인 올린 뒤 하·중·상 일을 하나씩 시켜 등급 판정·에이전트 수·"평가 롤 추가" 제안 1회를 확인 (설계 문서 "릴리즈 뒤 검증" 절). 결과는 이 STATUS 최근 완료에 한 줄

## 막힌 것

- 없음

## 점검할 결정 (중·상 일에서 매니저가 정한 결정. 형식: 날짜 · 작업 · 결정 · 이유 · 되돌리는 법. 점검이 끝나면 지우고, 다시 쓸 때도 이어서 남긴다. 10KB를 넘겨도 옮기거나 자르지 않는다)

- 없음

## 롤 후보 (롤 분리 신호, 다시 쓸 때도 이어서 남김)

- 없음

## 최근 완료 (STATUS.md 전체 10KB 이하, 넘치면 오래된 것부터 archive/로)

- 2026-11-11 · skill-author · commit 스킬에 모델 선택 추가 (기본 haiku, 파일 6개↑·300줄↑·영역 3곳↑이면 sonnet, 초안만 서브에이전트, 커밋은 스킬 실행 세션), 등급 중, 시도 1번 통과 + 평가 권장 다듬기 2번 (한글 경로·HEAD 없는 저장소·커밋 주체 문구)
- 2026-11-11 · skill-author·template-dev·manager · 매니저 판단 규칙 (되돌릴 수 있는 결정은 스스로 정해 `정한 것:`으로 알림, 어려운 결정 8가지만 묻기, 중·상 결정은 STATUS 점검할 결정 → 평가 ③ 결정 점검), references/judgment.md 새로, 이 레포 manager.md에도 반영, 등급 상, 시도 1번 (기준 검토 11개 반영, 결정 점검 5건 유지)
- 2026-11-10 · release · v0.5.0 릴리즈 (위임·검증 보강, 등급, 읽기 전용 평가 에이전트, STATUS 10KB 기준)
- 2026-11-10 · skill-author · 경미 2건: evaluation.md ③ 틀 기준선 서술 하나로, role-split.md "명시적으로 원하지 않는다고 한 후보"로 다듬음, 등급 하, 시도 1번 (매니저 grep·validate 판정)
- 2026-11-10 · manager · 교훈 2개(skill-author 명령 예 전제, manager diff 기준 전 git status) 롤 문서에 반영, LESSONS 비움, 등급 하 (파일 4개)
- 2026-11-10 · manager · 설계 문서에 범위 밖(팀 공동 사용, 플러그인 없는 설치) 명시와 ccs-front 릴리즈 뒤 검증 절 추가, 등급 하 (파일 1개)
- 2026-11-10 · skill-author·template-dev · STATUS 최근 완료 보관 기준을 10개에서 10KB(10,240바이트)로 바꿈, archive로 옮겼던 11월 기록 18개를 STATUS로 되돌림, 등급 상, 시도 1번 (기준 검토 9개 반영)
- 2026-11-09 · skill-author·mod-dev · war-room 위임·검증 보강 (등급 하·중·상, 읽기 전용 armory:evaluator, 스냅숏 비교, 기준 검토, 위임 고정 칸, 2번 실패 다시 보기, 공유 기억 매니저 전용, 병렬 공유 약속), 등급 상 첫 적용, 시도 3번 (1: 통과+권고 5, 2: .eval 폴더 만들기 누락)
- 2026-11-09 · release · v0.4.0 릴리즈 (평가 롤·평가 진행 띠 mod)
- 2026-11-09 · manager · 교훈 2개(skill-author 판단 순서 적용 범위, mod-dev 훅 하나·등록 순서) 롤 문서에 반영
- 2026-11-09 · manager · 이 레포 war-room에 evaluator 롤 추가 (프로젝트별 평가 규칙), .gitignore에 war-room/.eval/
- 2026-11-09 · mod-dev · 평가 진행 띠 mod (hooks/eval-band, 질문 띠와 함께 위에 표시, 테스트 14개 추가), 시도 1번 + 보강 (types 외부 import, 아직 기호 ○)
- 2026-11-09 · skill-author · 평가 롤 문서·템플릿 (evaluation.md, evaluator 템플릿, verify-loop·SKILL 연결), 시도 2번 (2차: 기존 설치 제안 시점·롤 파일 없음 처리)
- 2026-11-09 · release · v0.3.2 릴리즈 (롤 제안을 기존 롤 갱신까지 확장)
- 2026-11-09 · skill-author · 롤 제안을 기존 롤 갱신까지 확장 (반복 지시·맥락·범위 밖 수정·확인 신호, 새 롤/갱신/분리 판단 순서), 시도 3번 (1·2차: 신호 적용 범위·"지금은 안 함" 처리 모호)
- 2026-11-09 · release · v0.3.1 릴리즈 (중복 롤 후보 동률 처리, 교훈 3개 롤 문서 반영)
- 2026-11-09 · skill-author · 중복 롤 후보 비교가 동률일 때 처리 추가 (제안 에이전트는 표시, 매니저는 사용자가 고름)
- 2026-11-09 · manager · 교훈 3개(skill-author 비교 기준, mod-dev 진입점 등록, manager 에이전트 종류 확인) 롤 문서에 반영
- 2026-11-05 · release · v0.3.0 릴리즈 (war-room-guard mod, 롤 후보 개수 제한 해제·중복 배제)
- 2026-11-05 · skill-author · SKILL.md·README에 war-room-guard mod 동작·끄는 법 반영, 시도 2번 (1차: 상위 폴더 탐색·manager false·JSON 오류 동작 누락)
- 2026-11-05 · mod-dev · war-room-guard mod 추가 (켜진 war-room이면 시스템 프롬프트에 '담당 롤 먼저' 지침), 테스트 7개, 시도 2번 (1차: 지침 예외가 조사·설계 에이전트를 빠뜨림)
- 2026-11-05 · skill-author · 설치 때 롤 후보 개수 제한(2~4개) 해제, 중복 후보 합치기·배제 규칙 추가, 시도 2번 (1차: 겹침 판단·근거 비교 기준이 모호)
- 2026-11-05 · release · v0.2.2 릴리즈 (질문 띠 미표시 수정, skill-author·mod-dev 교훈 반영)
- 2026-11-05 · manager · mod-dev 교훈(실제 엔진 값으로 테스트, 디버그 로그로 먼저 확인) roles/mod-dev.md에 반영
- 2026-11-05 · mod-dev · 질문 띠가 안 뜨던 버그 수정 (엔진 기본 그림 {type:'engine'}을 다른 mod 그림으로 보고 양보), 테스트 추가, 검증 1회 통과·실제 세션에서 표시 확인
- 2026-11-05 · manager · skill-author 교훈(예외는 같은 항목에 묶고 판단 근거 적기) roles/skill-author.md에 반영
- 2026-11-03 · release · v0.2.1 릴리즈 (커밋 전 문서 갱신 규칙, manager 교훈 반영)
- 2026-11-03 · skill-author · 커밋·릴리즈로 끝나는 일은 맡기기 전에 문서 갱신하도록 배정 절차 변경, 시도 2번 (1차: 커밋 금지 규칙과 예외가 따로 있어 모호)
- 2026-11-03 · manager · war-room 설치, 롤 4개(skill-author, template-dev, mod-dev, release) 추가
- 2026-11-03 · release · v0.1.1 커밋 2개·push·릴리즈 (https://github.com/hinyc/armory/releases/tag/v0.1.1), war-room/ 공개, 검증 1회 통과
- 2026-11-03 · release · 매니페스트 버전 0.1.0 → 0.1.1 (설치 캐시 갱신용), 검증 1회 통과
- 2026-11-03 · skill-author · war-room 설치 시 이전 세션·기록 참고해 롤 제안 (수집 sonnet → 제안 opus, references/role-discovery.md), 검증 통과 후 지적 2개 보완·재검증 통과
- 2026-11-03 · release · v0.2.0 커밋 3개·push·릴리즈 (https://github.com/hinyc/armory/releases/tag/v0.2.0), 검증 1회 (매니저 기준 오류 1건 정정 후 통과)
- 2026-11-03 · manager · release 롤 교훈(계정 복구는 맨 마지막) roles/release.md에 반영
- 2026-11-03 · manager · manager.md에 "기준은 실제 diff 확인 후 결과 상태로" 반영, release.md·manager.md에 커밋 전 문서 갱신 규칙
