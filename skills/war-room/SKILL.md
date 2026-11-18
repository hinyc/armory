---
name: war-room
description: Use BEFORE starting any task in a project that has a war-room/ folder at its root — check whether an enabled role agent owns the work and hand it to that agent instead of doing it yourself or jumping straight to another skill. Also use when the user wants to set up or manage role-based agents ("war-room", "워룸", "에이전트 팀", "에이전트 관리", "롤 추가", "역할 추가", "담당 에이전트", "롤 끄기", "롤 분리", "롤 업데이트", "지금 상황", "결정 로그"), a session supervises others or gets a `[감독 지시]`/`[작업 보고]` message ("감독 세션"), or the plugin template was updated ("war-room 업데이트"). A manager role routes each request to the owning role, runs it as a subagent, verifies the result with a separate agent and re-assigns until it meets the required bar (or stops and reports alternatives), and keeps the state documents up to date. Roles and on/off switches live in war-room/config.json; current state, decisions and lessons live in STATUS.md, DECISIONS.md and LESSONS.md.
---

# War Room (롤 에이전트 관리)

## Overview

프로젝트 루트 `war-room/`에 롤(역할)을 정의해 둔다. 일을 받으면 매니저(메인 세션)가 담당 롤을 찾아 그 롤의 서브에이전트에게 맡기고, 다른 에이전트가 결과를 판정하게 하고, 현재 상황·결정·교훈 문서를 정리한다.

> **일을 받으면 스킬보다 담당 롤을 먼저 찾는다.** 파일 읽기·계획·다른 스킬보다 먼저 한다. 담당 롤이 있으면 그 롤이 일을 시작하고, 필요한 스킬은 그 롤이 쓴다. 답만 하면 되는 질문과, 서브에이전트로 실행 중일 때는 따르지 않는다.
>
> **이 스킬은 세션에서 한 번만 부른다.** 이미 불렀으면 다시 부르지 않고 읽은 내용대로 한다. 대화가 압축돼 이 내용이 보이지 않을 때만 다시 부른다.

```
war-room/
├─ config.json   # 전체·롤별 on/off, 템플릿 버전
├─ roles/        # manager.md(기본, 메인 세션) · evaluator.md(기본, 끌 수 있음) · <id>.md(사용자 추가)
├─ STATUS.md     # 현재 상황 (바뀐 절만 고침)
├─ DECISIONS.md  # 결정 로그 (쌓임)
├─ LESSONS.md    # 시행착오·롤 문서 개선 후보 (반영하면 비움)
├─ archive/      # 넘친 완료 목록·지난 결정·처리한 교훈
└─ .eval/        # 평가 진행 파일·스냅숏 (커밋 안 함)
```

- 작업마다 로그를 남기지 않는다. 바뀐 것은 git 이력이 맡고, 이 폴더는 지금 상태·결정·교훈만 관리한다.
- 매니저는 메인 세션이 맡는다. 나머지 롤은 Agent 도구로 띄운 서브에이전트가 맡는다. `.claude/agents/`는 쓰지 않는다.
- 가끔 쓰는 절차는 references에 있고 그때만 읽는다: 설치·롤 관리 `setup.md`, 상태 문서 세부 `state-docs.md`, 롤 제안 `role-split.md`, 템플릿 반영 `upgrade.md`, 여러 세션 `multi-session.md`·`work-session.md`.

## config.json

```json
{
  "enabled": true,
  "templateVersion": 2,
  "maxAttempts": 3,
  "suggestRoles": true,
  "roles": {
    "manager": true,
    "evaluator": true,
    "frontend": true,
    "backend": false
  }
}
```

| 값 | 뜻 |
|---|---|
| `enabled` | 전체 스위치. `false`면 배정·문서 갱신 없이 평소처럼 직접 일하고, mod의 시스템 프롬프트 지침도 빠진다 |
| `maxAttempts` | 한 일에 시도할 최대 횟수 (기본 3). 사용자가 일마다 따로 정할 수 있고, "될 때까지" 같은 뜻의 지시가 있으면 무시한다 |
| `suggestRoles` | 롤 제안(새 롤·분리·기존 롤 갱신) 스위치 (기본 `true`). `false`면 신호를 쌓지도 묻지도 않는다 |
| `roles.<id>` | 롤 스위치. `false`면 배정 후보에서 뺀다. 롤 파일은 지우지 않는다 |
| `templateVersion` | 이 프로젝트에 반영된 템플릿 버전 (없으면 1). 스킬 템플릿 값과 다르면 반영을 묻는다 (`references/upgrade.md`) |
| `skipTemplateVersion` | 사용자가 "이 버전은 묻지 않기"를 고른 템플릿 버전. 템플릿이 이보다 올라가면 다시 묻는다 |

- on/off 값이 없으면 `true`로 본다. 롤을 추가할 때 config에 `true`로 넣는다.
- `roles/`에 파일은 있는데 config에 없는 롤은 켜진 것으로 보고, config에 `true`로 추가했다고 알린다.
- config에는 있는데 파일이 없는 롤은 배정하지 않고 경고한다.
- `manager`를 `false`로 두면 `enabled: false`와 같게 처리하고 그렇다고 알린다.
- JSON 형식이 틀리면 멈추고 어디가 틀렸는지 알린다. 추측해서 고치지 않는다.

## 모드

| 모드 | 언제 | 할 일 |
|---|---|---|
| 설치 | `war-room/`이 없고 사용자가 만들자고 할 때 | `references/setup.md` |
| 롤 관리 | "롤 추가", "frontend 꺼줘", "롤 정리" | `references/setup.md` |
| 업데이트 | 템플릿 버전이 프로젝트보다 높을 때(배정 1번), "war-room 업데이트" | `references/upgrade.md` |
| 감독 | 다른 세션을 지휘하라고 맡았을 때, `[작업 보고]`를 받았을 때 | `references/multi-session.md`. 세션 안의 롤 배정은 아래 "배정" 그대로 |
| 작업 세션 | `[감독 지시]`를 받았을 때 | `references/work-session.md`만 읽고 아래 "배정"으로 |
| 배정 (기본) | `war-room/`이 있는 프로젝트에서 일을 받았을 때 | 아래 "배정" |

`war-room/`이 없는 프로젝트에서 일반 작업을 받았으면 이 스킬을 쓰지 않는다.

## 배정

일을 받을 때마다 아래 순서로 한다. 세부 규칙은 references에 있고, 이 절은 순서와 꼭 지킬 것만 적는다.

1. **설정 읽기**
   - `war-room/config.json`을 읽는다. `enabled: false`면 여기서 멈추고 평소처럼 일한다.
   - `roles/manager.md`를 읽는다. 매니저는 이 파일의 규칙을 따른다.
   - 세션에서 처음 배정할 때 한 번만 config `templateVersion`(없으면 1)을 이 스킬 `template/config.json` 값과 비교한다. 프로젝트가 낮으면 요청을 시작하기 전에 스크립트로 비교해 반영할지 묻는다 (`references/upgrade.md` 2절).
   - `[감독 지시]`로 시작하는 요청이면 `references/work-session.md`대로 받고 보고한다. 연결 워크트리에서 돌면 7번 문서 갱신을 하지 않는다.
   - `STATUS.md`를 읽어 진행 중인 일과 이어지는지 본다. 관련 있으면 `DECISIONS.md`에서 해당 결정을 찾아본다. `(검증 대기)` 항목은 확정된 결정으로 읽지 않는다.
   - `점검할 결정`에 이미 끝난 일의 항목이 남아 있으면 `references/judgment.md` 4절대로 처리한다.
2. **담당 찾기** (다른 일보다 먼저. 파일을 읽거나 계획을 세우거나 다른 스킬을 쓰기 전에 한다)
   - 켜진 롤 파일의 앞부분(`description`, `scope`)과 `하는 일`·`하지 않는 일`을 읽는다.
   - 요청을 그 범위와 맞춰 본다. 결과는 셋 중 하나다.
     - 롤 하나가 맡는다
     - 여러 롤에 걸친다 → 롤별로 나눈다
     - 맞는 롤이 없다 → 그렇다고 알린다. 하 등급 일만 매니저가 직접 한다. 파일을 3개 이상 읽어야 하는 조사는 `Explore`에, 하가 아닌 구현은 임시 작업 에이전트(`general-purpose`, 담당은 `manager`)에 맡기고 결론만 받는다 (`references/delegation.md` 5절).
   - 코드 설명·상태 조회처럼 답만 하면 되는 질문은 배정·문서 갱신 없이 바로 답한다.
3. **등급·요구 수준 정하기** (담당 찾기 다음. 등급은 담당을 바꾸지 않는다)
   - 등급 `하`·`중`·`상`은 `references/verify-loop.md` 1절 표로 정한다: 무조건 상 목록 → 검증 신호 5개 → 신호가 없으면 하. 애매하면 높은 쪽이고, 사용자가 바꿀 수 있다. 담당 롤이 있으면 하 등급이라도 그 롤에 맡긴다 (매니저 직접 처리 예외 둘도 같은 절).
   - 요구 기준: 사용자가 말한 수준을, 없으면 매니저가 초안을 만들어 알리고 진행한다. 되돌리기 어려운 결정(`references/judgment.md` 1절)을 담으면 묻는다. 기준마다 `명령 → 기대 결과`로 확인 방법을 붙이고, 사람이 볼 것만 예외로 표시한다.
   - 중·상: 맡기기 전에 매니저가 전체 테스트를 돌려 원래 실패하던 목록(기준선)을 위임 `## 기준선`에 넣는다. 상은 수치 갈래의 변경 전 값·한계값도 명령으로 잰다. 사용자가 정할 한계값은 맡기기 전에 묻는다.
   - 상: 맡기기 전에 기준 검토를 한 번 한다. 평가 롤·QA 롤 켜짐과 무관하게 `armory:evaluator`(model `haiku`)로 띄우고, 진행 파일은 쓰지 않는다. 받아들인 추가 기준의 변경 전 값은 매니저가 잰다.
   - 판정 방식: 하는 기계 검사, 중은 평가 롤과 무관하게 `haiku` 검증 에이전트의 기준별 판정, 상은 평가 롤이 켜져 있으면 시도마다 ③ 한 번(`## 볼 갈래`, `references/evaluation.md` 1절), 꺼짐·없음이면 기준별 판정.
   - 평가 롤이 꺼짐(`false`)이거나 롤 파일이 없으면 기준별 판정으로 하고, 파일 없음은 경고한다. 처음 안 배정에서 한 번 "평가 롤을 추가할 수 있어요"라고 알린다 (`references/evaluation.md` 0절).
4. **알리기**: 시작 전에 한 줄로 알린다. `→ <롤> 롤에 맡깁니다 (<요약>, 등급 <하|중|상>, 기준 n개, 최대 m회)`. 예: `→ frontend 롤에 맡깁니다 (로그인 폼 수정, 등급 중, 기준 3개, 최대 3회)`
   - 다음 줄에 되돌릴 수 있는 결정을 `정한 것: <결정>; <결정>`으로 보여준다. 답을 기다리지 않는다 (`references/judgment.md` 2절).
5. **맡기기**: Agent 도구로 롤 에이전트를 띄운다.
   - 종류: `general-purpose` (파일을 고쳐야 하는 구현 롤이라서. 평가·검증은 읽기 전용 `armory:evaluator`)
   - `model`: 롤의 `model`. 없으면 넘기지 않는다
   - `description`: `<롤 id>: <작업 요약>`
   - `prompt`: `references/delegation.md`의 고정 칸 템플릿. 칸을 빼지 않고, 넣을 것이 없으면 "없음 (확인함)"이라고 쓴다.
   - 여러 롤에 나눴을 때 (병렬은 등급 상)
     - 같은 파일을 건드리지 않으면 한 메시지에서 동시에 띄운다. 그 전에 롤 사이의 약속(형식·이름·경로)을 정해 양쪽 `## 공유 약속`에 글자 그대로 넣는다. 정할 수 없으면 순서대로 띄운다.
     - 앞 롤의 결과가 필요하거나 같은 파일을 건드리면 순서대로 띄운다.
   - 작업이 커밋·push·릴리즈로 끝나면, 맡기기 전에 7번 문서 갱신을 먼저 한다 (`references/state-docs.md` 5절).
6. **검증 → 반복** (`references/verify-loop.md`)
   - 보고를 받으면 검증 전에 `가정한 것`·`모호했던 것`을 먼저 읽는다. 기준·범위에 걸리면 `references/judgment.md` 1절로 나눠, 되돌릴 수 있으면 매니저가 정하고 기록하고, 어려우면 묻는다. 기준을 고쳤으면 고친 기준으로 평가한다.
   - 구현한 에이전트(그리고 매니저 자신)가 아닌 읽기 전용 에이전트가 판정한다. 플러그인이 있으면 `armory:evaluator`로 띄운다 (검증·QA 롤도 이 종류로 띄우고 롤 파일을 프롬프트에 넣는다). 플러그인이 없을 때만 `general-purpose`로 되돌리고 알린다. 하 등급은 기계 검사 결과로 판정하고, 돌릴 명령이 없으면 `git diff`로 바뀐 줄이 요청 범위 안이고 검증 신호가 없는지 본다.
   - 평가·검증 에이전트를 띄우기 직전에 스냅숏을 남기고 돌아오면 비교한다. 달라졌으면 그 평가는 무효다 (`references/evaluation.md` 7절). 상 등급은 문서를 미리 쓴 뒤 스냅숏 → 평가 순서다. 병렬이면 모든 구현이 돌아온 뒤 한 번에 뜬다.
   - 평가·검증 프롬프트에 `## 매니저가 정한 것` 칸을 넣고 보고의 `결정 점검`을 받는다 (`references/judgment.md` 4절).
   - 상 등급이고 evaluator 켜짐이면, 평가 에이전트가 돌아올 때마다 진행 파일(`.eval/<롤 id>.json`)의 `running`(예전 파일이면 `planning`도)을 `aborted`로 고치고, 일이 끝나면 지운다.
   - 평가 보고의 `등급 올림`이나 하 일을 끝낸 뒤 `git diff`에 검증 신호·무조건 상 조건이 있으면 그 등급으로 다시 검증한다 (사용자가 정한 등급이면 알리고 묻는다).
   - 담당 범위 밖 파일을 고쳤으면 이유를 확인한다.
   - 실패하면 판정 근거만 넘겨(`references/delegation.md` 3절) 원인에 맞게 다음 시도를 맡긴다(같은 롤의 새 에이전트, 다른 접근, 다른 롤). 같은 일이 2번 실패하면 3번째 전에 기준·설계를 다시 본다.
   - 멈출 때: 시도 상한, 두 번 연속 나아지지 않음, 시도로 풀 수 없는 한계, 너무 오래 걸림(사용자에게 묻는다). 멈추면 **최고 결과로도 수준에 못 미친다고 분명히 말하고, 대안을 2개 이상 낸다.**
   - 사용자가 "될 때까지", "무조건 완성해"처럼 횟수·시간과 상관없이 결과를 내라는 뜻으로 말하면 (문구가 아니라 뜻으로 판단) 상한·멈춤 조건을 무시하고 접근을 바꿔 가며 반복한다 (끝까지 모드, `references/verify-loop.md` 4절).
   - 주관 기준과 평가의 ⚠ 항목은 통과 뒤 사용자에게 확인받는다.
7. **문서 갱신** (매니저만 쓴다. 세부·크기 정리는 `references/state-docs.md`)
   - `STATUS.md`는 **바뀐 절만** Edit로 고친다. 통째로 다시 쓰지 않는다. 진행 중 항목에는 `롤 · 작업 · 등급 · 시도 n/최대 · 남은 실패 기준 · 기준이 적힌 곳`을 적는다.
   - 결정이 있었으면 `DECISIONS.md`에 추가한다. 중·상 일에서 매니저가 정한 결정은 STATUS `## 점검할 결정`에 적는다 (`references/judgment.md` 3절).
   - 여러 번 시도했거나 못 미쳐 멈춘 일, 롤이 막혔던 일, 다음에 알아야 할 것은 `LESSONS.md`에 추가한다.
   - **이어받기 점검**: 새 세션이 STATUS.md(`점검할 결정` 포함)와 DECISIONS.md만 읽고 지금 상태와 다음 할 일, 점검할 결정을 말할 수 있는지 본다.
   - **순서**: 커밋·push·릴리즈로 끝나는 일은 5번 전에, 등급 상은 평가를 띄우기 전에 미리 쓴다 (`references/state-docs.md` 5절).
   - **롤 제안**: 반복 신호(자주, 길게, 참고할 것이 많음, 롤이 너무 큼 / 같은 지시·맥락·범위 밖·확인 반복)를 STATUS `## 롤 후보`에 `[새 롤]`·`[분리 · 롤]`·`[갱신 · 롤]`로 쌓는다. 기준을 넘으면 8번 보고 **뒤에** 한 번 묻는다. 승인 없이 롤 파일을 만들거나 고치지 않는다. 신호 기준·묻는 형식·거절 처리는 `references/role-split.md`. `suggestRoles: false`면 하지 않는다.
8. **보고**: 사용자에게 결과를 알린다. 누가 했는지, 몇 번 만에 통과했는지, 무엇이 바뀌었는지, 남은 일을 적는다.
   - `매니저가 정한 것`을 적는다 (하 등급은 여기에만 적는다). 결정 점검 결과는 "결정 n개 점검 통과"로 적고, 재검토 항목은 근거와 함께 보여주고 유지·뒤집기를 묻는다.

맞는 롤이 없어 직접 처리했거나 임시 작업 에이전트에 맡겼을 때도 6·7번을 한다. 담당은 `manager`로 적는다. 등급표는 롤 있는 일과 같고, 하가 아니면 평가 에이전트가 판정한다 (매니저 자기 검토 금지). 하 등급을 직접 한 일은 STATUS 최근 완료에 등급과 바뀐 파일 수를 적는다.

### 롤 에이전트에게 주는 프롬프트

서브에이전트는 이 대화를 모른다. 필요한 것을 모두 넣는다. 고정 칸과 보고 형식은 `references/delegation.md`에 있다. 칸을 빼지 않는다.

## 상태 문서

| 파일 | 무엇 | 갱신 |
|---|---|---|
| `STATUS.md` | 진행 중 · 다음 할 일(10개까지) · 막힌 것 · 점검할 결정 · 롤 후보 · 최근 완료 | 바뀐 절만 고친다. 10KB를 넘으면 오래된 완료부터 archive로 |
| `DECISIONS.md` | 되돌리기 어렵거나 나중에 이유가 궁금할 결정 (작업 결과는 적지 않는다) | 위에 추가. 지난 항목은 고치지 않고 뒤집는 항목을 새로 쓴다 |
| `LESSONS.md` | 같은 실수를 막는 데 필요한 것 | 승인받아 롤 문서에 반영하면 archive로 |

- 쓰는 주체는 매니저다. 서브에이전트는 보고의 `정한 것`·`겪은 문제`·`가정한 것`으로 제안만 한다 (예외: 커밋하는 롤은 매니저가 미리 고친 문서를 커밋에 넣기만 하고, 평가 에이전트는 자기 진행 파일만 쓴다).
- 비밀값·토큰·개인정보는 적지 않는다. `archive/`는 읽기만 한다.
- "지금 뭐 하고 있어", "다음 뭐 해" 같은 질문은 STATUS.md로 답한다.

## 하지 않는 것

- `war-room/`이 없는 프로젝트에서 사용자가 묻지 않았는데 설치를 권하기
- 롤 에이전트를 거치지 않고 담당 롤이 있는 일을 매니저가 직접 하기 (예외: 사용자가 직접 하라고 했을 때, `verify-loop.md` 1절 "매니저 직접 처리"의 예외. STATUS는 갱신한다)
- 롤 파일·config를 사용자 확인 없이 크게 바꾸기 (켜고 끄기는 예외. 롤 문서에 교훈을 넣는 것은 승인을 받는다)
- 서브에이전트에게 `war-room/` 문서를 쓰게 하기 (진행 파일 제외)
- 하 등급 일을 끝내고 `git diff` 사후 점검(검증 신호·무조건 상 조건)을 건너뛰기
- 템플릿 반영을 묻지 않고 프로젝트 `war-room/` 파일을 고치기, `# 프로젝트별 규칙` 절과 사용자가 만든 롤을 템플릿으로 덮기
- 감독 세션이 사용자 대신 되돌리기 어려운 결정을 승인하기 (`references/multi-session.md` 7절)
