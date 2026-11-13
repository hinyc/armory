# 상태 재현 레시피

모든 시나리오는 `./support/test`의 `test`를 쓴다. 이 `test`는 목 API, 에러 감시, 시간 고정을 자동으로 켠다.

## 기본 화면

```ts
test('주문 목록', async ({ page, mockApi }, testInfo) => {
  mockApi.register({ 'GET /api/orders': json({ items: [buildOrder()] }) })
  await page.goto('/orders')
  await expect(page.getByRole('row')).toHaveCount(2) // 데이터가 그려질 때까지 기다린다
  await captureScreen(page, testInfo, meta({ id: 'orders-list', kind: 'page', title: '주문 목록' }))
})
```

- 키는 `"METHOD /경로"`이고, 쿼리스트링은 무시한다. 경로 변수는 `:id`처럼 쓴다.
- 메서드 대소문자, 끝 슬래시, 퍼센트 인코딩(한글 경로)은 맞춰서 비교한다.
- `fetch`·`xhr` 요청만 가로챈다. dev 서버의 모듈 요청(`/src/api/*.ts`)은 그대로 통과한다.
- 같은 키를 다시 등록하면 나중 것이 이긴다. 한 테스트 안에서 상태를 바꿀 때 쓴다.
- 겹치는 `:param` 패턴(`/orders/:id`와 `/orders/:no`)도 나중 등록이 이긴다.
- 요청 본문이나 쿼리에 따라 응답이 달라야 하면 함수 핸들러를 쓴다.

```ts
mockApi.register({
  'GET /api/orders': async (route) => {
    const status = new URL(route.request().url()).searchParams.get('status')
    await fulfill(route, json({ items: ORDERS.filter((o) => !status || o.status === status) }))
  },
})
```

## 로딩

응답을 붙잡아 두는 gate를 쓴다.

```ts
const gate = createGate(json({ items: ORDERS }))
mockApi.register({ 'GET /api/orders': gate.handler })
await page.goto('/orders')
await expect(page.getByText('불러오는 중')).toBeVisible()
await captureScreen(/* kind: 'state', title: '… (로딩 중)' */)
gate.release()
```

- 진행 표시를 잠깐만 보여주면 될 때는 `delayed(response, ms)`를 쓴다.

## 빈 상태 · 오류

```ts
mockApi.register({ 'GET /api/orders': json({ items: [] }) })        // 빈 상태
mockApi.register({ 'GET /api/orders': json({ error: 'x' }, 500) })  // 서버 오류
mockApi.register({ 'GET /api/orders': json({}, 403) })              // 권한 없음
```

- 오류 응답 때 브라우저가 남기는 `Failed to load resource` 로그는 기본으로 무시한다. 그래서 이미지·청크 404도 이 로그로는 잡히지 않는다. 스샷에서 깨진 이미지를 직접 확인한다.
- 앱이 직접 `console.error`를 찍으면 실패로 잡힌다. 의도한 동작이면 `consoleAllow`에 이유와 함께 넣는다.

## 다이얼로그

```ts
const dialog = await captureDialog(page, testInfo, meta({ id: 'order-cancel', kind: 'dialog', title: '주문 취소 확인' }),
  () => page.getByRole('button', { name: '취소' }).first().click(),
  { hasText: '취소할까요' }, // 다이얼로그가 여러 개일 때
)
await dialog.getByRole('button', { name: '닫기' }).click()
```

- 다이얼로그 DOM이 `role="dialog"`가 아니면 `spec.config.ts`의 `dialogSelector`를 바꾼다.
- **여러 다이얼로그가 겹쳐 뜨는 앱**(공용 안내창·확인창·인증창이 따로 있는 경우)에서는 `hasText`를 항상 넘긴다. 빼면 마지막 다이얼로그를 잡아서 엉뚱한 창을 기다릴 수 있다.
- 돌려받은 locator는 `hasText`로 걸러져 있어서, **창의 본문이 바뀌면(입력 → 완료) 더는 맞지 않는다.** 본문이 바뀌는 창은 `hasText`에 바뀌지 않는 문구(창 제목)를 넘기거나, 다음 단계에서 `page.locator(SPEC.dialogSelector).filter({ hasText: '새 문구' })`로 다시 찾는다.
- 열리는 애니메이션은 `reducedMotion`과 `animations: 'disabled'`로 대부분 꺼진다.
- kind: 입력·선택을 받는 창은 `dialog`, 메시지만 알리는 창(앱이 그린 안내창 포함)은 `alert`.

## 브라우저 기본 alert / confirm

스크린샷에 찍히지 않고, 떠 있는 동안은 페이지를 찍을 수도 없다. `captureNativeDialog`는 메시지를 기록하고 **수락한 뒤의 화면**을 찍는다. 문서에서 그 위에 메시지를 덮어 그린다(confirm이면 "취소" 버튼도 그린다).

- 수락하면 화면이 이동하거나 목록이 바뀌면 배경이 달라진다. 이동 요청을 막거나(아래 "화면 이동 막기"), 설명에 "확인 후 화면"이라고 적는다.

```ts
await captureNativeDialog(page, testInfo, meta({ id: 'order-cancel-done', kind: 'alert', title: '취소 완료 알림' }),
  () => dialog.getByRole('button', { name: '확인' }).click(),
)
```

## 드롭다운 · 툴팁 · 메뉴 펼침

```ts
await page.getByRole('combobox', { name: '상태' }).click()
await expect(page.getByRole('option', { name: '배송 중' })).toBeVisible()
await captureScreen(/* kind: 'state' */)

// 선택한 뒤의 결과 화면도 찍는다 (드릴다운). 재조회 응답을 등록하고 바뀐 화면을 기다린다.
mockApi.register({ 'GET /api/orders': json({ items: SHIPPED_ORDERS }) })
await page.getByRole('option', { name: '배송 중' }).click()
await expect(page.getByRole('row')).toHaveCount(SHIPPED_ORDERS.length + 1)
await captureScreen(/* kind: 'state', title: '주문 목록 (배송 중 필터)' */)
```

- 캔버스 차트 툴팁은 마우스를 치워도 남는 경우가 많다. 툴팁 캡처는 테스트를 따로 둔다.

## 컴포넌트만 찍기

```ts
await captureScreen(page, testInfo, meta({ id: 'order-status-badge', kind: 'component', title: '주문 상태 배지' }), {
  target: page.getByTestId('status-legend'),
})
```

## 영역에 박스 · 번호 표시

`captureScreen`의 `marks`에 표시할 요소를 넘긴다. 좌표는 캡처할 때 잰다. 자세한 내용은 `annotations.md`.

```ts
await captureScreen(page, testInfo, meta({ id: 'home-layout', kind: 'page', title: '홈' }), {
  marks: [
    { target: page.getByRole('banner'), num: 1 },
    { target: page.getByRole('main'), num: 2 },
  ],
})
```

## 화면 이동 막기

버튼을 눌렀을 때 다음 화면으로 넘어가면 배경이 바뀐다. 이동 요청을 막아 현재 화면을 유지한다.

```ts
await page.route('**/orders/*/detail', (route) => route.abort('aborted'))
```

## 시간 · 주기 갱신

`spec.config.ts`의 `clockMode`가 시계를 정한다.

| clockMode | 동작 | 맞는 경우 |
|---|---|---|
| `fixed` | `fixedTime`에서 시각이 멈춘다 | 날짜·시계 표시가 매번 같아야 하고 애니메이션이 없을 때 |
| `flowing` | `fixedTime`에서 시작해 흐른다 | 차트·애니메이션이 있을 때 (초 단위 시계는 실행마다 조금 다름) |

- `fixed`인 프로젝트에서 차트 화면만 흐르게 하려면 `page.goto` 전에 `await useFlowingClock(page)`를 호출한다 (`./support/test`).
- 타이머(`setInterval` 폴링)는 두 방식 모두 돈다. 폴링 결과를 찍으려면 두 번째 응답을 등록하고 화면 변화를 기다린다.
- 폴링이 차트를 다시 그리면, 다음 주기 전에 캡처가 끝나야 애니메이션 중간이 찍히지 않는다. 주기가 짧으면 해당 테스트에서 폴링 응답을 gate로 붙잡는다.

## 차트 · 캔버스

- **`fixed` 시계에서는 Chart.js 같은 라이브러리가 0에서 멈춰 빈 차트가 찍힌다.** 테스트는 통과하므로 모아 보기 이미지로 꼭 확인한다. 위 표대로 `flowing`을 쓴다.
- 시계가 흐르면 애니메이션이 끝날 때까지만 기다린다. 조건으로 기다릴 수 없으면 짧은 고정 대기를 쓰고 이유를 적는다.

```ts
await useFlowingClock(page) // clockMode가 'fixed'일 때만 필요
await page.goto('/stats')
// 차트 진입 애니메이션(기본 1초)이 끝나야 막대 높이가 확정된다
await page.waitForTimeout(1200)
```

## 인증 우회

| 인증 상태 저장 위치 | 방법 |
|---|---|
| 쿠키, localStorage | setup 프로젝트에서 로그인 후 `storageState` 저장, 설정의 `use.storageState`로 지정 |
| sessionStorage | `storageState`에 담기지 않는다. `page.addInitScript`로 페이지 로드 전에 심는다 |
| 서버 세션만 | 로그인 API·사용자 정보 API를 목으로 응답 |

```ts
// fixtures/common.ts
export async function signIn(page: Page, role: string): Promise<void> {
  await page.addInitScript((value) => {
    sessionStorage.setItem('auth', value)
  }, JSON.stringify({ state: { signedIn: true, role } }))
}
```

- 역할마다 화면이 다르면 역할을 인자로 받아 테스트마다 다르게 심는다.

## 권한별 화면

역할마다 메뉴가 다르면 인증 정보나 사용자 정보 API 응답을 바꿔 등록하고, 역할을 title에 쓴다: `주문 목록 (조회 전용 권한)`.

## 기다리는 조건 고르기

| 상황 | 기다리는 방법 |
|---|---|
| 목록 데이터 | `expect(rows).toHaveCount(n)` |
| 특정 문구 | `expect(page.getByText(...)).toBeVisible()` |
| 요청이 나갔는지 | `page.waitForResponse((r) => r.url().includes('/api/x'))` |
| 사라질 때까지 | `expect(spinner).toBeHidden()` |
