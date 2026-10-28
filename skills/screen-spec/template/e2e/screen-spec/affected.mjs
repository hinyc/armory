#!/usr/bin/env node
/**
 * 업데이트 모드 입력을 만든다: 기준 커밋 이후 바뀐 파일 → 영향받는 캡처.
 * 사용: node e2e/screen-spec/affected.mjs [기준커밋]
 *   기준커밋을 생략하면 spec.config.ts의 lastBuiltCommit을 쓴다.
 * 출력(JSON): affected(캡처별 바뀐 소스), uncovered(어느 캡처에도 없는 바뀐 소스), failures(직전 실행 실패)
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const OUT_DIR = process.env.SCREEN_SPEC_OUT_DIR ?? 'docs/screen-spec'
const HARNESS_DIR = 'e2e/screen-spec/'
const SPEC_FILE = `${HARNESS_DIR}support/spec.config.ts`
const SOURCE_EXT = /\.(tsx?|jsx?|vue|svelte|css|scss)$/

// 경로는 모두 현재 폴더(앱 루트) 기준. 한글 파일명이 따옴표로 감싸지지 않게 quotePath를 끈다.
const git = (args) =>
  execFileSync('git', ['-c', 'core.quotePath=false', ...args], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)

function readBaseCommit() {
  const fromArg = process.argv[2]
  const text = fromArg ? '' : fs.readFileSync(SPEC_FILE, 'utf8')
  const base = fromArg ?? text.match(/lastBuiltCommit:\s*['"`]([^'"`]*)['"`]/)?.[1]
  if (!base) {
    throw new Error(`기준 커밋이 없습니다. 인자로 넘기거나 ${SPEC_FILE}의 lastBuiltCommit을 채우세요.`)
  }
  try {
    git(['rev-parse', '--verify', '--quiet', `${base}^{commit}`])
  } catch {
    throw new Error(`커밋을 찾을 수 없습니다: ${base}`)
  }
  return base
}

function changedFiles(base) {
  const committed = git(['diff', '--name-only', '--relative', `${base}..HEAD`])
  const working = git(['diff', '--name-only', '--relative', 'HEAD'])
  const untracked = git(['ls-files', '--others', '--exclude-standard'])
  return [...new Set([...committed, ...working, ...untracked])].sort()
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function loadEntries() {
  const dir = path.join(OUT_DIR, 'data')
  if (!fs.existsSync(dir)) throw new Error(`${dir}가 없습니다. 먼저 screen-spec을 실행하세요.`)
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => readJson(path.join(dir, name), null))
    .filter(Boolean)
}

function main() {
  const base = readBaseCommit()
  const changed = changedFiles(base)
  const entries = loadEntries()
  const affected = entries
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      specFile: entry.specFile,
      changed: changed.filter((file) => (entry.source ?? []).includes(file) || file === entry.specFile),
    }))
    .filter((entry) => entry.changed.length > 0)
  const covered = new Set(entries.flatMap((entry) => [...(entry.source ?? []), entry.specFile]))
  const specFiles = new Set(entries.map((entry) => entry.specFile))
  const uncovered = changed.filter(
    (file) => SOURCE_EXT.test(file) && !covered.has(file) && !file.startsWith(HARNESS_DIR),
  )
  // fixtures·공통 목·설정 변경: 이 파일을 쓰는 시나리오를 다시 돌려야 한다
  const harnessChanged = changed.filter((file) => file.startsWith(HARNESS_DIR) && !specFiles.has(file))
  const failures = readJson(path.join(OUT_DIR, 'report.json'), {}).failures ?? []
  const result = { base, changedCount: changed.length, affected, uncovered, harnessChanged, failures }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

try {
  main()
} catch (error) {
  process.stderr.write(`[screen-spec:affected] ${error.message}\n`)
  process.exit(1)
}
