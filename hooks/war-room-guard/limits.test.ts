import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'
import { DEFAULT_COMPACT_AT, DEFAULT_DELEGATE_AT, readLimits } from './limits'
import { delegateText } from './delegate'

const limitsOf = (config: unknown) => readLimits(typeof config === 'string' ? config : JSON.stringify(config))

test('키가 없으면 위임 100000, 압축 150000', () => {
  expect(DEFAULT_DELEGATE_AT).toBe(100000)
  expect(DEFAULT_COMPACT_AT).toBe(150000)
  expect(limitsOf({})).toEqual({ delegateAt: 100000, compactAt: 150000 })
})

test('양의 정수는 그 값, 0은 그 단계 끔', () => {
  expect(limitsOf({ managerDelegateAt: 80000, managerCompactAt: 120000 })).toEqual({ delegateAt: 80000, compactAt: 120000 })
  expect(limitsOf({ managerDelegateAt: 0 })).toEqual({ delegateAt: 0, compactAt: 150000 })
  expect(limitsOf({ managerCompactAt: 0 })).toEqual({ delegateAt: 100000, compactAt: 0 })
})

for (const bad of [-1, 1.5, "abc", null, true, [1], {}, NaN]) {
  test(`잘못된 값 ${JSON.stringify(bad)}는 기본값`, () => {
    expect(limitsOf({ managerDelegateAt: bad, managerCompactAt: bad })).toEqual({ delegateAt: 100000, compactAt: 150000 })
  })
}

test('config JSON이 깨지거나 객체가 아니면 기본값', () => {
  const defaults = { delegateAt: 100000, compactAt: 150000 }
  expect(limitsOf('{ 깨짐')).toEqual(defaults)
  expect(limitsOf('null')).toEqual(defaults)
  expect(limitsOf('[1]')).toEqual(defaults)
})

test('위임값이 압축값 이상이어도 각자의 값을 쓴다', () => {
  expect(limitsOf({ managerDelegateAt: 200000, managerCompactAt: 120000 })).toEqual({ delegateAt: 200000, compactAt: 120000 })
})

test('delegateText는 600바이트 이하이고 토큰 수를 넣지 않는다', () => {
  const text = delegateText()
  expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(600)
  expect(text).toContain('에이전트')
  expect(text).not.toMatch(/\d{4,}/)
})

// ---- 엔진 주입 ----
const SHARED = { id: 'base', text: '기본', scope: 'shared' } as const
const INPUT = { model: 'm', promptModel: 'm', surfaces: ['terminal'], tools: [], outputStyle: null, traits: [] } as const

type Setup = {
  config?: string
  tokens?: number | (() => number | undefined)
  usageFails?: boolean
  agentType?: string
  compact?: () => unknown
}

function setup(on: On, s: Setup) {
  const calls = { compact: [] as unknown[], toast: [] as string[] }
  on('prompt.compose', () => ({ sections: [SHARED] }))
  on('session.cwd', () => ({ value: '/proj' }))
  on('fs.read', (_, e) => {
    if (e.path === '/proj/war-room/config.json' && s.config !== undefined) return { value: s.config }
    throw new Error('ENOENT')
  })
  on('session.usage', () => {
    if (s.usageFails) throw new Error('usage fail')
    const tokens = typeof s.tokens === 'function' ? s.tokens() : s.tokens
    return { value: { startedAt: 0, context: { window: 1000000, ...(tokens === undefined ? {} : { tokens }) } } } as never
  })
  on('session.info', () => ({ value: { transcriptPath: '', ...(s.agentType ? { agentType: s.agentType } : {}) } }) as never)
  on('session.compact', (_, e) => {
    calls.compact.push(e)
    return (s.compact ? s.compact() : { messages: [{ role: 'user', text: '요약', toolUses: [] }] }) as never
  })
  on('ui.toast', (_, e) => {
    calls.toast.push((e as { text: string }).text)
    return { value: undefined } as never
  })
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('prompt.submit', (_, e) => ({ text: e.text, ...(e.context ? { context: e.context } : {}) }))
  return calls
}

const withMod = setup

const ids = async ($: Engine) => (await $.prompt.compose(INPUT)).sections.map(x => x.id)
const WR = '{"roles":{"manager":true}}'

const typed = (text: string) => ({ text, wait: false, origin: { kind: 'composer' } as const })
const send = async ($: Engine, extra: Record<string, unknown> = {}) =>
  (await $.prompt.submit({ ...typed('질문'), ...extra } as never)) as { context?: readonly string[] }
const got = (r: { context?: readonly string[] }) => (r.context ?? []).filter(c => c.includes('war-room 위임 전환')).length

test('위임 지침: compose 섹션에는 더하지 않는다(세션 중 반영 안 됨)', async ($, on) => {
  withMod(on, { config: WR, tokens: 500000 })
  expect(await ids($)).toEqual(['base', 'armory:war-room'])
})

test('위임 지침: 위임값 미만으로 시작해 넘으면 다음 제출부터 context로 한 번 전달된다', async ($, on) => {
  const tokens = { v: 99999 as number | undefined }
  withMod(on, { config: WR, tokens: () => tokens.v })
  const first = await send($)
  expect(got(first)).toBe(0)
  expect(first.context ?? []).toEqual([])
  tokens.v = 100000
  const second = await send($)
  expect(second.context).toEqual([delegateText()])
  // 사용자 입력은 바뀌지 않는다
  expect(((await $.prompt.submit({ ...typed('질문'), } as never)) as { text: string }).text).toBe('질문')
})

test('위임 지침: 넘은 상태가 이어져도 다시 넣지 않는다(캐시 안정)', async ($, on) => {
  withMod(on, { config: WR, tokens: 120000 })
  expect(got(await send($))).toBe(1)
  expect(got(await send($))).toBe(0)
  expect(got(await send($))).toBe(0)
})

test('위임 지침: 압축으로 내려갔다가 다시 넘으면 다시 전달된다', async ($, on) => {
  const tokens = { v: 120000 as number | undefined }
  withMod(on, { config: WR, tokens: () => tokens.v })
  expect(got(await send($))).toBe(1)
  tokens.v = undefined // 압축 직후 다음 응답 전
  expect(got(await send($))).toBe(0)
  tokens.v = 20000
  expect(got(await send($))).toBe(0)
  tokens.v = 110000
  expect(got(await send($))).toBe(1)
  expect(got(await send($))).toBe(0)
})

test('위임 지침: 기존 context는 그대로 두고 뒤에 붙인다', async ($, on) => {
  withMod(on, { config: WR, tokens: 120000 })
  const r = await send($, { context: ['앞'] })
  expect(r.context).toEqual(['앞', delegateText()])
})

test('위임 지침: usage 실패·tokens 없음이면 없다', async ($, on) => {
  withMod(on, { config: WR, usageFails: true })
  expect(got(await send($))).toBe(0)
})

test('위임 지침: tokens 없으면 없다', async ($, on) => {
  withMod(on, { config: WR })
  expect(got(await send($))).toBe(0)
})

test('위임 지침: 서브에이전트에서는 없다', async ($, on) => {
  withMod(on, { config: WR, tokens: 500000, agentType: 'general-purpose' })
  expect(got(await send($))).toBe(0)
})

test('위임 지침: managerDelegateAt 0이면 끈다', async ($, on) => {
  withMod(on, { config: '{"managerDelegateAt":0}', tokens: 500000 })
  expect(got(await send($))).toBe(0)
})

test('위임 지침: 낮춘 위임값을 따른다', async ($, on) => {
  withMod(on, { config: '{"managerDelegateAt":1000}', tokens: 1000 })
  expect(got(await send($))).toBe(1)
})

test('위임 지침: war-room이 꺼졌으면 없다', async ($, on) => {
  withMod(on, { config: '{"enabled":false}', tokens: 500000 })
  expect(got(await send($))).toBe(0)
})

test('위임 지침: 사람이 아닌 제출(알림 등)에는 붙이지 않고 전환 표시도 남기지 않는다', async ($, on) => {
  withMod(on, { config: WR, tokens: 120000 })
  expect(got(await send($, { origin: { kind: 'sdk' } }))).toBe(0)
  expect(got(await send($))).toBe(1)
})

let turnNo = 0
const finish = ($: Engine, extra: Record<string, unknown> = {}) =>
  $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: `t${++turnNo}`, reason: 'answer', ...extra } as never)
const submit = ($: Engine) => finish($)

test('위임 지침: 슬래시 명령 제출에는 붙이지 않고 표시도 그대로라 다음 일반 제출에 전달된다', async ($, on) => {
  withMod(on, { config: WR, tokens: 120000 })
  expect(got(await send($, { command: { name: 'foo' } }))).toBe(0)
  expect(got(await send($))).toBe(1)
  expect(got(await send($))).toBe(0)
})

test('위임 지침: 압축 성공 뒤 tokens가 위임값 이상이면 다음 일반 제출에 다시 한 번 전달된다', async ($, on) => {
  withMod(on, { config: WR, tokens: 160000 })
  expect(got(await send($))).toBe(1)
  expect(got(await send($))).toBe(0)
  await finish($)
  expect(got(await send($))).toBe(1)
  expect(got(await send($))).toBe(0)
})

test('위임 지침: 압축이 skip이면 표시를 풀지 않는다', async ($, on) => {
  withMod(on, { config: WR, tokens: 160000, compact: () => ({ skip: 'x' }) })
  expect(got(await send($))).toBe(1)
  await finish($)
  expect(got(await send($))).toBe(0)
})

test('위임 지침: 압축이 reject되면 표시를 풀지 않는다', async ($, on) => {
  withMod(on, {
    config: WR,
    tokens: 160000,
    compact: () => {
      throw new Error('rejected')
    },
  })
  expect(got(await send($))).toBe(1)
  await finish($)
  expect(got(await send($))).toBe(0)
})

test('압축: 압축값 이상이면 compact를 한 번 부르고 보존 지침을 넘긴다', async ($, on) => {
  const calls = withMod(on, { config: WR, tokens: 150000 })
  await submit($)
  expect(calls.compact.length).toBe(1)
  const instructions = (calls.compact[0] as { instructions?: string }).instructions ?? ''
  expect(instructions).toContain('STATUS')
  expect(instructions).toContain('진행 중')
  expect(instructions).toContain('결정')
  expect(instructions).toContain('남은 일')
})

test('압축: 압축값 미만·tokens 없음이면 부르지 않는다', async ($, on) => {
  const calls = withMod(on, { config: WR, tokens: 149999 })
  await submit($)
  expect(calls.compact.length).toBe(0)
})

test('압축: tokens가 없으면 아무 동작도 안 한다', async ($, on) => {
  const calls = withMod(on, { config: WR })
  await submit($)
  expect(calls.compact.length).toBe(0)
})

test('압축: 위임값 200000, 압축값 120000이면 압축은 120000에서 일어난다', async ($, on) => {
  const calls = withMod(on, { config: '{"managerDelegateAt":200000,"managerCompactAt":120000}', tokens: 120000 })
  await submit($)
  expect(calls.compact.length).toBe(1)
})

test('압축: managerCompactAt 0이면 끈다', async ($, on) => {
  const calls = withMod(on, { config: '{"managerCompactAt":0}', tokens: 900000 })
  await submit($)
  expect(calls.compact.length).toBe(0)
})

test('압축: reject돼도 오류 없이 끝나고 /compact 권유 토스트가 1회 나온다', async ($, on) => {
  const calls = withMod(on, {
    config: WR,
    tokens: 150000,
    compact: () => {
      throw new Error('turn running')
    },
  })
  await submit($)
  expect(calls.toast.filter(t => t.includes('/compact')).length).toBe(1)
})

test('압축: { skip }이어도 오류 없이 끝나고 /compact 권유 토스트가 1회 나온다', async ($, on) => {
  const calls = withMod(on, { config: WR, tokens: 150000, compact: () => ({ skip: 'vetoed' }) })
  await submit($)
  expect(calls.toast.filter(t => t.includes('/compact')).length).toBe(1)
})

test('압축: 정상 종료가 아닌 턴(중단·오류)과 서브에이전트 턴은 압축하지 않는다', async ($, on) => {
  const calls = withMod(on, { config: WR, tokens: 150000 })
  await finish($, { reason: 'aborted', isAborted: true })
  await finish($, { reason: 'error' })
  await finish($, { agentId: 'agent-1' })
  expect(calls.compact.length).toBe(0)
})

test('압축: war-room이 없거나 꺼졌으면 압축하지 않는다', async ($, on) => {
  const calls = withMod(on, { config: '{"enabled":false}', tokens: 150000 })
  await submit($)
  expect(calls.compact.length).toBe(0)
})

test('압축: war-room이 없으면 압축하지 않는다', async ($, on) => {
  const calls = withMod(on, { tokens: 150000 })
  await submit($)
  expect(calls.compact.length).toBe(0)
})

test('압축: 서브에이전트에서는 압축하지 않는다', async ($, on) => {
  const calls = withMod(on, { config: WR, tokens: 150000, agentType: 'general-purpose' })
  await submit($)
  expect(calls.compact.length).toBe(0)
})

test('압축: 압축 뒤에도 높으면 이어지는 2요청에서 0회, 내려갔다 다시 넘으면 1회', async ($, on) => {
  const tokens = { v: 160000 as number | undefined }
  const calls = withMod(on, { config: WR, tokens: () => tokens.v })
  await submit($)
  expect(calls.compact.length).toBe(1)
  await submit($)
  await submit($)
  expect(calls.compact.length).toBe(1)
  tokens.v = undefined // 압축 직후 다음 응답 전에는 tokens가 없다
  await submit($)
  expect(calls.compact.length).toBe(1)
  tokens.v = 20000
  await submit($)
  expect(calls.compact.length).toBe(1)
  tokens.v = 155000
  await submit($)
  expect(calls.compact.length).toBe(2)
})

test('압축: 실패 뒤에도 같은 구간에서는 토스트가 1회만 나온다', async ($, on) => {
  const calls = withMod(on, { config: WR, tokens: 150000, compact: () => ({ skip: 'x' }) })
  await submit($)
  await submit($)
  expect(calls.compact.length).toBe(1)
  expect(calls.toast.filter(t => t.includes('/compact')).length).toBe(1)
})
