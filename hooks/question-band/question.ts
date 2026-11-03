// 질문 상태($.state)와 경과 시간 시계.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Timer, TurnCompleteReason } from 'claude-code'

import type { Question } from '../../types'
import { fallbackSummary, needsModelSummary, normalizePrompt } from './format'
import { summarize } from './summarize'

const questionAtom = atom({ plugin: 'armory', key: 'question' } as const, null)
const nowAtom = atom({ plugin: 'armory', key: 'now' } as const, 0)

const TICK_MS = 1000

// 모듈 재로드 시 초기화되며, session.start에서 resumeTicker로 다시 켠다.
let ticker: Timer | null = null

function stopTicker(): void {
  ticker?.cancel()
  ticker = null
}

async function tick($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  await update($, nowAtom, () => now)
}

function startTicker($: EngineInterface): void {
  stopTicker()
  ticker = $.clock.every(TICK_MS, () => void tick($))
}

/** askedAt이 같은 질문일 때만 고친다(그 사이 새 질문이 왔으면 무시). */
async function patchQuestion(
  $: EngineInterface,
  askedAt: number,
  patch: Partial<Question>,
): Promise<void> {
  await update($, questionAtom, current =>
    current !== null && current.askedAt === askedAt ? { ...current, ...patch } : current,
  )
}

async function applyModelSummary($: EngineInterface, askedAt: number, prompt: string): Promise<void> {
  const lines = await summarize($, prompt)
  if (lines === null) return
  await patchQuestion($, askedAt, { summary: lines, isSummarized: true })
}

/** 새 질문: 이전 요약을 대체하고 시계를 시작한다. */
export async function beginQuestion($: EngineInterface, prompt: string, turnId: string | null): Promise<void> {
  const askedAt = await $.clock.now()
  const isSummarized = !needsModelSummary(prompt)
  const question: Question = {
    askedAt,
    prompt,
    summary: fallbackSummary(prompt),
    isSummarized,
    turnId,
    endedAt: null,
    status: 'running',
  }
  await update($, questionAtom, () => question)
  await update($, nowAtom, () => askedAt)
  startTicker($)
  if (!isSummarized) {
    // 프롬프트 제출을 막지 않도록 타이머에서 요약
    $.clock.after(0, () => void applyModelSummary($, askedAt, prompt))
  }
}

/** 재로드 후 진행 중인 질문이 있으면 시계를 다시 켠다. */
export async function resumeTicker($: EngineInterface): Promise<void> {
  const question = await read($, questionAtom)
  if (question?.status === 'running') startTicker($)
}

/** 메인 턴 시작: 아직 턴이 없는 질문, 또는 대기열에 있다 시작된 같은 질문을 이 턴에 묶는다. */
export async function bindTurn($: EngineInterface, turnId: string, text: string): Promise<void> {
  const question = await read($, questionAtom)
  if (question === null || question.turnId === turnId) return
  const isQueuedPrompt = normalizePrompt(question.prompt) === normalizePrompt(text)
  if (question.turnId !== null && !isQueuedPrompt) return
  await patchQuestion($, question.askedAt, { turnId, status: 'running', endedAt: null })
  if (question.status !== 'running') startTicker($)
}

const STATUS_BY_REASON: Record<TurnCompleteReason, Question['status']> = {
  answer: 'done',
  aborted: 'aborted',
  refusal: 'error',
  error: 'error',
}

/** 메인 턴 종료: 이 턴의 질문이면 걸린 시간을 고정하고 시계를 멈춘다. */
export async function finishTurn($: EngineInterface, turnId: string, reason: TurnCompleteReason): Promise<void> {
  const question = await read($, questionAtom)
  if (question === null || question.status !== 'running') return
  if (question.turnId !== null && question.turnId !== turnId) return
  const endedAt = await $.clock.now()
  await patchQuestion($, question.askedAt, { endedAt, status: STATUS_BY_REASON[reason] })
  stopTicker()
}

/** 띠를 그릴 값. 그리는 중에 읽으면 값이 바뀔 때 다시 그려진다. */
export async function readBand($: EngineInterface): Promise<{ question: Question | null; now: number }> {
  const question = await read($, questionAtom)
  const now = await read($, nowAtom)
  return { question, now: question === null ? now : Math.max(now, question.askedAt) }
}

/** 끌 때: 시계를 멈추고 표시 중인 질문을 지운다. */
export async function clearQuestion($: EngineInterface): Promise<void> {
  stopTicker()
  await update($, questionAtom, () => null)
}
