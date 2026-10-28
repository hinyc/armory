---
name: screen-spec
description: Use when the user wants a screen design document (화면설계서, 화면명세서, screen spec, UI spec) generated from a running web app, or wants an existing one re-run or updated after code changes ("화면설계서 만들어줘", "화면설계서 다시 뽑아줘", "화면설계서 업데이트", "바뀐 화면 반영해줘"). Builds Playwright capture scripts with mocked APIs once, commits them, and re-runs them to produce an HTML document with real screenshots, code-based descriptions, and optional requirement traceability.
---

# 화면설계서 (screen-spec)

## 개요

실제 앱 화면을 찍어 화면설계서를 만든다. **스크립트는 한 번 만들어 레포에 커밋하고, 이후에는 실행하거나 바뀐 부분만 고친다.**

품질을 만드는 다섯 가지:
1. **실제 화면**: 목업이 아니라 dev 서버에 뜬 앱을 찍는다. 설계서와 구현이 어긋나지 않는다.
2. **목 API로 상태 고정**: 로딩·빈 상태·오류·다이얼로그를 매번 같게 재현한다. 목을 등록하지 않은 호출과 콘솔 에러가 있으면 테스트가 실패한다.
3. **코드를 읽고 쓴 설명**: 진입 방법, 색·컨트롤의 의미, 다음 동작, 갱신 주기처럼 실제 동작을 쓴다.
4. **요구사항 ↔ 화면 양방향 추적** (선택): 납품·검수에 쓸 수 있다.
5. **다시 생성**: 코드가 바뀌면 다시 돌린다. 문서가 낡지 않는다.

**대상**: dev 서버로 뜨는 웹 SPA(React·Vue·Svelte 등) + HTTP API. Playwright로 열 수 있어야 한다.

## 모드 고르기

| 요청 | 모드 | LLM 역할 |
|---|---|---|
| "화면설계서 만들어줘" (`e2e/screen-spec/`이 없음) | **구축** | 시나리오·목데이터·설명 작성 |
| "다시 뽑아줘", "최신 화면으로" | **실행** | 없음. 스크립트만 실행 |
| "업데이트", "바뀐 화면 반영", 실행이 실패함 | **업데이트** | 바뀐 화면의 스크립트·설명만 수정 |

`e2e/screen-spec/`이 이미 있으면 구축 모드로 가지 않는다. 기존 스크립트를 덮어쓰지 않는다.

## 템플릿

이 스킬 폴더의 `template/`을 대상 프로젝트 루트에 복사한다.

| 파일 | 역할 | 수정 |
|---|---|---|
| `playwright.screen-spec.config.ts` | 캡처 실행 설정 (뷰포트·로케일·시간대·모션 줄이기 고정) | 필요 시 storageState만 |
| `playwright.screen-spec-html.config.ts` | 캡처 없이 HTML만 재생성 | 안 함 |
| `e2e/screen-spec/support/spec.config.ts` | 제목, 섹션 순서, dev 서버, API 패턴, 고정 시각, 다이얼로그 셀렉터 | **프로젝트마다 채움** |
| `e2e/screen-spec/support/*` | 목 API, 캡처, 데이터 검증, HTML 생성, 리포터 | 안 함 |
| `e2e/screen-spec/affected.mjs` | 업데이트 모드: 바뀐 파일 → 영향받는 캡처 | 안 함 |
| `e2e/screen-spec/example.screen.ts` | 시나리오 예시 | 참고 후 삭제 |
| `external.example/` | 외부 데이터 예시 | 외부 폴더로 복사해 씀 |

package.json에 추가할 스크립트:

```json
{
  "screen-spec": "node -e \"fs.rmSync('docs/screen-spec',{recursive:true,force:true})\" && playwright test -c playwright.screen-spec.config.ts",
  "screen-spec:only": "playwright test -c playwright.screen-spec.config.ts",
  "screen-spec:html": "playwright test -c playwright.screen-spec-html.config.ts --pass-with-no-tests",
  "screen-spec:affected": "node e2e/screen-spec/affected.mjs"
}
```

- `screen-spec:only <파일>`은 일부 시나리오만 다시 찍는다. 기존 결과를 지우지 않아서, 삭제·이름을 바꾼 캡처의 옛 결과가 남는다. 마무리는 항상 `screen-spec`(전체)로 한다.
- 결과물: `docs/screen-spec/` (`index.html`, `shots/`, `data/`, `report.json`). gitignore에 넣는다.

## 구축 모드

0. **사전 점검**
   - 확인할 것:
     - `@playwright/test`와 브라우저 설치 여부. Playwright는 `page.clock`을 쓰므로 1.45 이상이어야 한다.
     - `zod` 설치 여부
     - dev 서버 명령과 포트
     - 라우터 종류와 라우트 정의 위치
     - API 호출 계층(fetch·axios, 기본 경로)
     - 인증 방식
     - UI 라이브러리(다이얼로그 DOM)
   - 없는 패키지는 설치 명령을 보여주고 승인을 받은 뒤 devDependency로 추가한다.
   - API가 같은 출처의 접두사(`/api`)가 아니면 `apiPattern`을 실제 호출 URL에 맞춘다.
1. **화면·상태 목록**
   - 라우트를 분석해 표로 만든다: 섹션 → 화면(라우트) → 찍을 상태(kind).
   - kind 종류: `page`(기본 화면), `state`(로딩·빈 상태·오류·권한 등 같은 화면의 다른 상태), `dialog`, `alert`, `component`.
   - 상태는 코드에 실제 분기가 있는 것만 넣는다: 조건부 렌더링, 오류 처리, 빈 배열 처리.
   - **표를 사용자에게 보여주고 승인을 받는다.** 범위가 크면 섹션 단위로 나눠 진행한다.
2. **뼈대 설치**
   - `template/`을 복사하고 `spec.config.ts`를 채운다. `sections`는 1번 표의 섹션 순서대로 쓴다.
   - package.json 스크립트를 추가하고 `docs/screen-spec`을 gitignore에 넣는다.
   - 외부 데이터 폴더를 정한다(기본 `~/Documents/<프로젝트>-screen-spec`, 환경변수 `SCREEN_SPEC_SOURCE_DIR`로 바꿀 수 있다).
3. **인증과 공통 목**
   - 로그인이 필요하면 아래 중 하나로 우회하고, 이유를 주석으로 남긴다.
     - setup 프로젝트에서 storageState 만들기
     - `addInitScript`로 토큰 심기
     - 테스트용 환경변수
   - 모든 화면이 부르는 API(사용자 정보, 메뉴, 설정)는 `fixtures/common.ts`에 모아 매 테스트 처음에 등록한다.
4. **섹션별 반복** (한 번에 한 섹션)
   - 화면이 실제로 부르는 API를 코드에서 찾아 `fixtures/<area>.ts`에 빌더(`buildX(overrides)`)로 만든다.
   - 응답 모양은 타입 정의나 API 클라이언트 코드에서 가져온다.
   - `<area>.screen.ts`를 작성한다. 패턴은 `example.screen.ts`와 `references/state-recipes.md`를 따른다.
   - 실행: `pnpm screen-spec:only e2e/screen-spec/<area>.screen.ts`
   - 실패하면 고친다:
     - 목 누락 → 목을 추가한다.
     - 셀렉터 → 화면 코드를 다시 읽는다.
     - 콘솔 에러 → 원인을 확인한다. 정말 무관한 소음일 때만 이유를 적어 `consoleAllow`에 넣는다.
   - 스샷을 직접 열어 의도한 상태가 찍혔는지 확인한다. 로딩 스피너만 찍혔거나 빈 화면이면 기다리는 조건을 고친다.
5. **설명 작성**
   - 해당 컴포넌트 코드를 읽고 `references/writing-descriptions.md` 규칙으로 `title`과 `description`을 쓴다.
   - 코드에서 확인한 것만 쓴다. 추측은 쓰지 않는다.
   - `source`에는 이 캡처를 그리는 파일을 모두 적는다. 업데이트 모드가 이 값으로 영향 범위를 찾는다.
6. **(선택) 요구사항 연결**
   - 사용자가 요구사항 문서를 주면 `requirements.json`으로 변환한다. 형식이 문서마다 달라서 변환 스크립트는 그때 작성하고, 외부 폴더에 둔다.
   - `references/requirements-mapping.md` 기준으로 `mapping.json` 초안을 쓴다. 모든 연결에 근거(rationale)를 쓰고 `draft: true`로 둔다.
   - 사람이 검토를 마쳤다고 할 때만 `draft: false`로 바꾼다.
7. **생성과 검토**
   - `pnpm screen-spec`을 실행하고 `report.json`의 실패·경고를 0으로 만든다.
   - `docs/screen-spec/index.html`을 열어 사용자와 검토한다. 문구 수정 요청은 시나리오의 description을 고친다.
   - 검토가 끝나면 `spec.config.ts`의 `lastBuiltCommit`을 현재 커밋으로 바꾸고, `e2e/screen-spec/`과 설정 변경을 커밋하자고 제안한다.

## 실행 모드

- `pnpm screen-spec`만 실행한다. 스샷은 현재 코드 기준으로 새로 찍힌다.
- 성공하면 결과 경로와 캡처 수를 알려준다.
- 실패하면 `report.json`의 실패 목록을 보여주고 업데이트 모드를 제안한다.

## 업데이트 모드

1. **변경 범위 찾기**: `pnpm screen-spec:affected`를 실행한다(기준: `lastBuiltCommit`, 인자로 다른 커밋을 넘길 수 있다).
   - `affected`: 소스가 바뀐 캡처
   - `uncovered`: 어느 캡처의 source에도 없는 바뀐 파일. 새 화면이거나 source 누락일 수 있다.
   - `harnessChanged`: 바뀐 fixtures·공통 목·설정. 이 파일을 쓰는 시나리오를 다시 돌린다.
   - `failures`: 직전 실행에서 실패한 테스트
2. **영향 표 작성**: 바뀐 코드를 읽고 캡처마다 하나로 분류해 사용자에게 보여준 뒤 승인을 받는다.
   - 다시 찍기만: 문구·스타일만 바뀜
   - 시나리오 수정: 셀렉터·흐름이 바뀜
   - 목데이터 수정: API 응답 모양이 바뀜
   - 설명 수정: 동작·색·조건이 바뀜
   - 새 화면·상태 추가
   - 삭제: 화면이 없어짐 (요구사항 연결도 함께 정리)
3. **해당 부분만 수정**: 영향받은 시나리오·fixtures·설명만 고치고, 그 파일만 `screen-spec:only`로 먼저 확인한다.
4. **전체 재생성**: `pnpm screen-spec`. 실패가 0이 될 때까지 3번을 반복한다.
5. **기록 갱신**
   - `lastBuiltCommit`을 갱신한다.
   - 설명이 바뀌었거나 새로 생긴 캡처의 요구사항 연결은 다시 검토 대상으로 표시하고, `draft: true`로 돌린다.
   - 바뀐 캡처 목록을 요약한다.

## 문구만 고칠 때

- 시나리오를 건드리지 않고 외부 `overrides.json`에 `{ "<캡처id>": { "title": "...", "description": "..." } }`를 쓴다.
- 그다음 `pnpm screen-spec:html`을 실행한다. 캡처 없이 몇 초면 끝난다.
- 오래 갈 수정이면 시나리오의 description에 반영하고 override는 지운다.

## 외부 데이터 (레포 밖)

- `requirements.json`, `mapping.json`, `overrides.json`. 스키마는 `references/data-schema.md`에 있다.
- 레포 밖에 두는 이유:
  - 고객 요구사항 원문을 레포에 커밋하지 않는다.
  - 다시 캡처해도 사람이 고친 내용이 지워지지 않는다.
- 파일이 없으면 경고만 하고 넘어간다. 형식이 틀리면 파일 이름과 위치를 담아 생성을 중단한다.

## 하지 말 것

- 실제 고객 데이터, 개인정보, 비밀값을 목데이터에 넣지 않는다. 그럴듯한 가짜 값을 쓴다.
- 목을 등록하지 않은 호출을 우회하려고 실제 서버를 부르지 않는다.
- 테스트를 통과시키려고 `waitForTimeout`을 늘리지 않는다. 화면 조건(`expect(...).toBeVisible()`, `waitForResponse`)으로 기다린다. 차트 애니메이션처럼 조건이 없는 경우만 예외로 하고 이유를 주석으로 쓴다.
- 승인 없이 앱 소스를 고치지 않는다. 수정은 package.json·gitignore·`e2e/screen-spec/`·Playwright 설정까지만 한다. 찍기 어려운 화면은 사용자에게 알리고 방법을 고르게 한다.
- `support/` 템플릿 파일을 프로젝트 사정에 맞춰 고치지 않는다. 설정은 `spec.config.ts`로 한다. 고쳐야 한다면 이유를 알린다.
- 답변은 한글, 개괄식으로 쓴다.
