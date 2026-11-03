import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { isToggleSkill } from './toggle'

const BAND = {
  plugin: 'armory',
  component: 'AbovePrompt',
  surface: 'terminal',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 20,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 19 },
    view: {},
  },
} as const

const typed = (text: string) => ({ text, wait: false, origin: { kind: 'composer' } as const })

const TOGGLE = { skill: 'armory:question-band', text: '# 질문 띠 켜짐/꺼짐 전환', pluginName: 'armory' }

function engineBeneath(on: On) {
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('skill.prompt', ($, e) => ({ text: e.text }))
  on('ui.toast', () => ({ value: undefined }))
}

async function bandText($: Engine, pattern: RegExp) {
  const ui = await $.ui.mount(BAND)
  const found = await ui.find({ type: 'Text', text: pattern })
  await ui.unmount()
  return found?.text
}

test('이 플러그인의 스킬 이름만 받는다', () => {
  expect(isToggleSkill('question-band')).toBe(true)
  expect(isToggleSkill('armory:question-band')).toBe(true)
  expect(isToggleSkill('commit')).toBe(false)
})

test('부를 때마다 켜짐↔꺼짐을 바꾸고 바뀐 상태를 알려준다', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  engineBeneath(on)

  expect((await $.skill.prompt(TOGGLE)).text).toContain('질문 띠: 꺼짐')
  expect((await $.skill.prompt(TOGGLE)).text).toContain('질문 띠: 켜짐')
  expect((await $.skill.prompt(TOGGLE)).text).toContain('질문 띠: 꺼짐')
})

test('끄면 띠가 사라지고 새 질문도 표시하지 않으며, 세션을 다시 시작해도 꺼져 있다', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  engineBeneath(on)

  await $.prompt.submit(typed('첫 질문'))
  expect(await bandText($, /첫 질문/)).toContain('첫 질문')

  await $.skill.prompt(TOGGLE)
  expect(await bandText($, /첫 질문/)).toBeUndefined()

  await $.prompt.submit(typed('두 번째 질문'))
  expect(await bandText($, /두 번째/)).toBeUndefined()

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.prompt.submit(typed('세 번째 질문'))
  expect(await bandText($, /세 번째/)).toBeUndefined()
})

test('꺼진 상태에서 전환하면 다음 질문부터 표시한다', async ($, on) => {
  mock.clock(on)
  mock.store(on, { 'questionBand.enabled': false })
  engineBeneath(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  expect((await $.skill.prompt(TOGGLE)).text).toContain('질문 띠: 켜짐')

  await $.prompt.submit(typed('켠 뒤 질문'))
  expect(await bandText($, /켠 뒤/)).toContain('켠 뒤 질문')
})

test('다른 스킬은 건드리지 않는다', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  engineBeneath(on)

  const reply = await $.skill.prompt({ skill: 'commit', text: '커밋 스킬 본문' })
  expect(reply.text).toBe('커밋 스킬 본문')
})

test('전환 스킬 명령은 질문 요약을 바꾸지 않는다', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  engineBeneath(on)

  await $.prompt.submit(typed('원래 질문'))
  await $.prompt.submit({ ...typed('/question-band'), command: { name: 'armory:question-band', args: '' } })
  expect(await bandText($, /원래 질문/)).toContain('원래 질문')
})
