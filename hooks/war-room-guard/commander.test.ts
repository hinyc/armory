import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { delegateText } from './delegate'
import { commanderReminder, commanderText, guardText, isCommanderSession, parseSeat } from './find'

const ID = '0f1e2d3c-4b5a-4968-8776-5a4b3c2d1e0f'
const OTHER = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const DIR = '/proj/war-room'

const board = (over: { status?: string; id?: string; extra?: string } = {}): string =>
  [
    '# 지휘 보드',
    '',
    '갱신: -',
    '',
    '## 감독 자리',
    '',
    `- 상태: ${over.status ?? '맡음'}`,
    '- 담당: 감독 A · 위치 repo · main · 맡은 시각 2026-11-20 10:00',
    `- 세션 ID: ${over.id ?? ID}`,
    '',
    '## 목표',
    '',
    over.extra ?? '- 없음',
  ].join('\n')

const ON = '{"roles":{"manager":true,"commander":true}}'

// ---- 진리표 ----
test('isCommanderSession: 켜짐·맡음·일치만 true (대소문자 무시)', () => {
  expect(isCommanderSession(ON, board(), ID)).toBe(true)
  expect(isCommanderSession(ON, board(), ID.toUpperCase())).toBe(true)
  expect(isCommanderSession(ON, board({ id: ID.toUpperCase() }), ID)).toBe(true)
})

test('isCommanderSession: 그 밖은 모두 false', () => {
  const off = (c: string, b: string | undefined = board(), id = ID) => isCommanderSession(c, b, id)
  expect(off('{"enabled":false,"roles":{"commander":true}}')).toBe(false)
  expect(off('{"roles":{"manager":true}}')).toBe(false)
  expect(off('{"roles":{"commander":false}}')).toBe(false)
  expect(off('{ 깨짐')).toBe(false)
  expect(off(ON, board({ status: '비어 있음' }))).toBe(false)
  expect(off(ON, board({ status: '이어받기 대기' }))).toBe(false)
  expect(off(ON, board().replace(/- 세션 ID:.*\n/, ''))).toBe(false)
  expect(off(ON, board({ id: '없음 (형식: `<uuid>`. 이 세션의 $CLAUDE_CODE_SESSION_ID)' }))).toBe(false)
  expect(off(ON, board({ id: '0f1e2d3c-4b5a-4968-8776-5a4b3c2d1e0' }))).toBe(false)
  expect(off(ON, board({ id: `${ID}0` }))).toBe(false)
  expect(off(ON, board({ id: 'zzzzzzzz-4b5a-4968-8776-5a4b3c2d1e0f' }))).toBe(false)
  expect(off(ON, board({ id: OTHER }))).toBe(false)
  expect(isCommanderSession(ON, undefined, ID)).toBe(false)
  expect(off(ON, board(), '')).toBe(false)
  expect(off(ON, board().replace(`- 세션 ID: ${ID}`, '- 세션 ID: 없음').replace('## 목표', `## 목표\n- 세션 ID: ${ID}`))).toBe(false)
})

test('parseSeat: 절 안의 상태·세션 ID만 읽는다', () => {
  expect(parseSeat(board())).toEqual({ status: '맡음', sessionId: ID })
  expect(parseSeat(undefined)).toEqual({ status: undefined, sessionId: undefined })
  expect(parseSeat('## 감독 자리 (설명)\n- 상태: 이어받기 대기\n- 세션 ID: 없음')).toEqual({ status: '이어받기 대기', sessionId: undefined })
})

// ---- 제출 context ----
type Setup = { config?: string; board?: string | (() => string | undefined); id?: () => string; agentType?: string; tokens?: number | (() => number); boardReads?: { n: number } }

function setup(on: On, s: Setup) {
  on('session.cwd', () => ({ value: '/proj' }))
  on('fs.read', (_, e) => {
    if (e.path === `${DIR}/config.json` && s.config !== undefined) return { value: s.config }
    if (e.path === `${DIR}/COMMAND.md`) {
      if (s.boardReads) s.boardReads.n += 1
      const text = typeof s.board === 'function' ? s.board() : s.board
      if (text !== undefined) return { value: text }
    }
    throw new Error('ENOENT')
  })
  on('session.id', () => ({ value: s.id ? s.id() : ID }) as never)
  on('session.info', () => ({ value: { transcriptPath: '', ...(s.agentType ? { agentType: s.agentType } : {}) } }) as never)
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1000000, ...(s.tokens === undefined ? {} : { tokens: typeof s.tokens === 'function' ? s.tokens() : s.tokens }) } } }) as never)
  on('prompt.submit', (_, e) => ({ text: e.text, ...(e.context ? { context: e.context } : {}) }))
}

const send = async ($: Engine, extra: Record<string, unknown> = {}) =>
  (await $.prompt.submit({ text: '질문', wait: false, origin: { kind: 'composer' }, ...extra } as never)) as { context?: readonly string[] }
const count = (r: { context?: readonly string[] }) => (r.context ?? []).filter(c => c === commanderText(DIR)).length

test('commanderContext: 담당 세션은 한 번만, 같은 id 재제출엔 없다', async ($, on) => {
  setup(on, { config: ON, board: board() })
  expect((await send($)).context).toEqual([commanderText(DIR), commanderReminder()])
  expect(count(await send($))).toBe(0)
  expect(count(await send($))).toBe(0)
})

test('commanderContext: 세션 id가 바뀌면(/clear) 보드와 달라져 없고, 보드를 새 id로 고치면 다시 한 번', async ($, on) => {
  const cur = { id: ID, board: board() }
  setup(on, { config: ON, board: () => cur.board, id: () => cur.id })
  expect(count(await send($))).toBe(1)
  cur.id = OTHER
  expect(count(await send($))).toBe(0)
  cur.board = board({ id: OTHER })
  expect(count(await send($))).toBe(1)
  expect(count(await send($))).toBe(0)
})

test('commanderContext: 같은 폴더 다른 id 세션·옛 보드·비어 있음·꺼짐은 없다', async ($, on) => {
  setup(on, { config: ON, board: board({ id: OTHER }) })
  expect(count(await send($))).toBe(0)
})

test('commanderContext: 옛 보드(맡음, id 줄 없음)는 없다', async ($, on) => {
  setup(on, { config: ON, board: board().replace(/- 세션 ID:.*\n/, '') })
  expect(count(await send($))).toBe(0)
})

test('commanderContext: 서브에이전트·COMMAND.md 읽기 실패·commander 꺼짐은 없다', async ($, on) => {
  setup(on, { config: ON, board: board(), agentType: 'mod-dev' })
  expect(count(await send($))).toBe(0)
})

test('commanderContext: COMMAND.md 읽기 실패는 없다', async ($, on) => {
  setup(on, { config: ON })
  expect(count(await send($))).toBe(0)
})

test('commanderContext: commander 꺼짐은 없다', async ($, on) => {
  setup(on, { config: '{"roles":{"manager":true}}', board: board() })
  expect(count(await send($))).toBe(0)
})

test('commanderContext: 슬래시 명령 제출엔 붙이지 않고 표시도 남기지 않아 다음 일반 제출에 간다', async ($, on) => {
  setup(on, { config: ON, board: board() })
  expect(count(await send($, { command: { name: 'help', args: '' } }))).toBe(0)
  expect(count(await send($))).toBe(1)
})

test('commanderContext: 기존 context 뒤에 붙인다', async ($, on) => {
  setup(on, { config: ON, board: board() })
  expect((await send($, { context: ['앞'] })).context).toEqual(['앞', commanderText(DIR), commanderReminder()])
})

test('commanderContext: 위임 전환 지침과 같은 제출이면 기존 context 뒤로 둘 다 있다', async ($, on) => {
  setup(on, { config: ON, board: board(), tokens: 120000 })
  expect((await send($, { context: ['앞'] })).context).toEqual(['앞', commanderText(DIR), commanderReminder(), delegateText()])
})

test('commanderContext: 담당이 아니어도 위임 전환 지침은 그대로 간다', async ($, on) => {
  setup(on, { config: ON, board: board({ id: OTHER }), tokens: 120000 })
  expect((await send($)).context).toEqual([delegateText()])
})

// ---- 감독 알림(reminder) ----
const hasReminder = (r: { context?: readonly string[] }) => (r.context ?? []).includes(commanderReminder())
const bytes = (t: string) => new TextEncoder().encode(t).length

test('reminder: 첫 입력은 지침 전체와 알림 둘 다, 둘째·셋째는 알림만, /clear로 id가 바뀌면 다시 전체부터', async ($, on) => {
  const cur = { id: ID, board: board() }
  setup(on, { config: ON, board: () => cur.board, id: () => cur.id })
  const first = await send($)
  expect(count(first)).toBe(1)
  expect(hasReminder(first)).toBe(true)
  expect(first.context).toEqual([commanderText(DIR), commanderReminder()])
  for (let i = 0; i < 2; i += 1) {
    const r = await send($)
    expect(hasReminder(r)).toBe(true)
    expect(count(r)).toBe(0)
  }
  cur.id = OTHER
  cur.board = board({ id: OTHER })
  const again = await send($)
  expect(count(again)).toBe(1)
  expect(hasReminder(again)).toBe(true)
})

// ---- 해제 뒤 재지정: 표시 지우기 ----
type Live = { config: string | undefined; board: string | undefined; id: string; agentType?: string }
const live = (over: Partial<Live> = {}): Live => ({ config: ON, board: board(), id: ID, agentType: undefined, ...over })
const bind = (on: On, cur: Live) =>
  setup(on, { config: ON, board: () => cur.board, id: () => cur.id, get agentType() { return cur.agentType } } as Setup)
const OFF_CONFIG = '{"enabled":false,"roles":{"commander":true}}'

test('재지정: 담당 → 해제(비어 있음) 제출 → 같은 id로 다시 지정하면 첫 입력에 지침과 알림 둘 다', async ($, on) => {
  const cur = live()
  bind(on, cur)
  expect((await send($)).context).toEqual([commanderText(DIR), commanderReminder()])
  cur.board = board({ status: '비어 있음' })
  expect((await send($)).context).toBeUndefined()
  cur.board = board()
  expect((await send($)).context).toEqual([commanderText(DIR), commanderReminder()])
  expect((await send($)).context).toEqual([commanderReminder()])
})

const CLEARING: readonly (readonly [string, Partial<Live>])[] = [
  ['이어받기 대기', { board: board({ status: '이어받기 대기' }) }],
  ['비어 있음', { board: board({ status: '비어 있음' }) }],
  ['다른 세션이 맡음', { board: board({ id: OTHER }) }],
  ['id 줄 없음', { board: board().replace(/- 세션 ID:.*\n/, '') }],
]
for (const [name, change] of CLEARING) {
  test(`표시 지우기: ${name} 제출 뒤 다시 담당이 되면 전체 지침부터`, async ($, on) => {
    const cur = live()
    bind(on, cur)
    expect(count(await send($))).toBe(1)
    Object.assign(cur, change)
    await send($)
    Object.assign(cur, live())
    expect((await send($)).context).toEqual([commanderText(DIR), commanderReminder()])
  })
}

test('표시 지우기: commander 꺼짐·war-room 꺼짐(enabled:false, manager:false) 제출도 표시를 지운다', async ($, on) => {
  const cfg = { config: ON }
  setup(on, { board: board(), get config() { return cfg.config } } as Setup)
  for (const off of ['{"roles":{"manager":true}}', OFF_CONFIG, '{"roles":{"manager":false,"commander":true}}']) {
    cfg.config = ON
    await send($)
    cfg.config = off
    await send($)
    cfg.config = ON
    expect(count(await send($))).toBe(1)
    await send($)
  }
})

test('표시 지우기: 표시가 다른 세션 id면 이 세션의 비담당 제출은 건드리지 않는다', async ($, on) => {
  const cur = live({ id: OTHER, board: board({ id: OTHER }) })
  bind(on, cur)
  expect(count(await send($))).toBe(1)
  cur.id = ID
  expect(count(await send($))).toBe(0)
  cur.id = OTHER
  expect((await send($)).context).toEqual([commanderReminder()])
})

const KEEPING: readonly (readonly [string, Partial<Live>, Record<string, unknown>])[] = [
  ['서브에이전트', { board: board({ status: '비어 있음' }), agentType: 'mod-dev' }, {}],
  ['슬래시 명령', { board: board({ status: '비어 있음' }) }, { command: { name: 'help', args: '' } }],
  ['COMMAND.md 읽기 실패', { board: undefined }, {}],
  ['감독 자리 상태 읽기 실패', { board: '# 지휘 보드\n\n## 목표\n- 없음' }, {}],
]
for (const [name, change, extra] of KEEPING) {
  test(`표시 지우기: ${name} 제출은 표시를 지우지 않는다`, async ($, on) => {
    const cur = live()
    bind(on, cur)
    expect(count(await send($))).toBe(1)
    Object.assign(cur, change)
    await send($, extra)
    Object.assign(cur, live())
    expect((await send($)).context).toEqual([commanderReminder()])
  })
}

const NONE: readonly (readonly [string, Setup])[] = [
  ['담당 아님(id 다름)', { config: ON, board: board({ id: OTHER }) }],
  ['이어받기 대기', { config: ON, board: board({ status: '이어받기 대기' }) }],
  ['비어 있음', { config: ON, board: board({ status: '비어 있음' }) }],
  ['옛 보드(id 줄 없음)', { config: ON, board: board().replace(/- 세션 ID:.*\n/, '') }],
  ['commander 꺼짐', { config: '{"roles":{"manager":true}}', board: board() }],
  ['서브에이전트 세션', { config: ON, board: board(), agentType: 'mod-dev' }],
  ['COMMAND.md 읽기 실패', { config: ON }],
]
for (const [name, c] of NONE) {
  test(`reminder: ${name}는 알림도 지침도 없다`, async ($, on) => {
    setup(on, c)
    for (let i = 0; i < 2; i += 1) {
      const r = await send($)
      expect(count(r)).toBe(0)
      expect(hasReminder(r)).toBe(false)
    }
  })
}

test('reminder: 슬래시 명령 제출엔 알림이 없다', async ($, on) => {
  setup(on, { config: ON, board: board() })
  await send($)
  expect(hasReminder(await send($, { command: { name: 'help', args: '' } }))).toBe(false)
})

test('reminder: 첫 제출 뒤 같은 id로 20회, 토큰이 압축 임계 이상이어도 지침 1회·알림 20회', async ($, on) => {
  setup(on, { config: ON, board: board(), tokens: 900000 })
  let full = 0
  let short = 0
  for (let i = 0; i < 20; i += 1) {
    const r = await send($)
    full += count(r)
    short += hasReminder(r) ? 1 : 0
  }
  expect(full).toBe(1)
  expect(short).toBe(20)
})

test('reminder: 원격(bridge) 제출에도 담당 감독 세션이면 붙는다', async ($, on) => {
  setup(on, { config: ON, board: board() })
  await send($, { origin: { kind: 'bridge' } })
  expect(hasReminder(await send($, { origin: { kind: 'bridge' } }))).toBe(true)
})

test('reminder: 위임 전환 지침과 같이 붙으면 commander 쪽이 앞이다', async ($, on) => {
  const cur = { tokens: 0 }
  setup(on, { config: ON, board: board(), tokens: () => cur.tokens })
  await send($)
  cur.tokens = 120000
  expect((await send($, { context: ['앞'] })).context).toEqual(['앞', commanderReminder(), delegateText()])
})

test('commanderText: 400바이트 이하, 작업 세션·작업 에이전트·하 등급 금지 뜻 포함, 긴 절대 경로 dir에도 같은 값', () => {
  const longDir = `/Users/${'아'.repeat(30)}/Documents/${'a'.repeat(80)}/war-room`
  expect(longDir.length).toBeGreaterThanOrEqual(120)
  const t = commanderText(longDir)
  expect(bytes(t)).toBeLessThanOrEqual(400)
  expect(t).toBe(commanderText(DIR))
  for (const part of ['작업 세션', '작업 에이전트', 'sonnet', '하 등급도 직접 하지 않고', 'po·pm·tpm', 'war-room/COMMAND.md']) expect(t).toContain(part)
})

test('reminder 문구와 크기, guardText의 감독 우선 구절', () => {
  expect(bytes(commanderReminder())).toBeLessThanOrEqual(200)
  expect(bytes(commanderText(DIR))).toBeLessThanOrEqual(400)
  expect(bytes(guardText(DIR))).toBeLessThanOrEqual(1900)
  expect(commanderReminder()).toContain('하 등급도 직접 하지 않는다')
  expect(commanderReminder()).toContain('→ 감독: <작업 세션|작업 에이전트|po|pm|tpm>에 넘깁니다 (…)')
  const g = guardText(DIR)
  expect(g).toContain('sonnet')
  expect(g).toContain('4개')
  expect(g).toContain('감독 세션 지침을 받으면 그 지침을 따른다.')
  expect(g).not.toContain('하 등급 일만 매니저가 직접')
  expect(g.indexOf('sonnet')).toBeLessThan(g.indexOf('감독 세션 지침을 받으면'))
})
