import { defineConfig, devices } from '@playwright/test'
import { SPEC } from './e2e/screen-spec/support/spec.config'

/** 화면설계서 캡처 실행. 회귀 테스트 설정(playwright.config.ts)과 분리한다. */
export default defineConfig({
  testDir: './e2e/screen-spec',
  testMatch: /.*\.screen\.ts$/,
  fullyParallel: true,
  retries: 0,
  reporter: [['list'], ['./e2e/screen-spec/support/reporter.ts']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: SPEC.baseURL,
    viewport: SPEC.viewport,
    deviceScaleFactor: 1,
    locale: SPEC.locale,
    timezoneId: SPEC.timezoneId,
    colorScheme: 'light',
    contextOptions: { reducedMotion: 'reduce' },
    launchOptions: { args: ['--font-render-hinting=none'] },
    // 로그인이 필요하면 setup 프로젝트에서 만든 storageState를 지정한다.
    // storageState: 'e2e/screen-spec/.auth/state.json',
  },
  webServer: {
    command: SPEC.webServerCommand,
    url: SPEC.baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
