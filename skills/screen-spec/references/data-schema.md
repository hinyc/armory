# 데이터 스키마

스키마 정의 원본은 `template/e2e/screen-spec/support/types.ts`(zod)이다.

## 캡처 항목: `docs/screen-spec/data/<id>.json`

`captureScreen`이 자동으로 쓴다. 손으로 고치지 않는다.

| 필드 | 설명 |
|---|---|
| `id` | kebab-case, 전체에서 유일. 파일 이름으로도 쓴다 |
| `section` | `spec.config.ts`의 `sections` key. 목차 순서가 된다 |
| `screen` | 같은 값끼리 한 화면으로 묶인다 |
| `kind` | `page`(기본 모습) · `state`(같은 화면의 다른 모습) · `dialog`(입력·선택을 받는 창) · `alert`(메시지만 알리는 창, 앱이 그린 것 포함) · `component`(일부 확대) |
| `title`, `description` | 제목과 설명 |
| `route` | 화면 경로 |
| `source` | 이 캡처를 그리는 소스 파일 목록. 업데이트 모드의 영향 분석 기준 |
| `image` | `shots/<id>.png` |
| `sortKey` | `시나리오파일:줄:순번`. 병렬 실행해도 문서 순서가 소스 순서를 따른다 |
| `specFile` | 시나리오 파일 |
| `nativeDialog` | `{ type, message }`. 브라우저 기본 알림창을 문서에서 덮어 그릴 때 쓴다 |
| `marks` | `[{ box: [x, y, 너비, 높이], num?, badge?, color? }]`. `captureScreen`의 `marks` 옵션으로 잰 표시. 있으면 문서에 `annotated/<id>.png`가 들어간다 |

## 표시 파일: `e2e/screen-spec/annotations/*.json` (선택, 레포에 커밋)

좌표를 직접 적는 박스·번호·화살표·잘라내기. 필드와 예시는 `references/annotations.md`.

## 외부 데이터 (기본 `~/Documents/<프로젝트>-screen-spec/`)

### `requirements.json` (선택)

```json
[
  { "id": "REQ-1", "parentId": null, "number": "1", "title": "주문 관리", "status": "implemented" },
  { "id": "REQ-1.2", "parentId": "REQ-1", "number": "1.2", "title": "주문 취소",
    "text": "원문", "note": "부분 취소는 다음 단계", "status": "partial" }
]
```

- `id`는 영문·숫자·`_`·`.`·`-`만 쓴다(링크와 필터에 그대로 쓰인다).
- `parentId`로 트리를 만든다. 들여쓰기 깊이는 자동으로 계산한다. 순환·중복 id는 경고로 알린다.
- 배열 순서가 문서 순서다. 원문 순서대로 둔다.
- `status`를 생략하면 `unclassified`가 된다.

### `mapping.json` (선택)

```json
{
  "draft": true,
  "links": {
    "orders-cancel-confirm": [{ "req": "REQ-1.2", "rationale": "취소 확인 절차" }]
  }
}
```

- `rationale`이 비어 있으면 스키마 오류로 생성이 중단된다.

### `overrides.json` (선택)

```json
{ "orders-error": { "description": "시나리오를 고치지 않고 덮어쓸 설명" } }
```

## 검증 규칙

| 상황 | 결과 |
|---|---|
| 외부 파일·폴더가 없음 | 경고 없이 기본값으로 진행 (요구사항 기능을 안 쓰는 경우) |
| JSON 문법 오류, 스키마 오류 | 파일 경로와 위치를 출력하고 생성 중단 (종료 코드 1) |
| 없는 캡처·요구사항·부모를 가리킴 | 경고 (`report.json`의 `warnings`) |
| `sections`에 없는 section | 경고, 목차 맨 뒤로 |
| 표시 파일이 없는 캡처를 가리킴, crop·박스가 스샷 밖, name 중복 | 경고 |

## `report.json`

실행마다 갱신된다. 업데이트 모드가 입력으로 쓴다.

```json
{ "generatedAt": "...", "status": "passed", "entries": 42, "failures": [{ "title": "...", "file": "...", "line": 12, "error": "..." }], "warnings": [] }
```

`screen-spec:html`로 실행하면 직전 `failures`를 그대로 유지한다.
