import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { delegateText } from './delegate'
import { commanderText, isCommanderSession, parseSeat } from './find'

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
type Setup = { config?: string; board?: string | (() => string | undefined); id?: () => string; agentType?: string; tokens?: number; boardReads?: { n: number } }

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
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1000000, ...(s.tokens === undefined ? {} : { tokens: s.tokens }) } } }) as never)
  on('prompt.submit', (_, e) => ({ text: e.text, ...(e.context ? { context: e.context } : {}) }))
}

const send = async ($: Engine, extra: Record<string, unknown> = {}) =>
  (await $.prompt.submit({ text: '질문', wait: false, origin: { kind: 'composer' }, ...extra } as never)) as { context?: readonly string[] }
const count = (r: { context?: readonly string[] }) => (r.context ?? []).filter(c => c === commanderText(DIR)).length

test('commanderContext: 담당 세션은 한 번만, 같은 id 재제출엔 없다', async ($, on) => {
  setup(on, { config: ON, board: board() })
  expect((await send($)).context).toEqual([commanderText(DIR)])
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
  expect((await send($, { context: ['앞'] })).context).toEqual(['앞', commanderText(DIR)])
})

test('commanderContext: 위임 전환 지침과 같은 제출이면 기존 context 뒤로 둘 다 있다', async ($, on) => {
  setup(on, { config: ON, board: board(), tokens: 120000 })
  expect((await send($, { context: ['앞'] })).context).toEqual(['앞', commanderText(DIR), delegateText()])
})

test('commanderContext: 담당이 아니어도 위임 전환 지침은 그대로 간다', async ($, on) => {
  setup(on, { config: ON, board: board({ id: OTHER }), tokens: 120000 })
  expect((await send($)).context).toEqual([delegateText()])
})
