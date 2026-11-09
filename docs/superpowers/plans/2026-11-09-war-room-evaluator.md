# war-room 평가 롤 Implementation Plan

> **For agentic workers:** 이 레포는 war-room으로 일한다. 매니저가 각 Task를 담당 롤(skill-author, mod-dev, release) 서브에이전트에 맡기고, 별도 검증 에이전트가 판정한다. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** war-room에 기본 평가 롤(evaluator)을 추가하고, 평가가 도는 동안 입력창 위에 이전·지금 평가 상태를 보여주는 mod를 만든다.

**Architecture:** 스킬 문서(evaluation.md 신규, verify-loop·SKILL 수정, 템플릿 evaluator 롤)가 평가 절차를 정의한다. 평가 에이전트는 `war-room/.eval/<롤 id>.json`에 진행 상황을 쓰고, mod `hooks/eval-band/`는 이 파일만 읽어 AbovePrompt 띠를 그린다.

**Tech Stack:** Markdown 스킬, Claude Code mod (TypeScript/TSX, `claude-code` 타입), `claude plugin test`.

**Spec:** `docs/superpowers/specs/2026-11-09-war-room-evaluator-design.md`

## Global Constraints

- 공개 레포: 회사·다른 프로젝트 고유 용어 금지. 예시는 중립 도메인.
- 스킬 문서는 짧은 평서문 "~한다". SKILL.md ≤250줄.
- 갈래 이름 고정: `criteria` `history` `side-effects` `concepts` `metrics`. 상태: `pass` `fail` `warn` `running` `pending` `na`. `current.state`: `planning` `planned` `running` `done` `aborted`.
- 수치: 한계값 초과 ✗, 한계 안 변경 전보다 10% 넘게 나빠짐 ⚠, 3번 재서 중앙값.
- 띠는 `running`·`planning`만, `updatedAt` 30분 넘으면 숨김. 질문 띠와 함께 보이고 평가 띠가 위.
- conceptpowers reference는 읽지 않는다. pending·red 개념은 참고만.
- config 키 이름 기존 그대로, 새 키는 `roles.evaluator`만.
- hooks.json은 `./register.ts` 하나만. 새 mod는 `hooks/eval-band/`에 두고 `hooks/register.ts`에서 등록.
- 커밋 작성자 hinyc noreply, 어트리뷰션 없음. 커밋·push는 release 롤만.

## Review Focus

1. 진행 파일 JSON이 깨졌거나 일부 칸이 없음 → 띠를 그리지 않고 오류도 내지 않는다 (Task 2 테스트).
2. 평가 에이전트가 죽어 `running`이 남음 → 30분 뒤 숨김, 매니저가 `aborted`로 정리 (Task 2 테스트, Task 1 문서).
3. 질문 띠가 켜진 상태에서 평가 띠가 뜸 → 둘 다 보이고 질문 띠가 사라지지 않는다 (Task 2 테스트 + 실제 세션 확인).
4. 기존 설치(evaluator 롤 파일 없음, config에 키 없음) → 지금처럼 임시 검증 에이전트로 동작, 한 번 추가를 제안 (Task 1 문서).
5. war-room이 없거나 `.eval/` 폴더가 없는 프로젝트 → mod가 아무것도 안 그리고 읽기 실패를 삼킨다 (Task 2 테스트).

---

### Task 1: 평가 절차 문서와 기본 롤 템플릿 (skill-author)

**Files:**
- Create: `skills/war-room/references/evaluation.md`
- Create: `skills/war-room/template/roles/evaluator.md`
- Modify: `skills/war-room/references/verify-loop.md` (1절 계획 단계, 2절 검증→평가 롤, 3·4절 진척 수)
- Modify: `skills/war-room/SKILL.md` (기본 롤 2개, 설치 단계·.gitignore, 배정 3·6번, 하지 않는 것, config 표)
- Modify: `skills/war-room/template/config.json` (`"evaluator": true`)
- Modify: `README.md` (war-room 절)

**Interfaces:**
- Produces: 진행 파일 계약 (evaluation.md에 스펙의 JSON 예시·필드 표 그대로). Task 2가 이 계약을 읽는다.

- [ ] **Step 1: evaluation.md 작성** — 스펙의 "흐름", "여러 롤", "QA 롤", "다섯 갈래", "종합 판정", "평가 보고 형식", "데이터" 절을 절차 문서로 옮긴다. 평가 에이전트 프롬프트 두 개(① 계획, ③ 실행)를 넣는다. 각 프롬프트에 진행 파일 쓰기 시점(시작·갈래마다·끝)과 `updatedAt` 갱신을 적는다.
- [ ] **Step 2: template/roles/evaluator.md 작성** — role-template.md 형식. `name: evaluator`, `model: sonnet`, 하는 일(계획·평가), 하지 않는 일(코드 수정 → 담당 롤, reference 읽기), 일하는 방식(갈래 요약, evaluation.md 가리킴), 완료 기준(보고 형식대로, 진행 파일 상태 `done`).
- [ ] **Step 3: verify-loop.md 수정** — 1절에 ① 평가 계획 단계, 2절을 "evaluator 롤이 켜져 있으면 evaluation.md, 꺼져 있으면 지금 방식(검증·QA 롤 → 임시 에이전트)", 3·4절의 "통과한 기준 수"를 "다섯 갈래 ✗ 개수"로.
- [ ] **Step 4: SKILL.md 수정** — 기본 롤 manager + evaluator, 설치 2단계 복사 목록에 `roles/evaluator.md`와 `.gitignore`에 `war-room/.eval/` 추가, 배정 3번(평가 계획), 6번(평가 롤), 기존 설치 안내(한 번 제안, 거절은 DECISIONS), `evaluator`는 지울 수 있음. 250줄 이하.
- [ ] **Step 5: config.json·README 수정**
- [ ] **Step 6: 확인** — Run: `wc -l skills/war-room/SKILL.md` → 250 이하. `claude plugin validate .` → passed. `grep -rn "current.json" skills/` → 없음. SKILL.md가 가리키는 references 경로가 모두 존재.

### Task 2: 평가 진행 띠 mod (mod-dev)

**Files:**
- Create: `hooks/eval-band/progress.ts` (파싱·판정·포맷, 순수 함수)
- Create: `hooks/eval-band/read.ts` (war-room 찾기 + `.eval/*.json` 읽기)
- Create: `hooks/eval-band/band.tsx` (그리기)
- Create: `hooks/eval-band/register.ts`
- Create: `hooks/eval-band/eval-band.test.tsx`
- Modify: `hooks/register.ts` (등록), `hooks/war-room-guard/find.ts` (war-room 폴더 찾기를 켜짐 판단과 분리해 export, 기존 동작 유지), `types/index.d.ts` (`evalBands` 상태)

**Interfaces:**
- Consumes: Task 1의 진행 파일 계약.
- Produces:
  - `type EvalStatus = 'pass'|'fail'|'warn'|'running'|'pending'|'na'`
  - `type EvalMetric = { name: string; value: number; unit: string; limit?: number; baseline?: number }`
  - `type EvalItem = { group: 'criteria'|'history'|'side-effects'|'concepts'|'metrics'; status: EvalStatus; summary?: string; metrics?: EvalMetric[] }`
  - `type EvalRun = { attempt: number; state?: 'planning'|'planned'|'running'|'done'|'aborted'; verdict?: 'pass'|'fail'; focus?: string; items: EvalItem[] }`
  - `type EvalProgress = { task: string; role: string; maxAttempts?: number; previous?: EvalRun; current: EvalRun; updatedAt: string }`
  - `parseProgress(text: string): EvalProgress | undefined`
  - `isVisible(p: EvalProgress, nowMs: number): boolean`
  - `metricText(m: EvalMetric): string`
  - `readProgress($: EngineInterface): Promise<EvalProgress[]>`
  - `drawEvalBand($, e: RenderInput, list: readonly EvalProgress[], beneath: RenderElement | null): RenderElement`

- [ ] **Step 1: 실패하는 테스트 작성** (`eval-band.test.tsx`)
  - `parseProgress('{')` → `undefined`; `current` 없음 → `undefined`; 알 수 없는 group → 그 항목만 버리거나 `undefined` (구현자 선택, 테스트로 고정)
  - `isVisible`: `state: 'running'` + 방금 → true; `planning` → true; `done`/`planned`/`aborted` → false; `running` + `updatedAt` 31분 전 → false
  - `metricText({name:'응답',value:182,unit:'ms',limit:300,baseline:120})` → `'응답 182ms/300 ⚠ (+62)'` (52% 나빠짐)
  - `metricText({name:'응답',value:310,unit:'ms',limit:300})` → `'응답 310ms/300 ✗'`
  - `metricText({name:'빌드',value:4.1,unit:'s',limit:10,baseline:4.0})` → `'빌드 4.1s/10 ✓'` (2.5%, 10% 이하)
  - 띠: 진행 파일 없음 → 아래 그림(beneath) 그대로 반환
  - 띠: running 하나 + 질문 띠 그림이 beneath → 평가 블록이 위, beneath가 아래에 모두 있음
  - 띠: `previous` 있으면 "이전 (시도 1)" 줄, 없으면 그 줄 없음
  - read: war-room 없음 / `.eval` 없음 / 읽기 throw → `[]`
- [ ] **Step 2: 테스트 실행해 실패 확인** — Run: `claude plugin test .` → 새 테스트 FAIL
- [ ] **Step 3: progress.ts, read.ts, band.tsx 구현** — 기호 ✓ ✗ ⚠ … · –. 1초 시계로 `$.state.armory.evalBands` 갱신(`session.start`에서 시작, 질문 띠 ticker 방식 참고). 좁은 폭 줄임 규칙은 구현자 선택.
- [ ] **Step 4: register.ts 등록과 순서** — `ui.render` AbovePrompt에서 `beneath = await next(e)` 후 평가 블록을 위에 쌓는다. 질문 띠가 평가 띠를 "다른 mod 그림"으로 보고 양보하지 않도록 등록 순서를 정한다(평가 띠 hook이 질문 띠 hook을 감싸야 한다). 순서는 실제 세션에서 확인.
- [ ] **Step 5: 테스트 통과** — Run: `claude plugin test .` → 전체 PASS (기존 22개 포함). `claude plugin validate .` → passed.
- [ ] **Step 6: 실제 세션 확인** — `claude --plugin-dir .` 세션에서 `war-room/.eval/test.json`(running, previous 포함)을 손으로 만들어 띠가 질문 띠와 함께 보이는지, 파일을 `done`으로 바꾸면 2초 안에 사라지는지 확인 후 파일 삭제.

### Task 3: 이 레포 war-room에 evaluator 적용 (manager)

**Files:**
- Create: `war-room/roles/evaluator.md` (템플릿 복사 + 프로젝트별: 테스트 명령 `claude plugin test .`, validate, 금지어 grep)
- Modify: `war-room/config.json` (`"evaluator": true`), `.gitignore` (`war-room/.eval/`), `war-room/DECISIONS.md`, `war-room/STATUS.md`

- [ ] **Step 1: 롤 파일·config·.gitignore 추가**
- [ ] **Step 2: DECISIONS(평가 롤 도입)·STATUS 갱신** — 릴리즈 커밋 전에.

### Task 4: v0.4.0 릴리즈 (release)

- [ ] **Step 1:** 매니페스트 2개 `0.4.0`, validate·test 통과
- [ ] **Step 2:** 커밋 분리 — `feat: war-room 평가 롤 추가`(스킬·템플릿·README), `feat: 평가 진행 띠 mod 추가`(hooks·types), `docs: war-room 평가 롤 설계·계획 추가`(docs/superpowers), `docs: war-room 운영 문서 갱신`(war-room/·.gitignore), `chore: 버전 0.4.0으로 올림`
- [ ] **Step 3:** hinyc 전환 → push → 태그 v0.4.0 → 릴리즈 → 원래 계정 복구
