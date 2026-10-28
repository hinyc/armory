import { defineConfig } from '@playwright/test'

/**
 * 캡처 없이 HTML만 다시 만든다. 테스트도 dev 서버도 실행하지 않는다.
 * overrides.json·mapping.json을 고친 뒤 쓴다.
 * 실행: playwright test -c playwright.screen-spec-html.config.ts --pass-with-no-tests
 */
export default defineConfig({
  testDir: './e2e/screen-spec',
  testMatch: /^$/,
  reporter: [['./e2e/screen-spec/support/reporter.ts', { htmlOnly: true }]],
})
