import type { Page, Route } from '@playwright/test'

export interface MockResponse {
  readonly status?: number
  readonly body?: unknown
  readonly headers?: Readonly<Record<string, string>>
}

export type MockHandler = MockResponse | ((route: Route) => Promise<void>)

/** 키 형식: "METHOD /path". 경로에 `:name` 자리표시를 쓸 수 있다 (예: "GET /api/orders/:id"). */
export type MockTable = Readonly<Record<string, MockHandler>>

export interface MockApi {
  /** 핸들러를 추가한다. 같은 키는 나중에 등록한 것이 이긴다. */
  register(table: MockTable): void
  /** 등록되지 않아 501로 응답한 요청 목록 */
  unmatched(): readonly string[]
}

export const json = (body: unknown, status = 200): MockResponse => ({ status, body })

export function fulfill(route: Route, response: MockResponse): Promise<void> {
  const hasBody = response.body !== undefined
  return route.fulfill({
    status: response.status ?? 200,
    headers: { ...(hasBody ? { 'content-type': 'application/json' } : {}), ...response.headers },
    body: hasBody ? JSON.stringify(response.body) : '',
  })
}

/** 응답을 붙잡아 두는 핸들러. 로딩 상태를 찍은 뒤 release()로 응답을 보낸다. */
export function createGate(response: MockResponse): {
  readonly handler: (route: Route) => Promise<void>
  readonly release: () => void
} {
  let open: () => void = () => undefined
  const opened = new Promise<void>((resolve) => {
    open = resolve
  })
  return {
    handler: async (route) => {
      await opened
      await fulfill(route, response)
    },
    release: () => open(),
  }
}

/** 지정한 시간만큼 늦게 응답한다. 진행 중 표시를 잠깐 보여줄 때 쓴다. */
export function delayed(response: MockResponse, ms: number): (route: Route) => Promise<void> {
  return async (route) => {
    await new Promise((resolve) => setTimeout(resolve, ms))
    await fulfill(route, response)
  }
}

/** "get /api/주문/" → "GET /api/주문": 메서드 대문자, 끝 슬래시 제거, 퍼센트 인코딩 해제 */
export function normalizeKey(key: string): string {
  const [method = '', rawPath = ''] = key.trim().split(/\s+/)
  let decoded = rawPath
  try {
    decoded = decodeURIComponent(rawPath)
  } catch {
    decoded = rawPath
  }
  const path = decoded.length > 1 ? decoded.replace(/\/+$/, '') : decoded
  return `${method.toUpperCase()} ${path}`
}

function matchesPattern(pattern: string, key: string): boolean {
  const [pMethod, pPath = ''] = pattern.split(' ')
  const [kMethod, kPath = ''] = key.split(' ')
  if (pMethod !== kMethod) return false
  const pSegs = pPath.split('/')
  const kSegs = kPath.split('/')
  return (
    pSegs.length === kSegs.length &&
    pSegs.every((seg, i) => (seg.startsWith(':') ? kSegs[i] !== '' : seg === kSegs[i]))
  )
}

export function findHandler(table: MockTable, key: string): MockHandler | undefined {
  const normalized = normalizeKey(key)
  const entries = Object.entries(table).map(([pattern, handler]) => [normalizeKey(pattern), handler] as const)
  const exact = entries.filter(([pattern]) => pattern === normalized).at(-1)
  if (exact) return exact[1]
  // :param 패턴이 여러 개 맞으면 나중에 등록한 것이 이긴다
  const param = entries.filter(([pattern]) => pattern.includes('/:') && matchesPattern(pattern, normalized)).at(-1)
  return param?.[1]
}

/** dev 서버의 모듈·자원 요청(/src/api/*.ts 등)은 목 대상이 아니다. */
const API_RESOURCE_TYPES = new Set(['fetch', 'xhr'])

export async function installMockApi(page: Page, apiPattern: string): Promise<MockApi> {
  let table: MockTable = {}
  let misses: readonly string[] = []

  await page.route(apiPattern, async (route) => {
    const request = route.request()
    if (!API_RESOURCE_TYPES.has(request.resourceType())) {
      await route.fallback()
      return
    }
    const key = `${request.method()} ${new URL(request.url()).pathname}`
    const handler = findHandler(table, key)
    if (!handler) {
      misses = [...misses, key]
      await fulfill(route, json({ error: `unmocked: ${key}` }, 501))
      return
    }
    await (typeof handler === 'function' ? handler(route) : fulfill(route, handler))
  })

  return {
    register: (next) => {
      // 키를 정규화해 "get /api/x/"와 "GET /api/x"를 같은 키로 본다.
      // 다시 등록한 키는 뒤로 옮겨 나중에 등록한 것이 이기게 한다 (findHandler는 뒤쪽을 우선한다).
      const normalized = Object.fromEntries(Object.entries(next).map(([key, handler]) => [normalizeKey(key), handler]))
      const kept = Object.entries(table).filter(([key]) => !Object.hasOwn(normalized, key))
      table = { ...Object.fromEntries(kept), ...normalized }
    },
    unmatched: () => misses,
  }
}
