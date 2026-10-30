#!/usr/bin/env node
/**
 * 업데이트 모드 입력을 만든다: 기준 커밋 이후 바뀐 파일 → 영향받는 캡처.
 * 사용: node e2e/screen-spec/affected.mjs [기준커밋]
 *   기준커밋 결정 순서: 인자 → state.json의 lastBuiltCommit → e2e/screen-spec/을 처음 추가한 커밋
 * 출력(JSON)
 *   affected        캡처별 바뀐 소스·시나리오
 *   uncovered       어느 캡처의 source에도 없는 바뀐 앱 소스 (새 화면 또는 source 누락)
 *   harnessChanged  바뀐 fixtures·공통 목·Playwright 설정·harnessDeps 경로
 *   annotationsToCheck  영향받은 캡처를 쓰는 annotations/*.json (좌표를 직접 적어서 화면이 바뀌면 어긋날 수 있다)
 *   failures        직전 실행에서 실패한 테스트
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const OUT_DIR = process.env.SCREEN_SPEC_OUT_DIR ?? 'docs/screen-spec'
const HARNESS_DIR = 'e2e/screen-spec/'
const STATE_FILE = `${HARNESS_DIR}state.json`
const ANNOTATIONS_DIR = `${HARNESS_DIR}annotations/`
const HARNESS_CONFIGS = /^playwright\.screen-spec.*\.config\.[cm]?[jt]s$/
const SOURCE_EXT = /\.(tsx?|jsx?|vue|svelte|css|scss)$/

// 경로는 모두 현재 폴더(앱 루트) 기준. 한글 파일명이 따옴표로 감싸지지 않게 quotePath를 끈다.
const git = (args) =>
  execFileSync('git', ['-c', 'core.quotePath=false', ...args], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function readState() {
  const state = readJson(STATE_FILE, {})
  return {
    lastBuiltCommit: typeof state.lastBuiltCommit === 'string' ? state.lastBuiltCommit : '',
    harnessDeps: Array.isArray(state.harnessDeps) ? state.harnessDeps : [],
  }
}

function firstHarnessCommit() {
  const commits = git(['log', '--diff-filter=A', '--format=%H', '--', HARNESS_DIR])
  return commits.at(-1) ?? ''
}

function resolveBase(state) {
  const base = process.argv[2] ?? (state.lastBuiltCommit || firstHarnessCommit())
  if (!base) {
    throw new Error(`기준 커밋이 없습니다. 인자로 넘기거나 ${STATE_FILE}의 lastBuiltCommit을 채우세요.`)
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
  return [...new Set([...committed, ...working, ...untracked])]
    .filter((file) => file !== STATE_FILE)
    .sort()
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

function isHarness(file, deps) {
  // annotations/는 실행할 때마다 다시 그려져서 하네스 변경으로 보지 않는다
  if (file.startsWith(ANNOTATIONS_DIR)) return false
  return (
    file.startsWith(HARNESS_DIR) ||
    HARNESS_CONFIGS.test(file) ||
    deps.some((dep) => file === dep || file.startsWith(dep.endsWith('/') ? dep : `${dep}/`))
  )
}

function classify(changed, entries, deps) {
  const specFiles = new Set(entries.map((entry) => entry.specFile))
  const covered = new Set(entries.flatMap((entry) => [...(entry.source ?? []), entry.specFile]))
  const affected = entries
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      specFile: entry.specFile,
      changed: changed.filter((file) => (entry.source ?? []).includes(file) || file === entry.specFile),
    }))
    .filter((entry) => entry.changed.length > 0)
  const harnessChanged = changed.filter((file) => isHarness(file, deps) && !specFiles.has(file))
  const uncovered = changed.filter(
    (file) => SOURCE_EXT.test(file) && !covered.has(file) && !isHarness(file, deps),
  )
  return { affected, uncovered, harnessChanged }
}

function annotationsToCheck(affectedIds) {
  if (!fs.existsSync(ANNOTATIONS_DIR)) return []
  return fs
    .readdirSync(ANNOTATIONS_DIR)
    .filter((name) => name.endsWith('.json'))
    .flatMap((name) => {
      const file = `${ANNOTATIONS_DIR}${name}`
      const specs = [readJson(file, [])].flat()
      return specs
        .filter((spec) => affectedIds.has(spec?.capture) && (spec.marks?.length || spec.arrows?.length || spec.crop))
        .map((spec) => ({ file, name: spec.name, capture: spec.capture }))
    })
}

function main() {
  const state = readState()
  const base = resolveBase(state)
  const changed = changedFiles(base)
  const entries = loadEntries()
  const failures = readJson(path.join(OUT_DIR, 'report.json'), {}).failures ?? []
  const classified = classify(changed, entries, state.harnessDeps)
  const toCheck = annotationsToCheck(new Set(classified.affected.map((entry) => entry.id)))
  const result = { base, changedCount: changed.length, ...classified, annotationsToCheck: toCheck, failures }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

try {
  main()
} catch (error) {
  process.stderr.write(`[screen-spec:affected] ${error.message}\n`)
  process.exit(1)
}
