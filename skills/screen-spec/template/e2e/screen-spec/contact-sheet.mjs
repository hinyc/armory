#!/usr/bin/env node
/**
 * 스샷 검토용 모아 보기 이미지를 만든다. 한 장에 여러 캡처를 축소해 붙인다.
 * 사용: node e2e/screen-spec/contact-sheet.mjs [--per 6] [--filter <id 일부>]
 * 출력: docs/screen-spec/review/sheet-01.png, sheet-02.png, ...
 * 빈 차트, 로딩만 찍힌 화면, 남은 툴팁처럼 테스트가 잡지 못하는 문제를 눈으로 찾는 용도다.
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'

const OUT_DIR = path.resolve(process.env.SCREEN_SPEC_OUT_DIR ?? 'docs/screen-spec')
const REVIEW_DIR = path.join(OUT_DIR, 'review')

function readArgs(argv) {
  const value = (flag) => {
    const index = argv.indexOf(flag)
    return index >= 0 ? argv[index + 1] : undefined
  }
  const per = Number(value('--per') ?? 6)
  return { per: Number.isInteger(per) && per > 0 ? per : 6, filter: value('--filter') ?? '' }
}

const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

function loadEntries(filter) {
  const dir = path.join(OUT_DIR, 'data')
  if (!fs.existsSync(dir)) throw new Error(`${dir}가 없습니다. 먼저 screen-spec을 실행하세요.`)
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')))
    .filter((entry) => !filter || entry.id.includes(filter))
    // 로캘에 따라 달라지는 localeCompare 대신 코드 포인트 순서로 비교한다 (sortKey = 파일:줄:순번)
    .sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0))
}

function sheetHtml(entries) {
  const cells = entries.map(
    (entry) => `<figure><img src="${pathToFileURL(path.join(OUT_DIR, entry.image)).href}">
<figcaption><b>${escapeHtml(entry.kind)}</b> ${escapeHtml(entry.title)}<br><code>${escapeHtml(entry.id)}</code></figcaption></figure>`,
  )
  return `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:12px;background:#fff;font:13px system-ui,"Apple SD Gothic Neo",sans-serif;display:grid;grid-template-columns:repeat(2,800px);gap:12px}
figure{margin:0;border:1px solid #ccc;padding:6px}img{width:100%;display:block;border:1px solid #eee}
figcaption{margin-top:4px}code{color:#666}</style>${cells.join('')}`
}

function chunk(items, size) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size))
}

async function main() {
  const { per, filter } = readArgs(process.argv.slice(2))
  const entries = loadEntries(filter)
  if (entries.length === 0) throw new Error('캡처가 없습니다.')
  // 같은 이름의 이전 모아 보기만 지운다. --filter 결과는 이름이 달라 전체 결과를 지우지 않는다.
  const prefix = filter ? `sheet-${filter.replace(/[^a-z0-9-]/gi, '_')}-` : 'sheet-'
  fs.mkdirSync(REVIEW_DIR, { recursive: true })
  fs.readdirSync(REVIEW_DIR)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.png') && (filter || /^sheet-\d+\.png$/.test(name)))
    .forEach((name) => fs.rmSync(path.join(REVIEW_DIR, name)))
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1640, height: 800 } })
    const sheets = chunk(entries, per)
    const htmlFile = path.join(REVIEW_DIR, '_sheet.html')
    try {
      for (const [index, group] of sheets.entries()) {
        fs.writeFileSync(htmlFile, sheetHtml(group))
        await page.goto(pathToFileURL(htmlFile).href)
        await page.waitForLoadState('load')
        const out = path.join(REVIEW_DIR, `${prefix}${String(index + 1).padStart(2, '0')}.png`)
        await page.screenshot({ path: out, fullPage: true })
      }
    } finally {
      fs.rmSync(htmlFile, { force: true })
    }
    process.stdout.write(`[screen-spec:sheet] 캡처 ${entries.length}개 → ${path.relative(process.cwd(), REVIEW_DIR)}/${prefix}*.png (${sheets.length}장)\n`)
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  process.stderr.write(`[screen-spec:sheet] ${error.message}\n`)
  process.exit(1)
})
