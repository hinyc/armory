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
- 열리는 애니메이션은 `reducedMotion`과 `animations: 'disabled'`로 대부분 꺼진다.

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
```

## 컴포넌트만 찍기

```ts
await captureScreen(page, testInfo, meta({ id: 'order-status-badge', kind: 'component', title: '주문 상태 배지' }), {
  target: page.getByTestId('status-legend'),
})
```

## 화면 이동 막기

버튼을 눌렀을 때 다음 화면으로 넘어가면 배경이 바뀐다. 이동 요청을 막아 현재 화면을 유지한다.

```ts
await page.route('**/orders/*/detail', (route) => route.abort('aborted'))
```

## 시간 · 주기 갱신

- `spec.config.ts`의 `fixedTime`으로 `Date`가 고정된다. "오늘", "n분 전" 표시가 매번 같다.
- 타이머(`setInterval` 폴링)는 그대로 돈다. 폴링 결과를 찍으려면 두 번째 응답을 등록하고 화면 변화를 기다린다.
- 시간 흐름 자체를 제어해야 하면 해당 테스트에서 `page.clock.install()`과 `runFor()`를 쓴다.

## 차트 · 캔버스

조건으로 기다릴 수 없으면 짧게 고정 대기를 쓰고 이유를 적는다.

```ts
// 차트 진입 애니메이션(약 600ms)이 끝나야 막대 높이가 확정된다
await page.waitForTimeout(800)
```

## 권한별 화면

역할마다 메뉴가 다르면 사용자 정보 API 응답을 바꿔 등록하고, 역할을 title에 쓴다: `주문 목록 (조회 전용 권한)`.

## 기다리는 조건 고르기

| 상황 | 기다리는 방법 |
|---|---|
| 목록 데이터 | `expect(rows).toHaveCount(n)` |
| 특정 문구 | `expect(page.getByText(...)).toBeVisible()` |
| 요청이 나갔는지 | `page.waitForResponse((r) => r.url().includes('/api/x'))` |
| 사라질 때까지 | `expect(spinner).toBeHidden()` |
