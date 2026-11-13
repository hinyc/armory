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

/** SCREEN_SPEC_PORT: 1~65535 정수만. 비어 있거나 숫자가 아니면 조용히 넘기지 않고 멈춘다. */
function readPort(raw: string | undefined): number {
  if (raw === undefined) return 5173
  const port = /^[1-9]\d{0,4}$/.test(raw) ? Number(raw) : Number.NaN
  if (!(port >= 1 && port <= 65535)) {
    throw new Error(`SCREEN_SPEC_PORT는 1~65535 정수여야 합니다: "${raw}"`)
  }
  return port
}

/**
 * SCREEN_SPEC_OUT_DIR: 레포(cwd) 안의 하위 폴더만 허용. 이 폴더는 실행마다 지워지므로
 * 빈 값, `/`, cwd 자체, cwd 밖으로 풀리는 값은 조용히 넘기지 않고 멈춘다. 없으면 docs/screen-spec.
 */
function readOutDir(raw: string | undefined): string {
  if (raw === undefined) return path.resolve(process.cwd(), 'docs/screen-spec')
  const resolved = path.resolve(process.cwd(), raw)
  const rel = path.relative(process.cwd(), resolved)
  const inside = rel !== '' && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel)
  if (raw.trim() === '' || raw.trim() === '/' || !inside) {
    throw new Error(`SCREEN_SPEC_OUT_DIR는 레포 안의 하위 폴더여야 합니다: "${raw}"`)
  }
  return resolved
}

const port = readPort(process.env.SCREEN_SPEC_PORT)

/**
 * 이번 실행의 식별자. Playwright가 워커를 띄우기 전에 설정이 먼저 읽히므로, 환경변수에 넣어 두면
 * 모든 워커가 같은 값을 본다. 캡처 id 중복을 같은 실행 안에서만 검사하는 데 쓴다.
 */
process.env.SCREEN_SPEC_RUN_ID ??= `${Date.now()}-${process.pid}`
const runId = process.env.SCREEN_SPEC_RUN_ID

/** 기본 외부 데이터 폴더: ~/Documents/<프로젝트 폴더 이름>-screen-spec */
const projectName = path.basename(process.cwd()) || 'project'

export const SPEC = {
  /** 문서 제목 */
  title: '화면설계서',
  /** 생성물 위치 (gitignore 대상) */
  outDir: readOutDir(process.env.SCREEN_SPEC_OUT_DIR),
  /** 사람이 고치는 외부 데이터 위치 (requirements.json, mapping.json, overrides.json) */
  sourceDir:
    process.env.SCREEN_SPEC_SOURCE_DIR ??
    path.join(os.homedir(), 'Documents', `${projectName}-screen-spec`),

  /** 이번 실행의 식별자 (캡처 id 중복 검사용) */
  runId,

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
