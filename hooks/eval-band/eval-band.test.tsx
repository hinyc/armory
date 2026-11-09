import { expect, mock, test } from 'claude-code/testing'
import type { EngineInterface, On } from 'claude-code'

import { isVisible, metricText, parseProgress, runText, type EvalProgress } from './progress'
import { readProgress } from './read'

const BAND = {
  plugin: 'armory',
  component: 'AbovePrompt',
  surface: 'terminal',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 20,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 19 },
    view: {},
  },
} as const

const NOW = Date.parse('2026-11-09T13:40:00+09:00')
const iso = (ms: number) => new Date(ms).toISOString()

const progress = (over: Partial<EvalProgress> = {}, state = 'running'): EvalProgress => ({
  task: '로그인 폼 수정',
  role: 'mod-dev',
  updatedAt: iso(NOW),
  current: {
    attempt: 2,
    state: state as 'running',
    focus: '히스토리 위반 고친 결과',
    items: [
      { group: 'criteria', status: 'pass', summary: '3/3' },
      { group: 'history', status: 'running' },
    ],
  },
  ...over,
})

const PREVIOUS = {
  attempt: 1,
  verdict: 'fail' as const,
  items: [
    { group: 'criteria' as const, status: 'pass' as const, summary: '3/3' },
    { group: 'history' as const, status: 'fail' as const, summary: 'DECISIONS 11-05' },
    {
      group: 'metrics' as const,
      status: 'pass' as const,
      metrics: [{ name: '응답', value: 182, unit: 'ms', limit: 300, baseline: 120 }],
    },
  ],
}

/** 가짜 파일 시스템(경로 → 내용)과 아래에서 답하는 그림. */
function engineBeneath(on: On, files: Record<string, string>, beneathText?: string) {
  on('session.cwd', () => ({ value: '/proj' }))
  on('fs.read', (_, e) => {
    const text = files[e.path]
    if (text === undefined) throw new Error(`ENOENT: ${e.path}`)
    return { value: text }
  })
  on('fs.list', (_, e) => {
    const prefix = `${e.path}/`
    const entries = Object.keys(files)
      .filter(p => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
      .map(p => ({ name: p.slice(prefix.length), kind: 'file' as const, size: 1, mtimeMs: 0 }))
    if (entries.length === 0) throw new Error(`ENOENT: ${e.path}`)
    return { value: entries }
  })
  on('ui.render', ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    return beneathText === undefined ? <Box /> : <Text>{beneathText}</Text>
  })
}

/** 그려진 Text를 위에서 아래 순서로 이어 붙인다. */
const allText = async (ui: { findAll: (q: { type: 'Text' }) => Promise<{ text?: string }[]> }) =>
  (await ui.findAll({ type: 'Text' })).map(t => t.text ?? '').join('\n')

const CONFIG = { '/proj/war-room/config.json': '{}' }
const evalFile = (name: string, p: EvalProgress) => ({ [`/proj/war-room/.eval/${name}.json`]: JSON.stringify(p) })

test('parseProgress: 깨진 JSON, current 없음, 필수 칸 없음은 undefined', () => {
  expect(parseProgress('{')).toBeUndefined()
  expect(parseProgress('[]')).toBeUndefined()
  const { current: _current, ...noCurrent } = progress()
  expect(parseProgress(JSON.stringify(noCurrent))).toBeUndefined()
  const { task: _task, ...noTask } = progress()
  expect(parseProgress(JSON.stringify(noTask))).toBeUndefined()
  expect(parseProgress(JSON.stringify({ ...progress(), updatedAt: undefined }))).toBeUndefined()
})

test('parseProgress: 알 수 없는 group·status 항목만 버린다', () => {
  const raw = progress()
  const withBad = {
    ...raw,
    current: { ...raw.current, items: [...raw.current.items, { group: 'weird', status: 'pass' }, { group: 'concepts', status: 'zzz' }] },
  }
  const parsed = parseProgress(JSON.stringify(withBad))
  expect(parsed?.current.items.map(i => i.group)).toEqual(['criteria', 'history'])
})

test('isVisible: running·planning만, 30분 넘으면 숨김', () => {
  expect(isVisible(progress(), NOW)).toBe(true)
  expect(isVisible(progress({}, 'planning'), NOW)).toBe(true)
  for (const state of ['done', 'planned', 'aborted']) expect(isVisible(progress({}, state), NOW)).toBe(false)
  const old = progress({ updatedAt: iso(NOW - 31 * 60_000) })
  expect(isVisible(old, NOW)).toBe(false)
  expect(isVisible(progress({ updatedAt: iso(NOW - 29 * 60_000) }), NOW)).toBe(true)
  expect(isVisible(progress({ updatedAt: 'not a date' }), NOW)).toBe(false)
})

test('runText: 시작 안 한 갈래(pending)는 ○로 그린다', () => {
  const text = runText(progress().current, false)
  expect(text).toContain('부작용 ○')
  expect(text).toContain('개념 ○')
  expect(text).not.toContain('부작용 ·')
})

test('metricText: 경고·실패·통과', () => {
  expect(metricText({ name: '응답', value: 182, unit: 'ms', limit: 300, baseline: 120 })).toBe('응답 182ms/300 ⚠ (+62)')
  expect(metricText({ name: '응답', value: 310, unit: 'ms', limit: 300 })).toBe('응답 310ms/300 ✗')
  expect(metricText({ name: '빌드', value: 4.1, unit: 's', limit: 10, baseline: 4.0 })).toBe('빌드 4.1s/10 ✓')
})

/** 가짜 파일 시스템만 가진 엔진 인터페이스(읽기 함수 단독 테스트용). */
function fakeEngine(files: Record<string, string>, cwd: () => string = () => '/proj'): EngineInterface {
  return {
    session: { cwd: async () => cwd() },
    fs: {
      read: async (path: string) => {
        const text = files[path]
        if (text === undefined) throw new Error(`ENOENT: ${path}`)
        return text
      },
      list: async (path: string) => {
        const prefix = `${path}/`
        const names = Object.keys(files).filter(p => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
        if (names.length === 0) throw new Error(`ENOENT: ${path}`)
        return names.map(p => ({ name: p.slice(prefix.length), kind: 'file', size: 1, mtimeMs: 0 }))
      },
    },
  } as unknown as EngineInterface
}

test('read: war-room 없음 → []', async () => {
  expect(await readProgress(fakeEngine({}))).toEqual([])
})

test('read: .eval 없음 → []', async () => {
  expect(await readProgress(fakeEngine(CONFIG))).toEqual([])
})

test('read: 읽기가 throw해도 []', async () => {
  const boom = () => {
    throw new Error('boom')
  }
  expect(await readProgress(fakeEngine(CONFIG, boom))).toEqual([])
})

test('read: 깨진 파일은 건너뛰고 나머지를 읽는다', async () => {
  const files = { ...CONFIG, '/proj/war-room/.eval/bad.json': '{', ...evalFile('good', progress()) }
  expect((await readProgress(fakeEngine(files))).map(p => p.role)).toEqual(['mod-dev'])
})

test('read: 위 폴더의 war-room도 찾는다', async () => {
  const files = { ...CONFIG, ...evalFile('good', progress()) }
  expect(await readProgress(fakeEngine(files, () => '/proj/sub/deep'))).toHaveLength(1)
})

test('띠: 진행 파일 없음 → 아래 그림 그대로', async ($, on) => {
  engineBeneath(on, CONFIG, '아래 그림')
  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: /평가/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /아래 그림/ })).toBeDefined()
  await ui.unmount()
})

test('띠: running 하나 → 평가 블록이 위, 아래 그림이 그 아래에 모두 있다', async ($, on) => {
  mock.clock(on, { now: NOW })
  engineBeneath(on, { ...CONFIG, ...evalFile('mod-dev', progress({ previous: PREVIOUS })) }, '아래 그림')
  const ui = await $.ui.mount(BAND)
  const header = await ui.find({ type: 'Text', text: /⚖ 평가 · mod-dev · 로그인 폼 수정/ })
  const beneath = await ui.find({ type: 'Text', text: /아래 그림/ })
  expect(header).toBeDefined()
  expect(beneath).toBeDefined()
  const text = await allText(ui)
  expect(text.indexOf('⚖ 평가')).toBeLessThan(text.indexOf('아래 그림'))
  expect(text).toContain('이전 (시도 1) ✗')
  expect(text).toContain('지금 (시도 2)')
  expect(text).toContain('응답 182ms/300 ⚠ (+62)')
  await ui.unmount()
})

test('띠: previous가 없으면 이전 줄이 없다', async ($, on) => {
  mock.clock(on, { now: NOW })
  engineBeneath(on, { ...CONFIG, ...evalFile('mod-dev', progress()) })
  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: /지금 \(시도 2\)/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /이전/ })).toBeUndefined()
  await ui.unmount()
})

test('띠: 평가 띠 위에 질문 띠도 함께 보인다(양보하지 않는다)', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  engineBeneath(on, { ...CONFIG, ...evalFile('mod-dev', progress()) })
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  await $.prompt.submit({ text: '빌드 에러 고쳐줘', wait: false, origin: { kind: 'composer' } })
  await $.turn.start({ text: '빌드 에러 고쳐줘', turnId: 't1' })
  await clock.advance(1000)
  const ui = await $.ui.mount(BAND)
  const text = await allText(ui)
  expect(text).toContain('⚖ 평가')
  expect(text).toContain('빌드 에러 고쳐줘')
  expect(text.indexOf('⚖ 평가')).toBeLessThan(text.indexOf('빌드 에러 고쳐줘'))
  await ui.unmount()
})
