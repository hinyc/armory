import { defineConfig, devices } from '@playwright/test'
import { SPEC } from './e2e/screen-spec/support/spec.config'

/** 화면설계서 캡처 실행. 회귀 테스트 설정(playwright.config.ts)과 분리한다. */
export default defineConfig({
  testDir: './e2e/screen-spec',
  testMatch: /.*\.screen\.ts$/,
  fullyParallel: true,
  retries: 0,
  // 전체 실행 첫 순간에는 dev 서버가 화면 코드를 처음 컴파일해서 느리다. 기본 5초로는 부족하다.
  expect: { timeout: 15_000 },
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
    // dev 서버가 브라우저 콘솔을 다시 찍어 로그가 지저분해진다. 오류만 보인다.
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
