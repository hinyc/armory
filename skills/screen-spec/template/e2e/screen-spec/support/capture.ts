import fs from 'node:fs/promises'
import path from 'node:path'
import { expect, type Locator, type Page, type TestInfo } from '@playwright/test'
import { SPEC } from './spec.config'
import { ID_PATTERN, markSchema, type BadgePosition, type CaptureEntry, type CaptureMeta, type Mark } from './types'

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

const usedIds = new WeakMap<TestInfo, Set<string>>()

/**
 * 같은 실행 안에서 캡처 id가 겹치면 오류. 이전 실행의 파일이나 재시도(retry)는 겹침이 아니다.
 * 워커가 달라도 잡도록, 이번 실행(SPEC.runId) 전용 폴더에 id별 표식 파일을 만든다.
 * 표식에는 처음 쓴 테스트의 id를 적는다. 같은 테스트의 재시도는 통과, 다른 테스트면 중복이다.
 */
async function assertUniqueId(testInfo: TestInfo, id: string): Promise<void> {
  const seen = usedIds.get(testInfo) ?? new Set<string>()
  if (seen.has(id)) throw new Error(`캡처 id "${id}"가 같은 테스트 "${testInfo.title}"에서 두 번 쓰였습니다`)
  usedIds.set(testInfo, new Set([...seen, id]))

  const dir = path.join(SPEC.outDir, '.run', SPEC.runId)
  const marker = path.join(dir, id)
  await fs.mkdir(dir, { recursive: true })
  const owner = `${testInfo.testId}\n${path.relative(process.cwd(), testInfo.file)}:${testInfo.line} ${testInfo.title}`
  try {
    await fs.writeFile(marker, owner, { flag: 'wx' })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    const [ownerId = '', ownerName = '다른 테스트'] = (await fs.readFile(marker, 'utf8')).split('\n')
    if (ownerId !== testInfo.testId) {
      throw new Error(`캡처 id "${id}"가 ${ownerName}와 ${path.relative(process.cwd(), testInfo.file)}:${testInfo.line} ${testInfo.title}에서 중복됩니다`)
    }
  }
}

/** 표시 값이 문서 스키마에 맞는지 캡처 시점에 확인한다. 어긋나면 어느 캡처의 몇 번째 표시인지 알려 준다. */
function assertValidMarks(id: string, marks: readonly Mark[]): void {
  marks.forEach((mark, index) => {
    const result = markSchema.safeParse(mark)
    if (result.success) return
    const issue = result.error.issues[0]
    const where = issue?.path.map(String).join('.') ?? ''
    throw new Error(`캡처 "${id}"의 marks[${index}] ${where}: ${issue?.message ?? '형식 오류'} (num은 숫자 또는 3자 이하 문자열)`)
  })
}

/** 스샷 위에 박스·번호로 표시할 요소. 좌표는 캡처할 때 재므로 화면이 바뀌어도 따라간다. */
export interface MarkTarget {
  readonly target: Locator
  readonly num?: number | string
  readonly badge?: BadgePosition
  readonly color?: string
  /** 요소 바깥으로 넓힐 여백(px). 기본 4. */
  readonly pad?: number
}

interface CaptureOptions {
  /** 지정하면 이 요소만 찍는다 (kind: 'component'). 없으면 전체 페이지. */
  readonly target?: Locator
  readonly nativeDialog?: CaptureEntry['nativeDialog']
  /** 표시할 요소. 리포터가 annotated/<id>.png를 그려 문서에 넣는다. */
  readonly marks?: readonly MarkTarget[]
}

interface Origin {
  readonly x: number
  readonly y: number
}

/** 스샷의 (0,0)이 화면 좌표로 어디인지. 전체 페이지면 스크롤만큼, 요소 캡처면 그 요소의 왼쪽 위. */
async function shotOrigin(page: Page, target?: Locator): Promise<Origin> {
  if (!target) return page.evaluate(() => ({ x: -window.scrollX, y: -window.scrollY }))
  const box = await target.boundingBox()
  if (!box) throw new Error('캡처 대상 요소의 위치를 잴 수 없습니다')
  return { x: box.x, y: box.y }
}

async function measureMarks(page: Page, marks: readonly MarkTarget[], target?: Locator): Promise<Mark[]> {
  const origin = await shotOrigin(page, target)
  return Promise.all(
    marks.map(async (mark, index) => {
      await mark.target.waitFor({ state: 'visible' })
      const box = await mark.target.boundingBox()
      if (!box) throw new Error(`표시할 요소의 위치를 잴 수 없습니다 (marks[${index}])`)
      const pad = mark.pad ?? 4
      return {
        box: [
          Math.round(box.x - origin.x - pad),
          Math.round(box.y - origin.y - pad),
          Math.round(box.width + pad * 2),
          Math.round(box.height + pad * 2),
        ] as [number, number, number, number],
        num: mark.num,
        badge: mark.badge,
        color: mark.color,
      }
    }),
  )
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
  await assertUniqueId(testInfo, meta.id)

  await settle(page)
  // 찍기 전에 잰다. 전체 페이지 스샷은 찍는 동안 스크롤 위치가 바뀔 수 있다.
  const marks = options.marks?.length ? await measureMarks(page, options.marks, options.target) : undefined
  if (marks) assertValidMarks(meta.id, marks)
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
    marks,
  }
  await fs.mkdir(path.dirname(dataFile), { recursive: true })
  await fs.writeFile(dataFile, `${JSON.stringify(entry, null, 2)}\n`)
  return entry
}

interface DialogOptions {
  /** 여러 다이얼로그 중 이 텍스트를 가진 것을 찾는다. 없으면 마지막 다이얼로그. */
  readonly hasText?: string | RegExp
  /** 다이얼로그 안의 표시할 요소. 찾은 다이얼로그를 받아 만든다. */
  readonly marks?: (dialog: Locator) => readonly MarkTarget[]
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
  await captureScreen(page, testInfo, meta, { marks: options.marks?.(dialog) })
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
