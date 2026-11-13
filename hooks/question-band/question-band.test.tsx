import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const BAND = {
  plugin: 'armory',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 20,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 19 },
    view: {},
  },
} as const

const NO_USAGE = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }

/** 사람이 입력창에서 보낸 질문. */
const typed = (text: string) => ({ text, wait: false, origin: { kind: 'composer' } as const })

const SURFACES = ['terminal', 'desktop'] as const

const LONG_PROMPT = [
  '로그인 화면에서 비밀번호 입력 시 엔터를 누르면 제출되도록 바꿔줘.',
  '그리고 실패하면 에러 메시지를 빨간색으로 보여주고',
  '세 번 실패하면 1분 동안 잠그는 기능도 넣어줘.',
  '테스트도 같이 작성하고',
  '마지막으로 README에 변경 내용을 정리해줘.',
].join('\n')

/** 엔진 대신 아래에서 답하는 훅: 아무것도 그리지 않는 띠, 프롬프트·턴 통과, 모델 요약. */
function engineBeneath(
  on: On,
  modelText = '로그인 엔터 제출 추가\n실패 시 잠금 기능',
  otherBand?: string,
  drawsEngineDefault = false,
) {
  on('ui.render', ($, e) => {
    // 실제 Claude Code는 아무 mod도 안 그리면 엔진 기본 그림 요소를 돌려준다.
    if (drawsEngineDefault) return { type: 'engine', ref: 1 } as const
    const { Box, Text } = $.ui.resolve(e)
    return otherBand === undefined ? <Box /> : <Text>{otherBand}</Text>
  })
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('model.complete', () => ({
    value:
      modelText === ''
        ? { isAnswered: false, reason: 'empty-reply', usage: NO_USAGE }
        : { isAnswered: true, text: modelText, usage: NO_USAGE },
  }))
}

const completeTurn = (turnId: string, reason: 'answer' | 'aborted' = 'answer') => ({
  answer: 'ok',
  durationMs: 1,
  isAborted: reason === 'aborted',
  turnId,
  reason,
})

test('질문 전에는 띠를 그리지 않는다', async ($, on) => {
  engineBeneath(on)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: /질문/ })).toBeUndefined()
    await ui.unmount()
  }
})

test('짧은 질문은 원문과 경과 시간을, 완료 후에는 걸린 시간을 보여준다', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  engineBeneath(on)

  await $.prompt.submit(typed('빌드 에러 고쳐줘'))
  await $.turn.start({ text: '빌드 에러 고쳐줘', turnId: 't1' })
  await clock.advance(83_000)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /빌드 에러/ }))?.text).toContain('빌드 에러 고쳐줘')
    expect((await ui.find({ type: 'Text', text: /경과/ }))?.text).toContain('1분 23초 경과')
    await ui.unmount()
  }

  await clock.advance(10_000)
  await $.turn.complete(completeTurn('t1'))
  await clock.advance(60_000)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /걸림/ }))?.text).toContain('1분 33초 걸림')
    expect((await ui.find({ type: 'Text', text: /빌드 에러/ }))?.text).toContain('빌드 에러 고쳐줘')
    await ui.unmount()
  }
})

test('긴 질문은 모델 요약으로 최대 4줄을 보여준다', async ($, on) => {
  const clock = mock.clock(on)
  engineBeneath(on, '- 로그인 엔터 제출\n- 실패 시 빨간 에러\n- 3회 실패 1분 잠금\n- 테스트 작성\n- README 정리')

  await $.prompt.submit(typed(LONG_PROMPT))
  await clock.settle()

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /로그인 엔터 제출/ }))?.text).toContain('❯ 로그인 엔터 제출')
  expect((await ui.find({ type: 'Text', text: /테스트 작성/ }))?.text).toContain('테스트 작성 …')
  expect(await ui.find({ type: 'Text', text: /README/ })).toBeUndefined()
  await ui.unmount()
})

test('모델이 답하지 못하면 원문 앞 4줄을 유지한다', async ($, on) => {
  const clock = mock.clock(on)
  engineBeneath(on, '')

  await $.prompt.submit(typed(LONG_PROMPT))
  await clock.settle()

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /세 번 실패/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /README/ })).toBeUndefined()
  await ui.unmount()
})

test('서브에이전트 턴 종료와 다른 턴 종료로는 완료 처리하지 않는다', async ($, on) => {
  mock.clock(on)
  engineBeneath(on)

  await $.prompt.submit(typed('리팩토링 해줘'))
  await $.turn.start({ text: '리팩토링 해줘', turnId: 't1' })
  await $.turn.complete({ ...completeTurn('a1'), agentId: 'agent-1' })
  await $.turn.complete(completeTurn('t0'))

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /경과/ })).toBeDefined()
  await ui.unmount()
})

test('중단된 턴은 중단으로 표시하고, 다음 질문 전까지 요약을 유지한다', async ($, on) => {
  const clock = mock.clock(on)
  engineBeneath(on)

  await $.prompt.submit(typed('첫 질문'))
  await $.turn.start({ text: '첫 질문', turnId: 't1' })
  await clock.advance(5_000)
  await $.turn.complete(completeTurn('t1', 'aborted'))
  await clock.advance(600_000)

  let ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /중단됨/ }))?.text).toContain('중단됨 (5초)')
  expect(await ui.find({ type: 'Text', text: /첫 질문/ })).toBeDefined()
  await ui.unmount()

  await $.prompt.submit(typed('두 번째 질문'))
  ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /첫 질문/ })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: /경과/ }))?.text).toContain('0초 경과')
  await ui.unmount()
})

test('다른 mod가 띠를 그리고 있으면 양보한다', async ($, on) => {
  mock.clock(on)
  engineBeneath(on, undefined, '다른 mod')

  await $.prompt.submit(typed('질문'))

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /다른 mod/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /경과/ })).toBeUndefined()
  await ui.unmount()
})

test('엔진 기본 그림만 있으면 띠를 그린다', async ($, on) => {
  mock.clock(on)
  engineBeneath(on, undefined, undefined, true)

  await $.prompt.submit(typed('질문'))

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /경과/ })).toBeDefined()
  await ui.unmount()
})

test('백그라운드 알림으로 시작된 턴은 질문으로 보지 않는다', async ($, on) => {
  mock.clock(on)
  engineBeneath(on)

  await $.prompt.submit(typed('첫 질문'))
  await $.prompt.submit({ text: '작업 완료 알림', wait: false, origin: { kind: 'task-notification' } })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /첫 질문/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /알림/ })).toBeUndefined()
  await ui.unmount()
})

test('M1: 이 mod 안에서 예외가 나도 아래 훅까지 prompt.submit이 전달된다', async ($, on) => {
  let reached = 0
  on('clock.now', () => {
    throw new Error('boom')
  })
  on('prompt.submit', ($, e) => {
    reached += 1
    return { text: e.text }
  })
  const result = await $.prompt.submit(typed('질문'))
  expect(result).toEqual({ text: '질문' })
  expect(reached).toBe(1)
})

test('M1: 이 mod 안에서 예외가 나도 turn.start·turn.complete가 아래로 전달된다', async ($, on) => {
  let reached = 0
  on('clock.now', () => {
    throw new Error('boom')
  })
  on('turn.start', ($, e) => {
    reached += 1
    return { turnId: e.turnId }
  })
  on('turn.complete', ($, e) => {
    reached += 10
    return { text: e.answer }
  })
  await $.turn.start({ text: '질문', turnId: 't1' })
  await $.turn.complete(completeTurn('t1'))
  expect(reached).toBe(11)
})

test('M2: 모델 요약이 예외를 던져도 원문 요약을 유지한다', async ($, on) => {
  const clock = mock.clock(on)
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('model.complete', () => {
    throw new Error('model down')
  })
  await $.prompt.submit(typed(LONG_PROMPT))
  await clock.settle()
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /세 번 실패/ })).toBeDefined()
  await ui.unmount()
})

test('M3: 앞 턴의 turn.complete는 아직 턴이 없는 새 질문을 완료로 바꾸지 않는다', async ($, on) => {
  const clock = mock.clock(on)
  engineBeneath(on)
  await $.prompt.submit(typed('첫 질문'))
  await $.turn.start({ text: '첫 질문', turnId: 't1' })
  await $.prompt.submit(typed('두 번째 질문')) // 대기열: turnId 아직 없음
  await clock.advance(3_000)
  await $.turn.complete(completeTurn('t1'))
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /두 번째 질문/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /경과/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /걸림/ })).toBeUndefined()
  await ui.unmount()
})
