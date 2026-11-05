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
| [`question-band`](#question-band) | mod + skill | 입력창 위에 현재 질문 요약과 경과 시간 표시 | `/question-band` (전환) |

스킬은 설명(description)에 맞는 요청이 오면 자동으로 쓰인다. 직접 부르려면 `/armory:<이름>`.

---

## commit

변경이 여러 개인 커밋을 `<type>: <한글 제목>` + bullet 3~5줄로 쓴다. 타입은 `feat` `fix` `refactor` `perf` `docs` `test` `chore`.

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
├─ config.json       # 전체·롤별 on/off, 시도 상한, 롤 분리 제안 on/off
├─ roles/
│  ├─ manager.md     # 기본 롤 (배정·검증·문서 정리)
│  └─ <id>.md        # 프로젝트에 맞게 추가 (description, scope, model, skills, refs)
├─ STATUS.md         # 현재 상황 (덮어쓰기)
├─ DECISIONS.md      # 결정 로그 (쌓임)
├─ LESSONS.md        # 시행착오·롤 문서 개선 후보 (반영하면 비움)
└─ archive/
```

```json
{ "enabled": true, "maxAttempts": 3, "suggestRoles": true, "roles": { "manager": true } }
```

```
요청 → 담당 롤 찾기 → 요구 기준 정하기 → 롤 에이전트 실행 → 검증 에이전트 판정
                                            ↑                      │ 실패
                                            └── 원인별 재배정 ──────┘
```

- `war-room-guard` mod가 `war-room/`이 켜진 프로젝트의 시스템 프롬프트에 "먼저 담당 롤을 찾는다" 지침을 넣는다. config의 `enabled: false`면 빠진다.
- 검증은 구현한 에이전트가 아닌 별도 에이전트가 기준별로 판정한다.
- 시도 상한에 닿았거나, 나아지지 않거나, 한계에 부딪히면 멈춘다. 멈출 때는 최고 결과와 함께 대안을 2개 이상 보고한다.
- 사용자가 "될 때까지"처럼 지시하면 상한을 무시하고 접근을 바꿔 가며 계속 반복한다.
- 자주·길게·참고할 것이 많은 일은 롤 분리를 제안한다. 이 제안은 `suggestRoles: false`로 끈다.
- 작업 로그는 따로 남기지 않는다. 변경 이력은 git에 맡긴다.

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
├─ register.ts          # question-band와 war-room-guard를 함께 등록
├─ question-band/       # mod 구현 + 테스트
└─ war-room-guard/      # mod 구현 + 테스트
types/index.d.ts        # mod 타입 선언
```

## Development

```sh
# 로컬 플러그인으로 세션 열기
claude --plugin-dir ~/Documents/GitHub/armory

# 매니페스트·스킬 검증
claude plugin validate .

# mod 테스트
claude plugin test .
```

- 스킬을 고친 뒤 열려 있는 세션에 반영하려면 `/reload-plugins`를 실행한다.
- 커밋 메시지는 `commit` 스킬 형식(`<type>: <한글 제목>`)을 따른다.
- 스킬은 특정 프로젝트·회사 용어 없이 일반화해서 쓴다. 예시는 중립 도메인(쇼핑몰, 관리자 화면)을 쓴다.

## License

[MIT](LICENSE)
