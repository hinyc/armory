// 요청 사이 자동 압축: 메인 턴이 끝난 turn.complete에서 compact를 부른다.
// (prompt.submit에서는 엔진이 "턴을 잡고 있는 중"이라며 거절한다.)
// 압축 직후에는 tokens가 없어서(다음 응답 전) 값으로는 압축 여부를 알 수 없으므로 $.state의 compactHold로 막는다.
import type { EngineInterface, TurnCompleteInput } from 'claude-code'

import { findEnabledWarRoom } from './find'
import { isAgentSession, readLimits, readTokens, reached } from './limits'

export const COMPACT_INSTRUCTIONS =
  'war-room 매니저 대화다. 요약에 war-room/STATUS.md의 진행 중 항목(담당 롤·시도 n/최대·마지막 판정), 이번 대화에서 정한 결정과 이유, 남은 일과 다음 할 일, 사용자가 아직 답하지 않은 질문을 빠짐없이 남긴다. 파일 내용·긴 출력은 줄이고 결론만 남긴다.'

// delegate.ts의 같은 키. 참조는 이 파일 안의 리터럴 const여야 해서 따로 적는다.
const DELEGATE_SENT = { plugin: 'armory', key: 'delegateSent' } as const
const HOLD = { plugin: 'armory', key: 'compactHold' } as const

const COMPACTING = '컨텍스트가 커서 요청 전에 대화를 압축합니다.'
const SUGGEST = '컨텍스트가 큽니다. 자동 압축이 안 돼 /compact를 권합니다.'

async function setHold($: EngineInterface, value: boolean): Promise<void> {
  await $.state.set(HOLD, value)
}

/** 조건이 맞으면 압축한다. 실패·skip은 /compact 권유 토스트 한 번. 던지지 않는다. 메인 세션의 정상 종료만 본다. */
export async function compactIfNeeded($: EngineInterface, e: TurnCompleteInput): Promise<void> {
  try {
    if (e.agentId !== undefined || e.reason !== 'answer') return
    const warRoom = await findEnabledWarRoom($)
    if (warRoom === undefined) return
    const { compactAt } = readLimits(warRoom.configText)
    if (compactAt === 0 || (await isAgentSession($))) return
    const tokens = await readTokens($)
    if (tokens === undefined) return
    const { value: held = false } = await $.state.get(HOLD)
    if (!reached(tokens, compactAt)) {
      if (held) await setHold($, false)
      return
    }
    if (held) return
    await setHold($, true)
    $.ui.toast(COMPACTING)
    const result = await $.session.compact({ instructions: COMPACT_INSTRUCTIONS }).catch(() => ({ skip: 'rejected' }))
    if (result.skip !== undefined) $.ui.toast(SUGGEST)
    // 압축으로 대화에서 위임 지침이 사라졌을 수 있으니 전달 표시를 풀어, 압축 뒤에도 위임값 이상이면 다시 전달한다.
    else await $.state.set(DELEGATE_SENT, false)
  } catch {
    // 압축 실패가 턴 종료를 막지 않는다.
  }
}
