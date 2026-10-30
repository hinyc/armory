---
name: screen-spec
description: Use when the user wants a screen design document (화면설계서, 화면명세서, screen spec, UI spec) generated from a running web app, or wants an existing one re-run or updated after code changes ("화면설계서 만들어줘", "화면설계서 다시 뽑아줘", "화면설계서 업데이트", "바뀐 화면 반영해줘"), or wants numbered boxes or arrows drawn on its screenshots ("캡처에 번호 표시", "영역 박스 쳐줘", "매뉴얼용 이미지"). Builds Playwright capture scripts with mocked APIs once, commits them, and re-runs them to produce an HTML document with real screenshots, code-based descriptions, and optional requirement traceability.
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

- `e2e/screen-spec/`이 이미 있으면 구축 모드로 가지 않는다. 기존 스크립트를 덮어쓰지 않는다.
- package.json에 같은 이름(`screen-spec*`)의 스크립트가 이미 있고 다른 구현을 가리키면, 덮어쓰지 말고 사용자에게 묻는다. 승인이 없으면 다른 이름을 쓴다.
  - 스크립트 이름: `ui-spec`, `ui-spec:only` …
  - **출력 폴더도 함께 바꾼다**: `docs/screen-spec`을 다른 구현이 쓰고 있으면 `spec.config.ts`의 `outDir`을 `docs/ui-spec`으로 바꾸고, 스크립트의 삭제 경로·gitignore도 맞춘다. 같은 폴더를 쓰면 전체 실행이 다른 구현의 결과물을 지운다.

## 템플릿

이 스킬 폴더의 `template/`을 대상 프로젝트 루트에 복사한다.

| 파일 | 역할 | 수정 |
|---|---|---|
| `playwright.screen-spec.config.ts` | 캡처 실행 설정 (뷰포트·로케일·시간대·모션 줄이기 고정) | 필요 시 storageState만 |
| `playwright.screen-spec-html.config.ts` | 캡처 없이 HTML만 재생성 | 안 함 |
| `e2e/screen-spec/support/spec.config.ts` | 제목, 섹션 순서, dev 서버, API 패턴, 뷰포트, 시계 방식, 다이얼로그 셀렉터 | **프로젝트마다 채움** |
| `e2e/screen-spec/support/*` | 목 API, 캡처, 데이터 검증, HTML 생성, 리포터 | 안 함 |
| `e2e/screen-spec/state.json` | 업데이트 기준 커밋(`lastBuiltCommit`), 하네스 밖 의존 경로(`harnessDeps`) | 에이전트가 갱신 |
| `e2e/screen-spec/affected.mjs` | 업데이트 모드: 바뀐 파일 → 영향받는 캡처 | 안 함 |
| `e2e/screen-spec/contact-sheet.mjs` | 스샷 검토용 모아 보기 이미지 생성 | 안 함 |
| `e2e/screen-spec/annotations/*.json` | 좌표를 직접 적는 박스·번호·화살표·잘라내기 (템플릿에는 없음) | 필요할 때 만듦 |
| `e2e/screen-spec/example.screen.ts` | 시나리오 예시 | 참고 후 삭제 |
| `external.example/` | 외부 데이터 예시 | 외부 폴더로 복사해 씀 |

package.json에 추가할 스크립트:

```json
{
  "screen-spec": "node -e \"fs.rmSync('docs/screen-spec',{recursive:true,force:true})\" && playwright test -c playwright.screen-spec.config.ts",
  "screen-spec:only": "playwright test -c playwright.screen-spec.config.ts",
  "screen-spec:html": "playwright test -c playwright.screen-spec-html.config.ts --pass-with-no-tests",
  "screen-spec:affected": "node e2e/screen-spec/affected.mjs",
  "screen-spec:sheet": "node e2e/screen-spec/contact-sheet.mjs"
}
```

- pnpm 10 이상에서 의존성 상태 검사 때문에 스크립트 실행이 막히면 `node_modules/.bin/playwright ...`로 직접 실행한다.

- `screen-spec:only <파일>`은 일부 시나리오만 다시 찍는다. 기존 결과를 지우지 않아서, 삭제·이름을 바꾼 캡처의 옛 결과가 남는다. 마무리는 항상 `screen-spec`(전체)로 한다.
- 결과물: `docs/screen-spec/` (`index.html`, `shots/`, `data/`, `annotated/`, `report.json`). gitignore에 넣는다.

## 구축 모드

0. **사전 점검** (결과는 `spec.config.ts`와 3단계에 반영한다)

   | 확인할 것 | 반영 |
   |---|---|
   | `@playwright/test` 1.45 이상(`page.clock`), 브라우저 설치, `zod`(3·4 모두 됨) | 없으면 설치 명령을 보여주고 승인 후 devDependency로 추가 |
   | dev 서버 명령·포트, **기동에 필요한 환경변수** (백엔드 프록시 주소 등) | `webServerCommand`. API는 모두 목이라 프록시 대상은 닿지 않는 더미 주소(`http://127.0.0.1:9`)로 둬도 된다 |
   | 뷰포트: 기존 Playwright 설정·고정 해상도(전용 단말, vh 레이아웃) | `viewport`. 기존 회귀 테스트 설정이 있으면 그 값을 따른다 |
   | 차트·애니메이션 라이브러리(Chart.js, ECharts, framer-motion 등) | 있으면 `clockMode: 'flowing'` (없으면 'fixed') |
   | API 호출 계층(fetch·axios)과 기본 경로 | `apiPattern`. 같은 출처 `/api`가 아니면 실제 URL에 맞춘다 |
   | 인증 상태 저장 위치 | localStorage·쿠키 → storageState, **sessionStorage → `addInitScript`** (storageState에 안 담긴다) |
   | UI 라이브러리의 다이얼로그 DOM, 여러 다이얼로그가 겹쳐 뜨는지 | `dialogSelector`. 겹쳐 뜨면 `captureDialog`에 항상 `hasText` |
   | 기존 회귀 e2e 인프라(목데이터 빌더, 인증 주입) | 목데이터 빌더·타입은 가져다 쓴다. `test` 픽스처는 템플릿 것을 쓴다(섞으면 목 감시가 빠진다). 가져온 경로는 `state.json`의 `harnessDeps`에 적는다 |
   | tsconfig가 `e2e/`를 포함하는지, 빌드가 tsc를 돌리는지 | 포함하면 7단계 `tsc --noEmit`이 필수 (깨지면 앱 빌드가 깨진다). 루트의 Playwright 설정 파일을 이름으로 나열하는 tsconfig면 `playwright.screen-spec*.config.ts`도 추가한다 |
   | package.json·gitignore의 기존 `screen-spec` 항목 | 위 "모드 고르기"의 충돌 규칙 |

1. **화면·상태 목록**
   - 라우트를 분석해 표로 만든다: 섹션 → 화면(라우트) → 찍을 상태(kind).
   - kind 기준 (`references/data-schema.md`):
     - `page`: 화면의 기본 모습
     - `state`: 같은 화면의 다른 모습 (로딩·빈 상태·오류·권한·변형)
     - `dialog`: 입력이나 선택을 받는 창 (확인/취소, 폼, 인증)
     - `alert`: 메시지만 알리는 창 (앱이 그린 안내창, 브라우저 기본 alert)
     - `component`: 화면 일부만 확대 (툴팁, 범례, 카드)
   - 상태는 코드에 실제 분기가 있는 것만 넣는다. **아래 변형 축을 하나씩 코드에서 찾아 빠짐없이 확인한다.**

     | 변형 축 | 코드에서 찾을 곳 | 찍는 방법 |
     |---|---|---|
     | 역할·권한 | 역할별 메뉴, 라우트 가드, `role ===` 분기 | 화면이 달라지는 역할마다 1장 |
     | 서버·환경·설정 종류 | 설정값·서버 유형별 분기, feature flag | **값마다 화면이 다르면 각각 1장** (합치지 않는다) |
     | 선택·드릴다운 결과 | 선택 상자·탭·필터 onChange 뒤의 재조회 | 열린 목록 1장 + **선택한 뒤 결과 1장** |
     | 데이터 양 | 0건, 1건, 많음(스크롤·페이지), 긴 문자열 | 0건은 필수, 나머지는 레이아웃이 달라질 때 |
     | 진행 단계 | 로딩, 진행 중, 완료, 마감·잠김 | 단계마다 1장 |
     | 실패 | API 오류, 검증 실패, 권한 없음 | 문구가 다르면 각각 1장 |
     | 흐름 | 다이얼로그 연쇄 (요청 → 결과 → 다음 단계) | 단계마다 1장 |

   - 같은 화면이 비슷해도 **보이는 요소가 달라지면 합치지 않는다** (예: 지역 선택기가 있는 유형과 없는 유형).
   - **표를 사용자에게 보여주고 승인을 받는다.** 표에는 축별로 "찍음 / 해당 없음(이유)"을 남긴다. 범위가 크면 섹션 단위로 나눠 진행한다.
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
   - **테스트 통과가 곧 정상은 아니다.** `pnpm screen-spec:sheet`로 모아 보기 이미지(`docs/screen-spec/review/sheet-*.png`)를 만들어 전부 눈으로 확인한다.
     - 빈 차트, 로딩 스피너만 찍힘, 이전 캡처의 툴팁·다이얼로그가 남음 → 기다리는 조건이나 시계 방식을 고친다.
     - 의심되는 장은 원본 `shots/<id>.png`를 열어 확인한다.
5. **설명 작성**
   - 해당 컴포넌트 코드를 읽고 `references/writing-descriptions.md` 규칙으로 `title`과 `description`을 쓴다.
   - 코드에서 확인한 것만 쓴다. 추측은 쓰지 않는다.
   - `source`에는 이 캡처를 그리는 파일을 모두 적는다. 업데이트 모드가 이 값으로 영향 범위를 찾는다.
   - 영역이 많은 화면(레이아웃 소개)은 스샷에 박스·번호를 그리고 설명에서 ①②로 가리킨다. 요소를 지정하면 캡처할 때 좌표를 잰다. 방법과 규칙은 `references/annotations.md`.
   - 사용자가 매뉴얼·보고서용으로 잘라낸 번호 이미지를 원하면 `annotations/*.json`으로 만든다. 결과 PNG는 직접 열어 위치를 확인한다.
6. **(선택) 요구사항 연결**
   - 사용자가 요구사항 문서를 주면 `requirements.json`으로 변환한다. 형식이 문서마다 달라서 변환 스크립트는 그때 작성하고, 외부 폴더에 둔다.
   - `references/requirements-mapping.md` 기준으로 `mapping.json` 초안을 쓴다. 모든 연결에 근거(rationale)를 쓰고 `draft: true`로 둔다.
   - 사람이 검토를 마쳤다고 할 때만 `draft: false`로 바꾼다.
7. **생성과 검토**
   - `pnpm screen-spec`을 실행하고 `report.json`의 실패·경고를 0으로 만든다. 설명 길이 기준을 넘은 캡처도 경고로 나온다.
   - 섹션별 `:only`에서는 통과했는데 전체 실행에서만 시간 초과가 나면 dev 서버 첫 컴파일 탓이다. 템플릿의 `expect.timeout`(15초)을 줄이지 말고, 페이지 첫 기다림은 화면 뼈대(제목·표 머리글)로 한다.
   - `tsc --noEmit`(프로젝트 tsconfig)을 실행해 하네스가 타입 오류를 만들지 않았는지 확인한다.
   - 모아 보기 이미지를 다시 만들어 전체를 한 번 더 훑는다.
   - `docs/screen-spec/index.html`을 열어 사용자와 검토한다. 문구 수정 요청은 시나리오의 description을 고친다.
   - 검토가 끝나면 커밋을 제안한다. 커밋한 뒤 그 해시를 `state.json`의 `lastBuiltCommit`에 써서 다음 커밋에 넣는다. `state.json` 변경은 영향 분석에서 제외되므로 이 후속 커밋이 다음 업데이트에 잡히지 않는다.
   - `lastBuiltCommit`이 비어 있으면 `affected`가 `e2e/screen-spec/`을 처음 추가한 커밋을 기준으로 쓴다.

## 실행 모드

- `pnpm screen-spec`만 실행한다. 스샷은 현재 코드 기준으로 새로 찍힌다.
- 성공하면 결과 경로와 캡처 수를 알려준다.
- 실패하면 `report.json`의 실패 목록을 보여주고 업데이트 모드를 제안한다.

## 업데이트 모드

1. **변경 범위 찾기**: `pnpm screen-spec:affected`를 실행한다(기준: `state.json`의 `lastBuiltCommit`, 인자로 다른 커밋을 넘길 수 있다).
   - `affected`: 소스가 바뀐 캡처
   - `uncovered`: 어느 캡처의 source에도 없는 바뀐 파일. 새 화면이거나 source 누락일 수 있다.
   - `harnessChanged`: 바뀐 fixtures·공통 목·Playwright 설정·`harnessDeps` 경로. 이 파일을 쓰는 시나리오를 다시 돌린다.
   - `failures`: 직전 실행에서 실패한 테스트
   - `annotationsToCheck`: 영향받은 캡처에 좌표를 직접 적은 표시 파일. 재생성 뒤 `annotated/` 이미지를 열어 어긋났으면 좌표를 고친다.
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
   - 커밋한 뒤 `state.json`의 `lastBuiltCommit`을 그 해시로 갱신한다.
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
- 파일이 없으면 조용히 넘어간다(요구사항 기능을 안 쓰는 프로젝트는 아무것도 만들 필요 없다). 형식이 틀리면 파일 이름과 위치를 담아 생성을 중단한다.

## 하지 말 것

- 실제 고객 데이터, 개인정보, 비밀값을 목데이터에 넣지 않는다. 그럴듯한 가짜 값을 쓴다.
- 목을 등록하지 않은 호출을 우회하려고 실제 서버를 부르지 않는다.
- 테스트를 통과시키려고 `waitForTimeout`을 늘리지 않는다. 화면 조건(`expect(...).toBeVisible()`, `waitForResponse`)으로 기다린다. 차트 애니메이션처럼 조건이 없는 경우만 예외로 하고 이유를 주석으로 쓴다.
- 승인 없이 앱 소스를 고치지 않는다. 수정은 package.json·gitignore·`e2e/screen-spec/`·Playwright 설정까지만 한다. 찍기 어려운 화면은 사용자에게 알리고 방법을 고르게 한다.
- `support/` 템플릿 파일을 프로젝트 사정에 맞춰 고치지 않는다. 설정은 `spec.config.ts`로 한다. 고쳐야 한다면 이유를 알린다.
- 답변은 한글, 개괄식으로 쓴다.
