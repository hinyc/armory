// 감독 세션(보드의 세션 ID == 이 세션 id)의 제출 context에 감독 지침을 세션 id마다 첫 제출에(짧은 알림과 함께), 그 뒤 제출마다 짧은 알림만 붙인다.
import type { EngineInterface, PromptSubmitInput } from 'claude-code'

import { commanderReminder, commanderText, findWarRoom, isCommanderSession, parseSeat, readCommandBoard } from './find'
import { isAgentSession } from './limits'

const SENT = { plugin: 'armory', key: 'commanderSent' } as const

/** 담당이 아닌 제출에서, 이 세션 id로 남은 "지침 보냄" 표시를 지운다(빈 문자열 = 안 보냄). 다른 세션 id 표시는 그대로. */
async function clearOwnMark($: EngineInterface, sessionId: string): Promise<void> {
  const { value, version } = await $.state.get(SENT)
  if (value === sessionId) await $.state.set(SENT, '', { ifVersion: version })
}

/** 보드의 감독 자리 상태를 읽을 수 있을 때만 true. 읽기 실패·상태 없음이면 표시를 지우지 않는다. */
const seatReadable = (board: string | undefined): boolean => parseSeat(board).status !== undefined

/**
 * 제출 직전에 호출한다. 이 세션이 담당이면 context 목록(기존 것 뒤에)을 돌려준다: 이 세션 id로 아직 안 보냈으면 지침 전체와 짧은 알림 둘 다, 보냈으면 짧은 알림만.
 * 슬래시 명령 제출·서브에이전트·담당 아님·읽기 실패는 undefined. 메인 세션의 담당 아님 제출(war-room·commander 꺼짐 포함)은 이 세션 id의 표시를 지운다. 던지지 않는다.
 */
export async function commanderContext($: EngineInterface, e: PromptSubmitInput): Promise<readonly string[] | undefined> {
  try {
    if (e.command !== undefined) return undefined
    const found = await findWarRoom($)
    if (found === undefined || (await isAgentSession($))) return undefined
    const sessionId = await $.session.id()
    const board = await readCommandBoard($, found.dir)
    if (!isCommanderSession(found.configText, board, sessionId)) {
      if (seatReadable(board)) await clearOwnMark($, sessionId)
      return undefined
    }
    const { value: sent = '' } = await $.state.get(SENT)
    if (sent === sessionId) return [...(e.context ?? []), commanderReminder()]
    await $.state.set(SENT, sessionId)
    return [...(e.context ?? []), commanderText(found.dir), commanderReminder()]
  } catch {
    return undefined
  }
}
