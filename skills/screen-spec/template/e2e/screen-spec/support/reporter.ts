import fs from 'node:fs/promises'
import path from 'node:path'
import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter'
import { buildModel } from './model'
import { renderPage } from './render/page'
import { loadSources } from './sources'
import { SPEC } from './spec.config'

interface Failure {
  readonly title: string
  readonly file: string
  readonly line: number
  readonly error: string
}

interface ReporterOptions {
  /** HTML만 다시 만드는 실행이면 true. 이전 실패 목록을 그대로 둔다. */
  readonly htmlOnly?: boolean
}

const REPORT_FILE = path.join(SPEC.outDir, 'report.json')

interface PreviousRun {
  readonly status?: FullResult['status']
  readonly failures: readonly Failure[]
}

async function previousRun(): Promise<PreviousRun> {
  const raw = await fs.readFile(REPORT_FILE, 'utf8').catch(() => null)
  if (!raw) return { failures: [] }
  try {
    const parsed = JSON.parse(raw) as { status?: FullResult['status']; failures?: Failure[] }
    return { status: parsed.status, failures: parsed.failures ?? [] }
  } catch {
    return { failures: [] }
  }
}

/** 실행이 끝나면 캡처 결과로 index.html과 report.json을 만든다. 일부 테스트가 실패해도 만든다. */
export default class ScreenSpecReporter implements Reporter {
  private failures: readonly Failure[] = []

  constructor(private readonly options: ReporterOptions = {}) {}

  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status === 'passed' || result.status === 'skipped') return
    const failure: Failure = {
      title: test.titlePath().filter(Boolean).join(' › '),
      file: path.relative(process.cwd(), test.location.file),
      line: test.location.line,
      error: (result.error?.message ?? result.status).split('\n')[0],
    }
    this.failures = [...this.failures, failure]
  }

  async onEnd(result: FullResult): Promise<{ status: FullResult['status'] } | undefined> {
    try {
      const model = buildModel(await loadSources())
      // HTML만 다시 만들 때는 직전 캡처 실행의 결과(status·failures)를 그대로 둔다
      const previous = this.options.htmlOnly ? await previousRun() : undefined
      const failures = previous ? previous.failures : this.failures
      const status = previous?.status ?? result.status
      await fs.mkdir(SPEC.outDir, { recursive: true })
      await fs.writeFile(path.join(SPEC.outDir, 'index.html'), renderPage(model))
      const report = {
        generatedAt: model.generatedAt,
        status,
        entries: model.entryCount,
        failures,
        warnings: model.warnings,
      }
      await fs.writeFile(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`)
      process.stdout.write(
        `\n[screen-spec] 캡처 ${model.entryCount}개 → ${path.relative(process.cwd(), SPEC.outDir)}/index.html\n`,
      )
      model.warnings.forEach((warning) => process.stdout.write(`[screen-spec] 경고: ${warning}\n`))
      if (failures.length) process.stdout.write(`[screen-spec] 실패 ${failures.length}건 → report.json\n`)
      return undefined
    } catch (error) {
      process.stderr.write(`[screen-spec] 문서 생성 실패: ${(error as Error).message}\n`)
      return { status: 'failed' }
    }
  }
}
