/**
 * 예시 시나리오. 실제 프로젝트에서는 화면 묶음마다 <area>.screen.ts를 하나씩 만든다.
 * 목데이터 빌더가 커지면 fixtures/<area>.ts로 뺀다.
 */
import { captureDialog, captureNativeDialog, captureScreen } from './support/capture'
import { createGate, json } from './support/mockApi'
import { expect, test } from './support/test'
import type { CaptureMeta } from './support/types'

/** 화면 공통 정보는 한 번만 쓴다. */
const meta = (extra: Pick<CaptureMeta, 'id' | 'kind' | 'title'> & Partial<CaptureMeta>): CaptureMeta => ({
  section: 'main',
  screen: '주문 목록',
  route: '/orders',
  source: ['src/pages/OrderList.tsx'],
  ...extra,
})

const buildOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 1001,
  customer: '김하늘',
  total: 32000,
  status: 'paid',
  ...overrides,
})

interface Order {
  readonly id: number
  readonly customer: string
  readonly total: number
  readonly status: 'paid' | 'shipped' | 'cancelled'
}

const ORDERS: readonly Order[] = [
  buildOrder(),
  buildOrder({ id: 1002, customer: '이도윤', total: 15800, status: 'shipped' }),
  buildOrder({ id: 1003, customer: '박서연', total: 7400, status: 'cancelled' }),
]

test('주문 목록 기본·로딩·빈 상태', async ({ page, mockApi }, testInfo) => {
  const gate = createGate(json({ items: ORDERS }))
  mockApi.register({ 'GET /api/orders': gate.handler })
  await page.goto('/orders')
  await expect(page.getByText('불러오는 중')).toBeVisible()
  await captureScreen(page, testInfo, meta({ id: 'orders-loading', kind: 'state', title: '주문 목록 (로딩 중)' }))

  gate.release()
  await expect(page.getByRole('row')).toHaveCount(ORDERS.length + 1)
  await captureScreen(
    page,
    testInfo,
    meta({
      id: 'orders-list',
      kind: 'page',
      title: '주문 목록',
      description:
        '사이드 메뉴 "주문"을 누르면 열린다. 최근 주문이 최신순으로 보인다.\n\n상태 색: 초록=결제 완료, 파랑=배송 중, 회색=취소. 행을 누르면 [[orders-cancel-confirm|취소 확인]] 흐름으로 이어진다.',
    }),
  )
})

test('주문 목록 빈 상태·오류', async ({ page, mockApi }, testInfo) => {
  mockApi.register({ 'GET /api/orders': json({ items: [] }) })
  await page.goto('/orders')
  await expect(page.getByText('주문이 없습니다')).toBeVisible()
  await captureScreen(page, testInfo, meta({ id: 'orders-empty', kind: 'state', title: '주문 목록 (주문 0건)' }))

  mockApi.register({ 'GET /api/orders': json({ error: 'internal' }, 500) })
  await page.reload()
  await expect(page.getByRole('alert')).toBeVisible()
  await captureScreen(page, testInfo, meta({ id: 'orders-error', kind: 'state', title: '주문 목록 (조회 실패)' }))
})

test('주문 취소', async ({ page, mockApi }, testInfo) => {
  mockApi.register({
    'GET /api/orders': json({ items: ORDERS }),
    'POST /api/orders/:id/cancel': json({ ok: true }),
  })
  await page.goto('/orders')
  const dialog = await captureDialog(
    page,
    testInfo,
    meta({ id: 'orders-cancel-confirm', kind: 'dialog', title: '주문 취소 확인' }),
    () => page.getByRole('button', { name: '취소' }).first().click(),
  )
  await captureNativeDialog(
    page,
    testInfo,
    meta({ id: 'orders-cancel-done', kind: 'alert', title: '주문 취소 완료 알림' }),
    () => dialog.getByRole('button', { name: '확인' }).click(),
  )
})
