import os from 'node:os'
import path from 'node:path'

/**
 * 프로젝트마다 고치는 유일한 설정 파일.
 * 나머지 support 파일은 수정하지 않고 그대로 쓴다.
 */

export interface SectionDef {
  readonly key: string
  readonly label: string
}

export type ClockMode = 'fixed' | 'flowing'

export interface ConsoleAllow {
  readonly pattern: RegExp
  readonly reason: string
}

const port = Number(process.env.SCREEN_SPEC_PORT ?? 5173)

export const SPEC = {
  /** 문서 제목 */
  title: '화면설계서',
  /** 생성물 위치 (gitignore 대상) */
  outDir: path.resolve(process.cwd(), process.env.SCREEN_SPEC_OUT_DIR ?? 'docs/screen-spec'),
  /** 사람이 고치는 외부 데이터 위치 (requirements.json, mapping.json, overrides.json) */
  sourceDir:
    process.env.SCREEN_SPEC_SOURCE_DIR ??
    path.join(os.homedir(), 'Documents', 'my-app-screen-spec'),

  /** dev 서버 */
  baseURL: process.env.SCREEN_SPEC_BASE_URL ?? `http://localhost:${port}`,
  webServerCommand: `pnpm dev --port ${port} --strictPort`,

  /** 목 API가 가로챌 요청 패턴 (page.route glob) */
  apiPattern: '**/api/**',

  /** 렌더링 고정값 */
  viewport: { width: 1440, height: 900 },
  locale: 'ko-KR',
  timezoneId: 'Asia/Seoul',
  /** 화면에 찍히는 "오늘". 비우면 실제 시각을 쓴다. */
  fixedTime: '2026-01-15T09:00:00+09:00',
  /**
   * 시계 방식
   * - 'fixed': 시각이 멈춘다. 날짜·시계 표시가 매번 같다.
   *   Date.now()로 애니메이션을 진행하는 라이브러리(Chart.js 등)는 0에서 멈춰 빈 차트가 찍힌다.
   * - 'flowing': fixedTime에서 시작해 실제처럼 흐른다. 차트·애니메이션이 있으면 이것을 쓴다.
   *   초 단위 시계 표시는 실행마다 조금 달라진다.
   * 테스트 하나만 바꾸려면 support/test.ts의 useFlowingClock(page)를 goto 전에 호출한다.
   */
  clockMode: 'fixed' as ClockMode,

  /** 다이얼로그 탐색 셀렉터 (UI 라이브러리에 맞게 조정) */
  dialogSelector: '[role="dialog"], [role="alertdialog"]',

  /** 무시할 콘솔 에러. 항목마다 이유를 적는다. */
  consoleAllow: [] as readonly ConsoleAllow[],

  /** 문서 목차 순서. 캡처의 section 값은 여기 key 중 하나여야 한다. */
  sections: [
    { key: 'main', label: '메인' },
  ] as readonly SectionDef[],
} as const
