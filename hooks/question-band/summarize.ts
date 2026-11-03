// 긴 질문을 haiku로 최대 4줄 요약.
import type { EngineInterface } from 'claude-code'

import { parseSummary } from './format'

const MODEL = 'haiku'
const MAX_INPUT_CHARS = 8000
const TIMEOUT_MS = 20_000

const SYSTEM = [
  '너는 사용자가 AI 코딩 도우미에게 한 요청을 짧게 요약한다.',
  '요청의 언어와 같은 언어로, 무엇을 해달라는지 핵심만 최대 4줄로 쓴다.',
  '각 줄은 40자 안팎의 한 문장. 인사말·설명·따옴표·머리말 없이 요약 줄만 출력한다.',
].join('\n')

/** 요약 줄 목록. 모델이 답하지 못하면 null. */
export async function summarize($: EngineInterface, prompt: string): Promise<string[] | null> {
  const result = await $.model.complete({
    model: MODEL,
    system: SYSTEM,
    prompt: `<request>\n${prompt.slice(0, MAX_INPUT_CHARS)}\n</request>`,
    maxTokens: 300,
    timeoutMs: TIMEOUT_MS,
  })
  if (!result.isAnswered) return null
  const lines = parseSummary(result.text)
  return lines.length > 0 ? lines : null
}
