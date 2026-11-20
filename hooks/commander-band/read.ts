// 감독 담당 세션이면 war-room/COMMAND.md를 읽어 띠 값을 만든다. 어떤 실패도 "없음"으로 삼킨다.
import type { EngineInterface } from 'claude-code'

import type { CommanderBand } from '../../types'
import { findEnabledWarRoom, isCommanderOn, isCommanderSession, readCommandBoard } from '../war-room-guard/find'
import { isAgentSession } from '../war-room-guard/limits'
import { parseBoard } from './board'

export async function readCommanderBand($: EngineInterface): Promise<CommanderBand | null> {
  try {
    // war-room이 없거나 꺼졌거나 감독 자리가 꺼져 있으면 COMMAND.md를 읽지 않는다.
    const warRoom = await findEnabledWarRoom($)
    if (warRoom === undefined || !isCommanderOn(warRoom.configText)) return null
    if (await isAgentSession($)) return null
    const sessionId = await $.session.id()
    const board = await readCommandBoard($, warRoom.dir)
    if (board === undefined || !isCommanderSession(warRoom.configText, board, sessionId)) return null
    return parseBoard(board) ?? null
  } catch {
    return null
  }
}
