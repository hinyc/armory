// 매니저 컨텍스트 상한: config의 managerDelegateAt·managerCompactAt 읽기와 현재 토큰 수 조회.
import type { EngineInterface } from 'claude-code'

export const DEFAULT_DELEGATE_AT = 100000
export const DEFAULT_COMPACT_AT = 150000

/** 0이면 그 단계를 끈다. */
export type Limits = { readonly delegateAt: number; readonly compactAt: number }

/** 양의 정수는 그 값, 0은 끔(0), 그 밖의 값은 기본값. */
function limitOf(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback
}

/** config 내용에서 두 기준값을 읽는다. JSON이 깨졌거나 객체가 아니면 기본값. */
export function readLimits(configText: string): Limits {
  let config: unknown
  try {
    config = JSON.parse(configText)
  } catch {
    return { delegateAt: DEFAULT_DELEGATE_AT, compactAt: DEFAULT_COMPACT_AT }
  }
  const raw = typeof config === 'object' && config !== null && !Array.isArray(config) ? (config as Record<string, unknown>) : {}
  return {
    delegateAt: limitOf(raw.managerDelegateAt, DEFAULT_DELEGATE_AT),
    compactAt: limitOf(raw.managerCompactAt, DEFAULT_COMPACT_AT),
  }
}

/** 마지막 응답의 입력 토큰 수. 없거나 읽기 실패면 undefined. */
export async function readTokens($: EngineInterface): Promise<number | undefined> {
  try {
    const tokens = (await $.session.usage()).context.tokens
    return typeof tokens === 'number' ? tokens : undefined
  } catch {
    return undefined
  }
}

/** 이 세션이 서브에이전트(또는 --agent)로 도는지. 읽기 실패는 서브에이전트로 본다(아무것도 하지 않는 쪽). */
export async function isAgentSession($: EngineInterface): Promise<boolean> {
  try {
    return (await $.session.info()).agentType !== undefined
  } catch {
    return true
  }
}

export const reached = (tokens: number | undefined, limit: number): boolean =>
  tokens !== undefined && limit > 0 && tokens >= limit
