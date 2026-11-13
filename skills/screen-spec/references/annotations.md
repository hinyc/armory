# 스샷에 박스 · 번호 표시

스샷 위에 빨간 박스, 번호 배지, 화살표를 그린 이미지를 만든다.

- 방식: 스샷을 깐 HTML에 표시를 절대 위치로 겹쳐 그리고, Chromium으로 그 화면을 PNG로 찍는다.
- 리포터가 문서를 만들기 직전에 그린다. `screen-spec`, `:only`, `:html` 어느 것을 돌려도 반영된다.
- 결과: `<OUT_DIR>/annotated/<이름>.png`.
- 입력(스샷·캡처 JSON·표시 파일)이 바뀐 것만 다시 그린다. 더는 쓰이지 않는 결과는 지운다.

## 언제 쓰나

| 쓸 때 | 쓰지 않을 때 |
|---|---|
| 한 화면에 영역이 많아 설명에서 "어디"를 가리켜야 할 때 (레이아웃 소개 화면) | 상태 캡처처럼 달라진 곳이 하나뿐이고 설명으로 충분할 때 |
| 사용자 매뉴얼·보고서에 넣을 번호 붙은 이미지가 필요할 때 | 장식용. 모든 캡처에 습관처럼 붙이지 않는다 |
| 작은 버튼·아이콘처럼 스샷에서 찾기 어려운 요소를 가리킬 때 | |

## 방법 1: 캡처할 때 요소로 지정 (기본)

좌표를 캡처할 때 재므로 화면이 바뀌어 다시 찍어도 표시가 따라간다. 문서의 캡처 이미지가 표시된 이미지로 바뀐다.

```ts
await captureScreen(page, testInfo, meta({ id: 'orders-list', kind: 'page', title: '주문 목록', description: '…' }), {
  marks: [
    { target: page.getByRole('navigation'), num: 1 },
    { target: page.getByRole('table'), num: 2 },
    { target: page.getByRole('button', { name: '내보내기' }), num: 3, badge: 'right' },
  ],
})

// 다이얼로그: 찾은 다이얼로그를 받아 그 안의 요소를 고른다
await captureDialog(page, testInfo, meta({ id: 'orders-cancel-confirm', kind: 'dialog', title: '주문 취소 확인' }), open, {
  marks: (dialog) => [{ target: dialog.getByRole('button', { name: '확인' }), num: 1, badge: 'br' }],
})
```

| 옵션 | 뜻 | 기본 |
|---|---|---|
| `target` | 표시할 요소 (Locator). 보이지 않으면 기다리다 실패한다 | 필수 |
| `num` | 배지에 쓸 숫자 또는 3자 이하 문자열. 어긋나면 그 캡처 테스트만 오류로 실패한다. 없으면 박스만 | 없음 |
| `badge` | 배지 위치: `tl` `tr` `bl` `br` `left` `right` `none` | `tl` |
| `color` | 박스·배지 색 | `#e5262b` |
| `pad` | 요소 바깥으로 넓힐 여백(px) | 4 |

- `target` 옵션으로 요소만 찍는 캡처(`component`)에서도 쓸 수 있다. 좌표는 그 요소 기준으로 잰다.
- 표시할 요소는 셀렉터를 먼저 정하고, 스샷 위치는 보지 않는다. 위치는 도구가 잰다.

## 방법 2: 좌표를 직접 적기 (잘라내기 · 화살표 · 매뉴얼용)

`e2e/screen-spec/annotations/*.json`에 쓴다. 파일 하나에 객체 하나 또는 배열을 둔다.

```json
[
  {
    "name": "orders-list-header",
    "capture": "orders-list",
    "crop": [0, 0, 900, 260],
    "withCaptureMarks": true,
    "marks": [{ "box": [20, 90, 320, 40], "num": 4 }],
    "arrows": [{ "from": [700, 220], "to": [560, 150] }]
  }
]
```

| 필드 | 뜻 |
|---|---|
| `name` | 결과 파일 이름 (kebab-case). **`capture`와 같으면 문서의 캡처 이미지도 이것으로 바뀐다** |
| `capture` | 바탕으로 쓸 캡처 id |
| `crop` | 잘라낼 영역 `[x, y, 너비, 높이]`. 없으면 전체 |
| `marks` | `{ box: [x, y, 너비, 높이], num?, badge?, color? }` |
| `arrows` | `{ from: [x, y], to: [x, y], color? }` |
| `withCaptureMarks` | true면 방법 1로 잰 표시도 함께 그린다 (잘라낸 이미지에 번호 유지) |

- 좌표는 모두 **원본 스샷 픽셀** 기준이다(잘라내기 전). 템플릿은 `deviceScaleFactor: 1`이라 화면 CSS 픽셀과 같다.
- 좌표 찾기
  - 정확하게: 시나리오에서 `await locator.boundingBox()`를 출력해 본다. 전체 페이지 캡처면 스크롤 위치를 더한다.
  - 눈으로: 스샷을 열어 대략 잡고, 결과 PNG를 보며 고친다.
- 직접 적은 좌표는 화면이 바뀌어도 따라가지 않는다. 업데이트 모드에서 `affected`의 `annotationsToCheck`에 나온 파일은 결과 이미지를 다시 열어 확인한다.
- 바깥으로 나간 crop·박스, 없는 캡처, 이름 중복은 생성 경고로 나온다. 형식이 틀리면 생성이 멈춘다.

## 그리는 규칙

- 번호는 읽는 순서(위→아래, 왼쪽→오른쪽)로 1부터 붙인다. 한 장에 7개를 넘기지 않는다. 많으면 영역을 묶거나 이미지를 나눈다.
- 박스끼리 겹치지 않게 한다. 배지가 중요한 글자를 가리면 `badge` 위치를 바꾼다.
- 색은 기본 빨강 하나로 통일한다. 의미가 다른 묶음이 있을 때만 두 번째 색을 쓴다.

## 설명에서 가리키기

- 배지 번호를 원문자로 가리킨다: `① 상단 메뉴: …`, `② 주문 표: …`.
- 번호 목록은 `page` 설명의 길이 기준(450자)을 넘기 쉽다. 영역별 자세한 동작은 해당 상태·다이얼로그 캡처로 넘기고(`[[id]]`), 여기서는 영역 이름과 한 줄 역할만 쓴다.

## 확인

- 테스트 통과만 믿지 않는다. `annotated/` 이미지를 직접 열어 번호·박스가 맞는 요소 위에 있는지, 잘린 곳이 없는지 본다.
- 모아 보기(`screen-spec:sheet`)는 원본 스샷을 보여준다. 표시는 `annotated/`를 따로 확인한다.
