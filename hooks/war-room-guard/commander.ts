// 감독 세션(보드의 세션 ID == 이 세션 id)의 제출 context에 감독 지침을 세션 id마다 한 번 붙인다.
import type { EngineInterface, PromptSubmitInput } from 'claude-code'

import { commanderText, findEnabledWarRoom, isCommanderSession, readCommandBoard } from './find'
import { isAgentSession } from './limits'

const SENT = { plugin: 'armory', key: 'commanderSent' } as const

/**
 * 제출 직전에 호출한다. 이 세션이 담당이고 이 세션 id로 아직 안 보냈으면 context 목록(기존 것 뒤에 지침)을, 아니면 undefined를 돌려준다.
 * 슬래시 명령 제출·서브에이전트·담당 아님·읽기 실패는 undefined. 던지지 않는다.
 */
export async function commanderContext($: EngineInterface, e: PromptSubmitInput): Promise<readonly string[] | undefined> {
  try {
    if (e.command !== undefined) return undefined
    const warRoom = await findEnabledWarRoom($)
    if (warRoom === undefined || (await isAgentSession($))) return undefined
    const sessionId = await $.session.id()
    const board = await readCommandBoard($, warRoom.dir)
    if (!isCommanderSession(warRoom.configText, board, sessionId)) return undefined
    const { value: sent = '' } = await $.state.get(SENT)
    if (sent === sessionId) return undefined
    await $.state.set(SENT, sessionId)
    return [...(e.context ?? []), commanderText(warRoom.dir)]
  } catch {
    return undefined
  }
}
