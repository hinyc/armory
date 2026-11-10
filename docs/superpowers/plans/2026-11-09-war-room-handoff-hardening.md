# war-room 위임·검증 보강 Implementation Plan

> **For agentic workers:** 이 레포는 war-room으로 일한다. 이 작업은 등급 "상"이다 (스킬 절차·지침 수정, 병렬). 매니저가 기준 검토 → 기준선 → 병렬 위임(공유 약속) → sonnet 평가(스냅숏 비교) → 사람 승인 → 릴리즈 순으로 진행한다.

**Goal:** war-room에 위험도 등급, 읽기 전용 평가 에이전트, 기준 검토, 위임 고정 칸, 재시도 규칙, 매니저 경량화, 공유 기억 규칙, 병렬 공유 약속을 넣는다.

**Spec:** `docs/superpowers/specs/2026-11-09-war-room-handoff-hardening-design.md`

## Global Constraints

- SKILL.md ≤250줄. 롤 프롬프트 템플릿은 `references/delegation.md`로 옮긴다.
- 공개 레포: 회사·다른 프로젝트 용어, 개인 계정·이메일 금지.
- config 키 추가 없음. DECISIONS 형식 유지(`날짜 · 제목`).
- 플러그인 에이전트: `agents/evaluator.md` → `armory:evaluator`, 도구 Read·Grep·Glob·Bash·Skill.

## 공유 약속 (skill-author·mod-dev 양쪽 프롬프트에 글자 그대로)

- 지침 문장(guardText 둘째 문단): `사용자 요청을 받으면 파일 읽기·계획·다른 스킬보다 먼저 armory:war-room 스킬을 불러 담당 롤을 찾고, 시작 전에 배정 한 줄(예: \`→ frontend 롤에 맡깁니다 (로그인 폼 수정, 등급 중)\`)을 알린다. 맞는 롤이 없으면 그렇다고 알리고, 하 등급 일만 매니저가 직접 하고 그 밖은 조사·작업 에이전트에 맡긴다.`
- SKILL.md는 같은 뜻을 `하 등급 일만 매니저가 직접 한다`라는 구절로 쓴다.
- 등급 이름: `하` `중` `상`. 알리기 줄 형식: `→ <롤> 롤에 맡깁니다 (<요약>, 등급 <하|중|상>, 기준 n개, 최대 m회)`.

## 요구 기준 (확인 방법 → 기대 결과)

1. `wc -l skills/war-room/SKILL.md` → 250 이하
2. `claude plugin validate .` → "Validation passed"; `claude plugin test .` → 0 fail, pass 36 이상
3. `sed -n '1,15p' agents/evaluator.md` → frontmatter에 `tools`가 Read, Grep, Glob, Bash, Skill이고 Edit·Write·NotebookEdit·Agent 없음
4. `grep -c` 로 `skills/war-room/references/delegation.md`에 `## 목표` `## 범위` `## 범위 밖` `## 관련 파일` `## 요구 기준` `## 알려진 예외` `## 관련 결정` `## 기준선` `## 공유 약속` `## 지난 시도` `가정한 것` `모호했던 것` 각각 1 이상
5. `grep -rn "porcelain --ignored" skills/war-room/references/evaluation.md` → 1줄 이상, 스냅숏 저장·비교·무효 처리 절차가 같은 절에 있음
6. 등급표: verify-loop.md(또는 SKILL.md)에 무조건 "상" 조건 목록, "하" 조건 4개, 평가 에이전트의 `등급 올림` 칸 — 읽기
7. `grep -rn "검증 대기" skills/war-room/SKILL.md` → 1줄 이상 (붙이고 떼는 규칙)
8. 재시도: `## 지난 시도`에 평가 실패 내용만, 2번 실패 뒤 기준·설계 다시 보기 — 읽기
9. `grep -rn "war-room/ 문서는 고치지 않는다" skills/war-room/references/delegation.md` → 1줄 이상; LESSONS 주기 `5개`·`14일` SKILL.md에 있음
10. `grep -rn "하 등급 일만 매니저가 직접" hooks/war-room-guard/find.ts skills/war-room/SKILL.md` → 두 파일 모두; 테스트가 이 구절을 단언
11. `grep -rn "매니저가 직접 명령을 돌려 검증해도" skills/war-room` → 없음 (옛 예외 제거); `grep -rn "맞는 롤이 없으면 그렇다고 알리고 매니저가 직접 한다" hooks skills` → 없음
12. 변경 범위·부산물·금지어 — 매니저의 레포 밖 검사 스크립트 (금지어 목록은 공개 레포에 두지 않는다)

기계 검사 묶음: 매니저가 레포 밖에 둔 검사 스크립트가 위 기준과 기준 검토에서 더한 항목(등급 조건, 스냅숏 절, 옛 문구 제거, 두 축, role-split 신호, template STATUS 형식 등)을 PASS/FAIL로 센다. 평가 에이전트는 스크립트 경로를 받아 실행한다.

## Tasks

### Task 1 (skill-author): 문서·에이전트 정의
- Create: `skills/war-room/references/delegation.md`, `agents/evaluator.md`
- Modify: `skills/war-room/SKILL.md`, `references/verify-loop.md`, `references/evaluation.md`, `template/roles/manager.md`, `template/roles/evaluator.md`, `README.md`
- 기준 1·3~9·10(SKILL 쪽)·11·12

### Task 2 (mod-dev): 지침 문구
- Modify: `hooks/war-room-guard/find.ts`, `hooks/war-room-guard/war-room-guard.test.ts`
- 기준 2·10(find.ts·테스트 쪽)·11(hooks)

### Task 3 (manager): 이 레포 war-room 반영
- `war-room/roles/manager.md`·`evaluator.md` 요약 반영, DECISIONS `(검증 대기)` 미리 쓰기, STATUS

### Task 4 (release, 사람 승인 뒤): v0.5.0
