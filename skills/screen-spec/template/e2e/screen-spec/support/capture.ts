import fs from 'node:fs/promises'
import path from 'node:path'
import { expect, type Locator, type Page, type TestInfo } from '@playwright/test'
import { SPEC } from './spec.config'
import { ID_PATTERN, type CaptureEntry, type CaptureMeta } from './types'

const captureCounts = new WeakMap<TestInfo, number>()

const pad = (value: number, width: number): string => String(value).padStart(width, '0')

function nextSortKey(testInfo: TestInfo): string {
  const index = captureCounts.get(testInfo) ?? 0
  captureCounts.set(testInfo, index + 1)
  const file = path.relative(process.cwd(), testInfo.file)
  return `${file}:${pad(testInfo.line, 5)}:${pad(index, 3)}`
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready.then(() => true))
}

async function assertUniqueId(dataFile: string, specFile: string, id: string): Promise<void> {
  const existing = await fs.readFile(dataFile, 'utf8').catch(() => null)
  if (existing === null) return
  const previous = JSON.parse(existing) as Pick<CaptureEntry, 'specFile'>
  if (previous.specFile !== specFile) {
    throw new Error(`캡처 id "${id}"가 ${previous.specFile}와 ${specFile}에서 중복됩니다`)
  }
}

interface CaptureOptions {
  /** 지정하면 이 요소만 찍는다 (kind: 'component'). 없으면 전체 페이지. */
  readonly target?: Locator
  readonly nativeDialog?: CaptureEntry['nativeDialog']
}

export async function captureScreen(
  page: Page,
  testInfo: TestInfo,
  meta: CaptureMeta,
  options: CaptureOptions = {},
): Promise<CaptureEntry> {
  if (!ID_PATTERN.test(meta.id)) throw new Error(`캡처 id는 kebab-case여야 합니다: "${meta.id}"`)

  const specFile = path.relative(process.cwd(), testInfo.file)
  const image = `shots/${meta.id}.png`
  const dataFile = path.join(SPEC.outDir, 'data', `${meta.id}.json`)
  await assertUniqueId(dataFile, specFile, meta.id)

  await settle(page)
  const shotPath = path.join(SPEC.outDir, image)
  const shotOptions = { path: shotPath, animations: 'disabled', caret: 'hide' } as const
  await (options.target
    ? options.target.screenshot(shotOptions)
    : page.screenshot({ ...shotOptions, fullPage: true }))

  const entry: CaptureEntry = {
    ...meta,
    source: meta.source ? [...meta.source] : undefined,
    image,
    sortKey: nextSortKey(testInfo),
    specFile,
    nativeDialog: options.nativeDialog,
  }
  await fs.mkdir(path.dirname(dataFile), { recursive: true })
  await fs.writeFile(dataFile, `${JSON.stringify(entry, null, 2)}\n`)
  return entry
}

interface DialogOptions {
  /** 여러 다이얼로그 중 이 텍스트를 가진 것을 찾는다. 없으면 마지막 다이얼로그. */
  readonly hasText?: string | RegExp
}

/** trigger로 다이얼로그를 연 뒤 전체 화면을 찍는다. 닫기는 호출한 쪽에서 한다. */
export async function captureDialog(
  page: Page,
  testInfo: TestInfo,
  meta: CaptureMeta,
  trigger: () => Promise<void>,
  options: DialogOptions = {},
): Promise<Locator> {
  await trigger()
  const all = page.locator(SPEC.dialogSelector)
  const dialog = (options.hasText ? all.filter({ hasText: options.hasText }) : all).last()
  await expect(dialog).toBeVisible()
  await captureScreen(page, testInfo, meta)
  return dialog
}

/**
 * 브라우저 기본 alert/confirm은 스크린샷에 찍히지 않고, 떠 있는 동안은 페이지를 찍을 수도 없다.
 * 메시지를 기록하고 수락한 **뒤의** 화면을 찍는다. 문서에서 그 위에 메시지를 덮어 그린다.
 * 수락하면 화면이 이동·변경되는 경우, 이동 요청을 막거나 kind를 'state'로 두고 설명에 적는다.
 */
export async function captureNativeDialog(
  page: Page,
  testInfo: TestInfo,
  meta: CaptureMeta,
  trigger: () => Promise<void>,
): Promise<CaptureEntry> {
  const [nativeDialog] = await Promise.all([
    page.waitForEvent('dialog').then(async (dialog) => {
      const info = { type: dialog.type(), message: dialog.message() }
      await dialog.accept()
      return info
    }),
    trigger(),
  ])
  return captureScreen(page, testInfo, meta, { nativeDialog })
}
