import { test as base, expect, type Page } from '@playwright/test'
import { installMockApi, type MockApi } from './mockApi'
import { SPEC } from './spec.config'

interface Fixtures {
  /** 모든 테스트에 자동 적용. 등록하지 않은 API 호출이 있으면 테스트가 실패한다. */
  readonly mockApi: MockApi
  /** 모든 테스트에 자동 적용. 페이지 에러·콘솔 에러가 있으면 테스트가 실패한다. */
  readonly pageGuard: void
}

/** 오류 응답을 일부러 목으로 줄 때 브라우저가 남기는 네트워크 로그. 미등록 호출은 mockApi가 따로 잡는다. */
const BUILT_IN_ALLOW = [/^Failed to load resource: /]

function isAllowed(text: string): boolean {
  return (
    BUILT_IN_ALLOW.some((pattern) => pattern.test(text)) ||
    SPEC.consoleAllow.some(({ pattern }) => pattern.test(text))
  )
}

function collectErrors(page: Page): () => readonly string[] {
  let errors: readonly string[] = []
  page.on('pageerror', (error) => {
    errors = [...errors, `pageerror: ${error.message}`]
  })
  page.on('console', (message) => {
    if (message.type() === 'error' && !isAllowed(message.text())) {
      errors = [...errors, `console.error: ${message.text()}`]
    }
  })
  return () => errors
}

export const test = base.extend<Fixtures>({
  mockApi: [
    async ({ page }, use) => {
      if (SPEC.fixedTime) await page.clock.setFixedTime(new Date(SPEC.fixedTime))
      const api = await installMockApi(page, SPEC.apiPattern)
      await use(api)
      expect(api.unmatched(), '목을 등록하지 않은 API 호출').toEqual([])
    },
    { auto: true },
  ],
  pageGuard: [
    async ({ page }, use) => {
      const errors = collectErrors(page)
      await use()
      expect(errors(), '페이지 에러 또는 콘솔 에러').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
