import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'
import { escapeHtml } from './render/escape'
import { SPEC } from './spec.config'
import { annotationSpecSchema, type AnnotationSpec, type Arrow, type CaptureEntry, type Mark } from './types'

/**
 * 스샷 위에 박스·번호 배지·화살표를 HTML로 겹쳐 그리고, 그 화면을 PNG로 찍는다.
 * - 캡처할 때 잰 marks → annotated/<id>.png (문서의 캡처 이미지도 이것으로 바뀐다)
 * - e2e/screen-spec/annotations/*.json → annotated/<name>.png (좌표 직접 지정, 잘라내기)
 */

export const ANNOTATIONS_DIR = path.resolve('e2e/screen-spec/annotations')
const OUT_SUBDIR = 'annotated'
const STYLE = { color: '#e5262b', stroke: 2, badge: 28 } as const

type Rect = readonly [number, number, number, number]

interface Job {
  readonly name: string
  readonly shot: string
  readonly crop?: Rect
  readonly marks: readonly Mark[]
  readonly arrows: readonly Arrow[]
  /** 이 파일들보다 결과가 새것이면 다시 그리지 않는다 */
  readonly inputs: readonly string[]
}

export interface AnnotationResult {
  /** 문서에서 캡처 이미지를 바꿀 것: 캡처 id → outDir 기준 경로 */
  readonly images: ReadonlyMap<string, string>
  readonly warnings: readonly string[]
}

function pngSize(buffer: Buffer): { readonly width: number; readonly height: number } {
  if (buffer.toString('ascii', 1, 4) !== 'PNG') throw new Error('PNG 파일이 아닙니다')
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

function badgeAt(mark: Mark, size: number): readonly [number, number] {
  const [x, y, w, h] = mark.box
  const r = size / 2
  switch (mark.badge ?? 'tl') {
    case 'tr': return [x + w - r, y - r]
    case 'bl': return [x - r, y + h - r]
    case 'br': return [x + w - r, y + h - r]
    case 'left': return [x - size - 6, y + h / 2 - r]
    case 'right': return [x + w + 6, y + h / 2 - r]
    default: return [x - r, y - r]
  }
}

function markHtml(mark: Mark, canvas: { readonly width: number; readonly height: number }): string {
  const color = escapeHtml(mark.color ?? STYLE.color)
  const [x, y, w, h] = mark.box
  // 잘라낸 영역과 겹치지 않는 표시는 그리지 않는다. 배지만 가장자리로 밀려 들어오는 것을 막는다.
  if (x + w <= 0 || y + h <= 0 || x >= canvas.width || y >= canvas.height) return ''
  const box = `<div class="box" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-color:${color}"></div>`
  if (mark.num === undefined || mark.badge === 'none') return box
  const [bx, by] = badgeAt(mark, STYLE.badge)
  const left = Math.min(Math.max(bx, 0), canvas.width - STYLE.badge)
  const top = Math.min(Math.max(by, 0), canvas.height - STYLE.badge)
  return `${box}<div class="badge" style="left:${left}px;top:${top}px;background:${color}">${escapeHtml(String(mark.num))}</div>`
}

function arrowsSvg(arrows: readonly Arrow[], width: number, height: number): string {
  if (arrows.length === 0) return ''
  const lines = arrows.map((arrow, i) => {
    const color = escapeHtml(arrow.color ?? STYLE.color)
    return `<marker id="h${i}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0L8,4L0,8z" fill="${color}"/></marker>
<line x1="${arrow.from[0]}" y1="${arrow.from[1]}" x2="${arrow.to[0]}" y2="${arrow.to[1]}" stroke="${color}" stroke-width="${STYLE.stroke}" marker-end="url(#h${i})"/>`
  })
  return `<svg width="${width}" height="${height}">${lines.join('')}</svg>`
}

/** 잘라낼 영역의 왼쪽 위가 (0,0)이 되도록 좌표를 옮긴다. */
function shift(job: Job, crop: Rect): { readonly marks: readonly Mark[]; readonly arrows: readonly Arrow[] } {
  const [cx, cy] = crop
  return {
    marks: job.marks.map((mark) => ({ ...mark, box: [mark.box[0] - cx, mark.box[1] - cy, mark.box[2], mark.box[3]] })),
    arrows: job.arrows.map((arrow) => ({
      ...arrow,
      from: [arrow.from[0] - cx, arrow.from[1] - cy],
      to: [arrow.to[0] - cx, arrow.to[1] - cy],
    })),
  }
}

export function overlayHtml(job: Job, shotSize: { readonly width: number; readonly height: number }): string {
  const crop = job.crop ?? [0, 0, shotSize.width, shotSize.height]
  const [cx, cy, width, height] = crop
  const { marks, arrows } = shift(job, crop)
  const canvas = { width, height }
  return `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;overflow:hidden;background:#fff}
.canvas{position:relative;width:${width}px;height:${height}px;overflow:hidden}
.canvas>img{position:absolute;left:${-cx}px;top:${-cy}px;width:${shotSize.width}px;height:${shotSize.height}px}
.box{position:absolute;box-sizing:border-box;border:${STYLE.stroke}px solid;border-radius:4px;box-shadow:0 0 0 1px #fff}
.badge{position:absolute;width:${STYLE.badge}px;height:${STYLE.badge}px;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font:700 ${Math.round(STYLE.badge * 0.55)}px/1 system-ui,sans-serif;box-shadow:0 0 0 2px #fff}
svg{position:absolute;left:0;top:0}
</style><div class="canvas"><img src="${pathToFileURL(job.shot).href}">${marks.map((mark) => markHtml(mark, canvas)).join('')}${arrowsSvg(arrows, width, height)}</div>`
}

function outsideWarnings(job: Job, size: { readonly width: number; readonly height: number }): readonly string[] {
  const [cx, cy, cw, ch] = job.crop ?? [0, 0, size.width, size.height]
  const inside = ([x, y, w, h]: Rect) => x >= cx && y >= cy && x + w <= cx + cw && y + h <= cy + ch
  const cropOk = cx >= 0 && cy >= 0 && cx + cw <= size.width && cy + ch <= size.height
  return [
    ...(cropOk ? [] : [`표시 ${job.name}: crop이 스샷(${size.width}x${size.height}) 밖으로 나감`]),
    ...job.marks.filter((mark) => !inside(mark.box)).map((mark) => `표시 ${job.name}: ${mark.num === undefined ? '번호 없는 박스' : `${mark.num}번 표시`}가 이미지 밖으로 나감 (밖에 있는 부분은 안 그림)`),
  ]
}

async function loadSpecs(): Promise<{ readonly specs: readonly (AnnotationSpec & { readonly file: string })[]; readonly warnings: readonly string[] }> {
  const names = (await fs.readdir(ANNOTATIONS_DIR).catch(() => [] as string[])).filter((name) => name.endsWith('.json')).sort()
  const parsed = await Promise.all(
    names.map(async (name) => {
      const file = path.join(ANNOTATIONS_DIR, name)
      let raw: unknown
      try {
        raw = JSON.parse(await fs.readFile(file, 'utf8'))
      } catch (error) {
        throw new Error(`${file}: JSON 형식 오류 — ${(error as Error).message}`)
      }
      const result = annotationSpecSchema.array().safeParse(Array.isArray(raw) ? raw : [raw])
      if (!result.success) {
        const issue = result.error.issues[0]
        throw new Error(`${file}: 표시 스키마 오류 — ${issue?.path.map(String).join('.') ?? ''}: ${issue?.message ?? ''}`)
      }
      return result.data.map((spec) => ({ ...spec, file }))
    }),
  )
  const specs = parsed.flat()
  const duplicates = specs.filter((spec, i) => specs.findIndex((other) => other.name === spec.name) !== i)
  return { specs, warnings: duplicates.map((spec) => `표시 name 중복: ${spec.name} (${spec.file})`) }
}

function buildJobs(entries: readonly CaptureEntry[], specs: readonly (AnnotationSpec & { readonly file: string })[]): { readonly jobs: readonly Job[]; readonly warnings: readonly string[] } {
  const byId = new Map(entries.map((entry) => [entry.id, entry]))
  const shotOf = (entry: CaptureEntry) => path.join(SPEC.outDir, entry.image)
  const dataOf = (entry: CaptureEntry) => path.join(SPEC.outDir, 'data', `${entry.id}.json`)
  const manualNames = new Set(specs.map((spec) => spec.name))
  const fromCaptures = entries
    .filter((entry) => entry.marks?.length && !manualNames.has(entry.id))
    .map((entry) => ({ name: entry.id, shot: shotOf(entry), marks: entry.marks ?? [], arrows: [], inputs: [shotOf(entry), dataOf(entry)] }))
  const missing = specs.filter((spec) => !byId.has(spec.capture))
  const fromSpecs = specs.flatMap((spec) => {
    const entry = byId.get(spec.capture)
    if (!entry) return []
    const marks = [...(spec.withCaptureMarks ? entry.marks ?? [] : []), ...spec.marks]
    return [{ name: spec.name, shot: shotOf(entry), crop: spec.crop, marks, arrows: spec.arrows, inputs: [shotOf(entry), dataOf(entry), spec.file] }]
  })
  return {
    jobs: [...fromCaptures, ...fromSpecs],
    warnings: missing.map((spec) => `표시 ${spec.name}: 캡처 ${spec.capture}가 없음 (${path.relative(process.cwd(), spec.file)})`),
  }
}

async function isFresh(out: string, inputs: readonly string[]): Promise<boolean> {
  const outTime = (await fs.stat(out).catch(() => null))?.mtimeMs
  if (outTime === undefined) return false
  const times = await Promise.all(inputs.map(async (file) => (await fs.stat(file).catch(() => null))?.mtimeMs ?? Infinity))
  return times.every((time) => time <= outTime)
}

async function removeStale(outDir: string, keep: ReadonlySet<string>): Promise<void> {
  const names = await fs.readdir(outDir).catch(() => [] as string[])
  await Promise.all(
    names.filter((name) => name.endsWith('.png') && !keep.has(name)).map((name) => fs.rm(path.join(outDir, name), { force: true })),
  )
}

async function readSize(file: string): Promise<{ readonly width: number; readonly height: number } | null> {
  const handle = await fs.open(file, 'r').catch(() => null)
  if (!handle) return null
  try {
    const { buffer } = await handle.read(Buffer.alloc(24), 0, 24, 0)
    return pngSize(buffer)
  } finally {
    await handle.close()
  }
}

async function checkJobs(jobs: readonly Job[]): Promise<readonly string[]> {
  const results = await Promise.all(
    jobs.map(async (job) => {
      const size = await readSize(job.shot)
      return size ? outsideWarnings(job, size) : [`표시 ${job.name}: 스샷이 없음 (${job.shot})`]
    }),
  )
  return results.flat()
}

async function renderJobs(jobs: readonly Job[], outDir: string): Promise<void> {
  const pending = (await Promise.all(jobs.map(async (job) => ((await isFresh(path.join(outDir, `${job.name}.png`), job.inputs)) ? null : job)))).filter(
    (job): job is Job => job !== null,
  )
  if (pending.length === 0) return
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 })
    for (const job of pending) {
      const size = await readSize(job.shot)
      if (!size) continue
      const [, , width, height] = job.crop ?? [0, 0, size.width, size.height]
      const htmlFile = path.join(outDir, `.${job.name}.html`)
      await fs.writeFile(htmlFile, overlayHtml(job, size))
      await page.setViewportSize({ width: Math.round(width), height: Math.round(height) })
      await page.goto(pathToFileURL(htmlFile).href)
      await page.waitForFunction(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0))
      await page.screenshot({ path: path.join(outDir, `${job.name}.png`), animations: 'disabled' })
      await fs.rm(htmlFile, { force: true })
    }
  } finally {
    await browser.close()
  }
}

/** 리포터가 문서를 만들기 전에 부른다. 바뀐 것만 다시 그리고, 쓰이지 않는 결과는 지운다. */
export async function renderAnnotations(entries: readonly CaptureEntry[]): Promise<AnnotationResult> {
  const outDir = path.join(SPEC.outDir, OUT_SUBDIR)
  const { specs, warnings: specWarnings } = await loadSpecs()
  const { jobs, warnings: jobWarnings } = buildJobs(entries, specs)
  await fs.mkdir(outDir, { recursive: true })
  await removeStale(outDir, new Set(jobs.map((job) => `${job.name}.png`)))
  const checkWarnings = await checkJobs(jobs)
  await renderJobs(jobs, outDir)
  const entryIds = new Set(entries.map((entry) => entry.id))
  const images = new Map(
    jobs.filter((job) => entryIds.has(job.name)).map((job) => [job.name, `${OUT_SUBDIR}/${job.name}.png`] as const),
  )
  return { images, warnings: [...specWarnings, ...jobWarnings, ...checkWarnings] }
}
