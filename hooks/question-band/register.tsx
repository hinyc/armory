// 질문 띠 mod: 입력창 위에 현재 질문 요약과 질문 시각·경과 시간을 표시.
// 다른 mod가 이미 입력창 위 띠를 그리고 있으면 양보한다.
// question-band 스킬(/question-band)로 켜짐/꺼짐을 전환한다.
import type { PromptOrigin, PromptSubmitInput, Register } from 'claude-code'

import { drawBand, isBlank } from './band'
import { beginQuestion, bindTurn, clearQuestion, finishTurn, readBand, resumeTicker } from './question'
import { isEnabled, isToggleSkill, loadEnabled, toggleEnabled, toggleReply } from './toggle'

// 사람이 직접 입력한 질문만 띠에 올린다(백그라운드 알림·자동 이어가기 등 제외).
const PERSON_ORIGINS: ReadonlySet<PromptOrigin['kind']> = new Set(['composer', 'bridge', 'sdk'])

const isQuestion = (e: PromptSubmitInput): boolean =>
  !e.isMeta &&
  PERSON_ORIGINS.has(e.origin.kind) &&
  (e.command === undefined || !isToggleSkill(e.command.name))

/** 이 mod 자기 로직의 예외가 입력 제출·화면 그리기를 막지 않게 한다. */
async function guarded<T>(work: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await work()
  } catch {
    return fallback
  }
}

export const register: Register = on => {
  const offsetMinutes = -new Date().getTimezoneOffset()

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await guarded(async () => {
      await loadEnabled($)
      await resumeTicker($)
    }, undefined)
    return result
  })

  on('skill.prompt', async ($, e, next) => {
    if (!isToggleSkill(e.skill)) return next(e)
    const reply = await guarded(async () => {
      const enabled = await toggleEnabled($)
      if (!enabled) await clearQuestion($)
      $.ui.toast(`질문 띠: ${enabled ? '켜짐' : '꺼짐'}`)
      return { text: toggleReply(enabled) }
    }, undefined)
    return reply ?? next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await guarded(async () => {
      if (isQuestion(e) && (await isEnabled($))) await beginQuestion($, e.text, e.turnId ?? null)
    }, undefined)
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    await guarded(async () => {
      if (e.agentId === undefined && e.text !== '') await bindTurn($, e.turnId, e.text)
    }, undefined)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await guarded(async () => {
      if (e.agentId === undefined) await finishTurn($, e.turnId, e.reason)
    }, undefined)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const beneath = await next(e)
    return guarded(async () => {
      if (e.props.hasSurvey || !isBlank(beneath) || !(await isEnabled($))) return beneath
      const { question, now } = await readBand($)
      if (question === null) return beneath
      return drawBand($, e, question, now, offsetMinutes)
    }, beneath)
  })
}
