# armory

개인 업무용 [Claude Code](https://docs.claude.com/en/docs/claude-code) 플러그인. 커밋·이슈 작성, 진행 관리, 화면설계서 생성, 롤 기반 에이전트 운영을 스킬로 묶었다.

```
/plugin marketplace add hinyc/armory
/plugin install armory@armory
```

## Contents

| 이름 | 종류 | 한 줄 요약 | 트리거 예 |
|---|---|---|---|
| [`commit`](#commit) | skill | 여러 변경을 담은 커밋 메시지를 제목 + 3~5줄로 정리 | "커밋해" |
| [`issue-writer`](#issue-writer) | skill | GitHub 이슈·Jira 티켓을 표준 양식으로 작성·수정·정리 | "이슈 만들어줘", "#12 정리" |
| [`status-dashboard`](#status-dashboard) | skill | AI가 JSON을 관리하고 사람은 HTML로 보는 진행 대시보드 | "진행상황 대시보드" |
| [`screen-spec`](#screen-spec) | skill | 실제 화면 캡처 + 목 API + 코드 기반 설명으로 화면설계서 생성·갱신 | "화면설계서 만들어줘" |
| [`war-room`](#war-room) | skill + mod | 롤 에이전트에 일을 배정하고 요구 수준까지 검증·반복 | "롤 추가", `war-room/`이 있는 프로젝트의 모든 작업 |
| [`war-room-commander`](#war-room-commander) | skill | war-room에 매니저 윗급 감독 자리를 지정·이어받기·해제하고 지휘 보드로 재시작 뒤에도 이어감 | "감독 지정", "지금 감독 있어?", "감독 해제" |
| [`question-band`](#question-band) | mod + skill | 입력창 위에 현재 질문 요약과 경과 시간 표시 | `/question-band` (전환) |

스킬은 설명(description)에 맞는 요청이 오면 자동으로 쓰인다. 직접 부르려면 `/armory:<이름>`.

---

## commit

변경이 여러 개인 커밋을 `<type>: <한글 제목>` + bullet 3~5줄로 쓴다. 타입은 `feat` `fix` `refactor` `perf` `docs` `test` `chore`.

커밋하는 세션이 스테이징된 내용(`git diff --cached`)을 확인하고 메시지를 직접 쓴다. 모델을 고르거나 초안 에이전트를 띄우지 않는다.

```
feat: 사용자 역할 요청 기능 추가

- 역할 요청 API 엔드포인트 구현
- 요청 현황 조회 화면 추가
```

## issue-writer

이슈 본문을 개발자가 바로 착수할 수 있는 양식으로 맞춘다: 한눈에 보는 할 일, 이유, 완료 기준, 바로 시작 가능 여부. 요구사항을 지어내지 않고, 원래 근거는 지우지 않는다. 새로 쓰기·수정·정리를 모두 지원한다.

## status-dashboard

데이터와 표현을 분리한 추적 문서.

```
<folder>/
├─ index.html      # 뷰어. 한 번 만들고 거의 안 고침
├─ data.json       # AI가 매번 고치는 데이터 (또는 manifest.json + 여러 JSON)
└─ flows/*.md      # 선택: Markdown + Mermaid 흐름도
```

사람은 HTML만 보고, AI는 JSON만 고친다. 둘은 JSON 스키마로만 연결된다.

## screen-spec

Playwright로 실제 앱을 띄워 상태별 화면을 찍고, 코드를 읽어 쓴 설명과 함께 HTML 화면설계서를 만든다. 대상: Playwright로 띄울 수 있는 웹 SPA.

- 목 API 레지스트리(`"METHOD /path"`)로 상태를 고정한다. 등록 안 된 호출·콘솔 에러는 테스트 실패로 처리한다.
- 에러·로딩·빈 상태·다이얼로그·네이티브 alert 재현 레시피를 제공한다. 시간은 `page.clock`으로 고정한다.
- 스샷 위에 박스·번호·화살표를 그린 이미지를 만든다(HTML 오버레이 → PNG).
- 요구사항 ↔ 화면 매핑은 선택이다. AI 초안은 `draft`로 표시하고 근거를 함께 적는다.

**요구사항**: `@playwright/test` ≥ 1.45, `zod` 3 또는 4 (devDependency, 프로젝트별 설치)

스킬이 `template/`을 대상 프로젝트 `e2e/screen-spec/`에 복사하고 아래 스크립트를 추가한다.

| 스크립트 | 하는 일 |
|---|---|
| `screen-spec` | 전체 캡처 + 문서 생성 |
| `screen-spec:only <file>` | 일부 시나리오만 다시 캡처 |
| `screen-spec:html` | 캡처 없이 문서만 다시 생성 (수 초) |
| `screen-spec:affected [commit]` | 마지막 생성 이후 바뀐 파일로 영향받은 캡처 목록 |
| `screen-spec:sheet` | 검토용 모아 보기 이미지 생성 |

모드는 셋이다. 구축은 시나리오·목데이터·설명을 작성한다. 실행은 스크립트만 돌린다. 업데이트는 `affected` 결과로 바뀐 부분만 고친다.

## war-room

프로젝트 루트 `war-room/`에 롤을 정의해 두면, 메인 세션이 매니저가 되어 일을 담당 롤의 서브에이전트에게 맡긴다.

```
war-room/
├─ config.json       # 전체·롤별 on/off, 시도 상한(기본 1), 롤 제안 on/off, 선택: managerDelegateAt·managerCompactAt
├─ roles/
│  ├─ manager.md     # 기본 롤 (배정·검토·문서 정리)
│  ├─ evaluator.md   # 기본 롤 (평가 실행은 상 등급, 끄기·삭제 가능)
│  └─ <id>.md        # 프로젝트에 맞게 추가 (description, scope, model, skills, refs)
├─ STATUS.md         # 현재 상황 (바뀐 절만 고침)
├─ DECISIONS.md      # 결정 로그 (쌓임)
├─ LESSONS.md        # 시행착오·롤 문서 개선 후보 (반영하면 비움)
├─ PLACES.md         # 장소 목록: 자주 쓰는 경로·깃 저장소·이슈·지라 키·문서 URL·명령 (사용자가 확인한 것만, 비밀 금지)
├─ archive/
└─ .eval/            # 평가 진행 파일·스냅숏·오래 걸리는 명령 기록 (중·상, 커밋 안 함)
```

```json
{ "enabled": true, "maxAttempts": 1, "suggestRoles": true, "roles": { "manager": true, "evaluator": true } }
```

선택 키 `managerDelegateAt`·`managerCompactAt`은 없으면 기본값을 쓴다. 예: `"managerCompactAt": 300000`.

```
요청 → 담당 롤 찾기 → 요구 기준·기준선 정하기 → (상) 기준 검토 → 롤 에이전트 실행 → 판정 (상: 평가 롤, 중: 검증 에이전트)
                                                        ↑                      │ 실패
                                                        └── 원인별 재배정 ──────┘
```

- `war-room-guard` mod가 `war-room/`이 켜진 프로젝트의 시스템 프롬프트에 "먼저 담당 롤을 찾는다" 지침을 넣는다. config의 `enabled: false`면 빠진다. 같은 지침에 배정 줄의 `에이전트 n개 예정`, 끝난 에이전트 SendMessage 재개 금지, 요청에 없던 새 기능 금지, 스크린샷·긴 출력은 롤에 맡기기, 중·상 일 뒤 `/clear` 권하기가 들어 있다. 매니저 컨텍스트가 `managerDelegateAt`(기본 100000 토큰) 이상이면 조사·검증을 에이전트에 맡기라는 지침이 더해지고, `managerCompactAt`(기본 150000) 이상이면 턴이 끝난 뒤 자동으로 압축한다 (`0`이면 그 단계 끔, `references/delegation.md` 6절).
- `managerDelegateAt`·`managerCompactAt`은 모델의 컨텍스트 한도(예: 100만 토큰) 자체를 제한하지 않고, 매니저(메인 세션)의 위임 지침·자동 압축 시점만 정한다. 서브에이전트에는 걸리지 않고, 한 턴 안에서 커지는 것은 막지 못한다. 매니저가 긴 대화를 통째로 기억해야 하는 프로젝트는 그 프로젝트 `war-room/config.json`의 `managerCompactAt`을 올리고(예: `300000`), 압축을 끄려면 `0`으로 둔다. 매니저가 앞 내용을 잃어 같은 것을 다시 묻거나 일이 어긋난다고 판단하면 컨텍스트가 부족하다고 말하고 `managerCompactAt` 상향을 제안한다. config는 사용자 승인 전에는 고치지 않는다 (제안만).
- 판정은 구현한 에이전트가 아닌 별도 에이전트가 한다. 기본 `evaluator` 롤이 (상 등급만) 기준·히스토리(바뀐 경로·검색어로 DECISIONS·LESSONS를 grep해 걸린 항목과 바뀐 파일별 최근 git log만. 전체는 읽지 않는다)·부작용(전체 테스트)·개념(conceptpowers)·수치(3번 잰 중앙값, 한계값 초과 실패, 10% 넘게 나빠지면 알림) 다섯 갈래 중 필요한 갈래로 평가한다 (기준·히스토리·부작용은 항상, 개념·수치는 해당할 때. 시도마다 한 번, 모델 기본 `sonnet`). 기준선·변경 전 수치는 매니저가 맡기기 전에 잰다. 중 등급은 평가 롤이 켜져 있어도 다섯 갈래 없이 `haiku` 에이전트가 기준별 판정만 한다 (수치 확인은 기준 하나). 위반은 실패로 보고 다시 맡긴다.
- 일마다 위험도 등급(하·중·상)을 정해 검증 비용을 나눈다. 하(검증 신호가 없는 일. 문구만 바꾸는 일은 파일 수와 상관없이 하이다. 매니저가 직접 하는 예외는 `SKILL.md`의 하 등급 절)는 기계 검사만, 중은 기준이 전부 `명령 → 기대 결과`로 판단 없이 비교되면 매니저가 명령을 돌려 판정하고 읽고 판단하는 기준이 하나라도 있으면 `haiku` 검증 에이전트의 기준별 판정, 상(릴리즈·push, 등급·검증 흐름 변경, 병렬, 검증 신호가 있는 변경 5개 이상, 파일 삭제·보안 등)은 기준 검토(맡기기 전에 새 검증 에이전트 한 번, 평가 롤·QA 롤 켜짐과 무관하게 `haiku`)와 사람 승인까지 한다. 변경이 이미 검증·커밋된 버전 올림·릴리즈만의 정형 릴리즈는 기준 검토·평가 없이 매니저가 명령으로 확인한다 (`references/verify-high.md` 7절). 롤 없는 일도 하 등급만 매니저가 직접 하고, 나머지는 조사·작업 에이전트에 맡긴다. 매니저가 읽는 문서는 등급별로 나뉜다: 하는 `SKILL.md`, 중은 `delegation.md`·`verify.md`, 상은 `verify-high.md`까지, 실패 뒤에는 `retry.md`, 평가 롤 꺼짐·QA 롤·병렬은 `eval-edge.md`.
- 매니저는 되돌릴 수 있는 결정(기준 초안, 접근 고르기 등)은 묻지 않고 정해 `정한 것:`으로 알리고 진행한다. 되돌리기 어려운 결정(커밋·push, 삭제, 공개 인터페이스 변경, 요청 뜻이 갈리는 것 등)만 사용자에게 묻는다. 정한 결정은 STATUS `점검할 결정`에 남기고 평가·검증 에이전트가 점검한다 (등급과 별개).
- 위임 프롬프트는 고정 칸(목표·범위·범위 밖·관련 파일·요구 기준·알려진 예외·관련 결정·기준선·공유 약속·지난 시도)으로 쓰고, 보고에는 `가정한 것`·`모호했던 것`이 들어간다. 같은 일이 2번 실패하면 기준·설계를 다시 본다.
- "그 파일 옮겨", "그 깃 이슈 가져와", "지라 업데이트해"처럼 위치가 빠진 요청은 매니저가 `war-room/PLACES.md`를 요청 표현으로 grep해 실제 경로·키를 위임 프롬프트에 넣는다. 못 찾거나 여러 개면 사용자에게 묻고, 사용자가 확인한 위치만 매니저가 한 줄(`이름(부르는 말) · 종류 · 위치 · 쓰는 때 · 확인한 날`)로 적는다 (같은 부르는 말이면 그 줄을 고친다). 롤 에이전트는 필요하면 읽기만 한다. 감독 세션에서는 같은 파일을 po가 찾고 pm이 쓴다. 예전 판의 감독 전용 `war-room/commander/PLACES.md`는 "war-room 업데이트"나 감독 지정·이어받기 때 `war-room/PLACES.md`로 합쳐진다.
- 판정은 플러그인의 읽기 전용 `armory:evaluator` 에이전트(`agents/evaluator.md`, Read·Grep·Glob·Bash·Skill만)가 한다. Bash로 파일을 쓸 수 있어 평가 전후 `git status`·`git diff` 스냅숏을 비교하고, 다르면 그 평가는 무효다. 저장소 밖 변경은 못 잡는다.
- 문서는 검증 통과 뒤에 쓴다. 구현(커밋 없음) → 검증·평가 → 스냅숏 비교 → 통과 → 매니저가 STATUS·DECISIONS·LESSONS 갱신 → 이어받기 점검(매니저) → 커밋(요청 시, 구현과 문서를 한 커밋으로) 순서이고, 구현 롤은 커밋하지 않는다. 릴리즈는 승인 대기까지만 적고, 승인 뒤 릴리즈 담당 롤이 문서 변경도 릴리즈 커밋에 넣는다.
- 오래 걸리는 명령(프로젝트 규칙이 지정했거나 기준선 측정에서 2분 이상 걸린 명령)은 구현이 돌아오면 매니저가 한 번 돌려 기록하고, 검증·평가 에이전트는 작업 상태 해시가 같으면 다시 돌리지 않는다. 정형이 아닌 릴리즈·보안·삭제가 든 일은 항상 직접 돌린다 (`references/verify.md` 3절).
- 평가 진행은 상 등급 평가 실행(③)이 `war-room/.eval/<롤 id>.json`에 쓴다 (기준 검토는 쓰지 않는다). 평가 띠(mod)가 이전·지금 평가 상태를 입력창 위에 보여주고 평가가 끝나면 사라진다. `evaluator`를 끄거나 없는 기존 설치는 평가 롤 없이 검증 에이전트로 판정한다.
- 시도 상한(기본 1이라 실패하면 자동 재시도 없이 보고하고 사용자가 재시도를 고른다)에 닿았거나, 나아지지 않거나, 한계에 부딪히면 멈춘다. 멈출 때는 최고 결과와 함께 대안을 2개 이상 보고한다.
- 사용자가 "될 때까지"처럼 지시하면 상한을 무시하고 접근을 바꿔 가며 계속 반복한다.
- 자주·길게·참고할 것이 많은 일은 새 롤·분리를, 롤에 같은 지시·맥락이 반복되면 그 롤 문서 갱신을 제안한다. 이 제안은 `suggestRoles: false`로 끈다.
- 작업 로그는 따로 남기지 않는다. 변경 이력은 git에 맡긴다.
- 토큰을 아끼려고 스킬은 세션에서 한 번만 부르고(가드 지침도 같다), 매번 필요한 배정 절차만 SKILL.md에 두고 설치·롤 관리·상태 문서 세부는 references에서 필요할 때만 읽는다. STATUS.md는 바뀐 절만 고치고, 기본 manager 롤 문서에는 스킬 규칙을 옮겨 적지 않고 프로젝트별 규칙만 둔다.
- 여러 세션을 나눠 쓸 때는 한 세션이 감독을 맡는다. 지시(`[감독 지시]`)·보고(`[작업 보고]`)는 고정 칸으로 주고받고, 작업 세션은 자기 war-room 롤로 일하고 판정한다. 감독은 공유 약속 일치·통합 검증·보안 같은 교차 관심사만 판정을 맡기고, 되돌리기 어려운 결정은 사용자만 승인한다. 연결 워크트리 작업 세션은 `war-room/` 문서를 쓰지 않는다. 감독은 보고마다 기계 확인(HEAD·판정 근거 대조)만 하고 평가 에이전트는 정해진 때(공유 약속 영향, 상 등급 단계 끝, 통합 검증, 머지 관문)에만 띄운다 (`references/multi-session.md`, 작업 세션은 `references/work-session.md`).
- 플러그인을 업데이트한 뒤 war-room을 쓰면, 프로젝트 config의 `templateVersion`이 스킬 템플릿보다 낮을 때 반영할지 한 번 묻는다. 비교는 세션당 한 번이고, 비교·반영은 `scripts/upgrade.py`가 해서 매니저는 요약만 읽는다. 반영하면 기본 롤 문서의 `# 프로젝트별 규칙` 위쪽과 빠진 config 키·STATUS 절·`PLACES.md`(없으면 만들고 예전 `commander/PLACES.md` 줄을 합침)만 바꾸고(템플릿 4판 미만에서 `maxAttempts`가 3이면 새 기본값 1로 바꾼다. 옛 기본값과 일부러 적은 3은 구분하지 못한다), 프로젝트별 규칙과 사용자가 만든 롤은 그대로 둔다. "war-room 업데이트"로 직접 부를 수도 있다 (`references/upgrade.md`).

## war-room-commander

war-room 프로젝트에 **감독(commander) 자리**를 만든다. 감독은 작업 세션 매니저들 윗급으로, 여러 작업 세션에 `[감독 지시]`를 보내고 `[작업 보고]`를 받는다 (운영 규칙은 war-room `references/multi-session.md`). 감독 세션은 배분·사용자 대화·위임만 하고, 요구 분석은 po, 보드 기록은 pm, 진행 검토(git 기계 확인)는 tpm에 맡긴다. 감독 세션에는 매니저가 없고 `war-room/roles/`의 롤도 쓰지 않는다. 감독·커맨더·총지휘자·지휘자·총매니저는 모두 같은 자리다.

```
war-room/
├─ COMMAND.md          # 지휘 보드: 감독 자리, 위임 범위, 작업 세션, 지시 진행(기준선 포함), 교차 판정, 점검할 결정, 머지 관문, 다시 시작하면 할 일, 자리 이력
└─ commander/          # 지정·이어받기 때 없는 것만 생김 (매니저 배정 대상 아님)
   ├─ commander.md     # 감독 지침과 프로젝트별 규칙
   ├─ DECISIONS.md     # 감독 결정 로그 (쌓임, pm이 씀)
   ├─ LESSONS.md       # 감독 시행착오 (사용자 승인된 것만 pm이 반영하고 비움)
   ├─ TALLY.md         # 지시 빈도: 일 종류 · 횟수 · 맡은 롤 · 마지막 날짜 · 제안 표시 (pm이 셈)
   └─ roles/           # 감독 전용 롤: po.md(요구 분석, 위치 찾기, 롤 제안) · pm.md(보드·감독 결정·교훈·지시 빈도와 감독 쪽 장소 목록(war-room/PLACES.md) 기록, 승인된 교훈 반영, 쓰는 유일한 롤) · tpm.md(진행 검토, 로컬 경로 확인)
```

- 감독은 세션이 아니라 자리에 지정한다. 세션 ID 대신 담당 표시(예: `감독-20261119-1500`)를 보드에 적고, 새 세션은 "감독 이어받기"로 자리를 넘겨받는다. 이전 세션이 끝났는지 확인한 뒤에만 넘겨받는다.
- 기본으로는 없는 자리다. 지정하면 `config.json`에 `roles.commander: true`가 생기고, 담당 세션은 `roles/manager.md` 대신 `commander/commander.md`를 따른다. 해제하면 `false`로 바뀌고 보드·`commander/` 파일은 이력으로 남는다. 예전 `roles/commander.md`는 다음 지정·이어받기 때 `commander/commander.md`로 옮겨지고, 예전 판 보드는 같은 때 pm이 템플릿 형식으로 맞춘다 (빠진 절 보충, 보드에 있던 결정·교훈 절은 `commander/` 파일로 옮김).
- 서브에이전트와 연결 워크트리 세션은 감독이 될 수 없다.
- "그 파일 옮겨", "그 깃 이슈 가져와", "지라 업데이트해"처럼 위치가 빠진 요청은 po가 `war-room/PLACES.md`(작업 세션과 같이 쓰는 장소 목록)를 요청 표현으로 grep해 실제 경로·키로 바꾸고, 감독은 그 값을 `[감독 지시]`·위임 프롬프트에 넣는다. 못 찾거나 여러 개면 감독이 사용자에게 묻고 답을 pm이 적는다. 경로가 없어졌으면(tpm이 로컬 경로만 확인, 원격은 작업 보고) 사용자 확인 뒤 pm이 고친다. 감독 세션 자신은 이 파일을 읽지 않는다 (감독 쪽에서 읽는 것은 po·pm·tpm).
- 감독이 `[감독 지시]`를 보낼 때마다 pm(haiku)이 `commander/TALLY.md`에 일 종류별 횟수와 맡은 롤을 센다. 맡은 롤이 없는 일이 3회(war-room 롤 제안의 "자주" 기준)에 이르면 po(sonnet)가 롤 이름·맡을 일·근거 줄·기존 롤에 합칠지 새로 만들지를 내고, 감독이 사용자에게 묻는다. 승인되면 작업 세션이 war-room 롤 추가 절차로 만든다. 물은 줄은 `제안함`·`보류 (n회)`·`거절`로 표시해 다시 묻지 않는다 (보류는 횟수가 2배가 되면 다시 묻는다). `suggestRoles: false`면 묻지 않는다.
- 감독은 새 세션을 직접 띄우지 않는다. 사용자에게 `git worktree add` 뒤 `claude`, `claude --worktree <이름>`, `claude --resume` 중 맞는 명령을 안내한다.
- `war-room-guard` mod는 `roles.commander`가 `true`면 시스템 프롬프트 지침 끝에 "요청을 처리하기 전에 `COMMAND.md`로 이 세션이 담당인지 확인한다"를 붙이고, 담당이면 하 등급도 직접 하지 않고 감독 롤에 맡긴다고 덧붙인다. 시스템 프롬프트는 세션 시작 때 정해지므로 재시작한 세션부터 들어간다.
- 감독 쪽 기록은 작업 세션 매니저의 `war-room/STATUS.md`·`DECISIONS.md`·`LESSONS.md`와 따로 둔다. 세션별 진행은 보드, 감독 쪽 결정·교훈 원문은 `war-room/commander/DECISIONS.md`·`LESSONS.md`(pm이 씀)가 원본이다. 감독 롤은 이 두 파일을 매번 다 읽지 않는다: po는 요청 키워드로 grep해 걸린 항목만, tpm은 이어받기 요약 때 최근 결정 5개만 읽는다. 보드가 20KB를 넘으면 통과한 지시 줄만 archive로 옮기고 자리 이력은 남긴다. 감독 결정·교훈 파일은 작업 세션 쪽 DECISIONS·LESSONS와 같은 규칙으로 `commander/archive/`에 정리한다.

## question-band

입력창 위에 지금 처리 중인 질문을 띄우는 mod. 설치하면 바로 켜진다.

```
❯ 로그인 엔터 제출 추가
  실패 시 3회 잠금
  ⏳ 14:32:05 질문 · 1분 23초 경과      ← 진행 중 (1초마다 갱신)
  ✓ 14:32:05 질문 · 2분 10초 걸림       ← 완료 후, 다음 질문 전까지 유지
```

- 짧은 질문은 원문을 그대로 쓰고, 긴 질문은 haiku로 최대 4줄로 요약한다. 요약 전이나 실패 시에는 원문 앞 4줄을 쓴다.
- 직접 입력한 질문만 대상이다. 백그라운드 알림, 자동 이어가기, 서브에이전트 턴은 제외한다.
- 다른 mod가 같은 자리를 쓰거나 설문이 떠 있으면 양보한다.
- `/question-band`로 켜짐↔꺼짐을 전환한다. 설정은 다음 세션에도 유지된다.

---

## Repository layout

```
.claude-plugin/
├─ plugin.json          # 플러그인 메타데이터
└─ marketplace.json     # 단일 플러그인 마켓플레이스
skills/<name>/
├─ SKILL.md             # 진입점 (frontmatter description = 트리거)
├─ references/          # 필요할 때만 읽는 상세 문서
└─ template/            # 대상 프로젝트에 복사되는 파일
hooks/
├─ hooks.json           # 진입점 register.ts 하나를 가리킴
├─ register.ts          # question-band, eval-band, war-room-guard를 함께 등록
├─ question-band/       # mod 구현 + 테스트
├─ eval-band/           # mod 구현 + 테스트
└─ war-room-guard/      # mod 구현 + 테스트
agents/evaluator.md     # war-room 읽기 전용 평가 에이전트
types/index.d.ts        # mod 타입 선언
```

## Development

```sh
# 로컬 플러그인으로 세션 열기
claude --plugin-dir <armory 클론 경로>

# 매니페스트·스킬 검증
claude plugin validate .

# mod 테스트
claude plugin test .
```

- 스킬을 고친 뒤 열려 있는 세션에 반영하려면 `/reload-plugins`를 실행한다.
- 커밋 메시지는 `commit` 스킬 형식(`<type>: <한글 제목>`)을 따른다.
- `skills/war-room/template/` 아래 파일을 바꾸면 `template/config.json`의 `templateVersion`을 1 올린다. 설치된 프로젝트에 반영 질문이 뜨는 기준이다. 기본 롤 템플릿을 바꿨으면 커밋 뒤 `python3 skills/war-room/template-history/build.py`로 지난 문장 목록도 다시 만든다.
- 스킬은 특정 프로젝트·회사 용어 없이 일반화해서 쓴다. 예시는 중립 도메인(쇼핑몰, 관리자 화면)을 쓴다.

## License

[MIT](LICENSE)
