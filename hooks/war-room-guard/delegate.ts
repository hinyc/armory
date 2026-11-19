// 매니저 컨텍스트가 위임값을 넘는 순간 그 제출의 context로 한 번 전달하는 지침. 현재 토큰 수는 넣지 않는다.
export const delegateText = (): string =>
  [
    '# war-room 위임 전환',
    '매니저 컨텍스트가 커졌다. 지금부터 파일 읽기·조사·검증·중 명령 판정·정형 릴리즈 확인 명령을 직접 하지 않고 에이전트에 맡겨 결론만 받는다.',
    '매니저가 직접 하는 일은 배정, 사용자 응답, war-room 문서 갱신뿐이다. 한 일 끝에 새 일 전 /clear를 권한다.',
    '서브에이전트로 실행 중이면 이 지침을 따르지 않는다.',
  ].join('\n')

import type { EngineInterface, PromptSubmitInput } from 'claude-code'

import { findEnabledWarRoom } from './find'
import { isAgentSession, readLimits, readTokens, reached } from './limits'

const SENT = { plugin: 'armory', key: 'delegateSent' } as const

/**
 * 제출 직전에 호출한다. 위임값을 막 넘었으면 넣을 context 목록(기존 것 뒤에 지침)을, 아니면 undefined를 돌려준다.
 * 시스템 프롬프트는 세션 시작 때 정해져 도중에 안 바뀌므로, 이미 있는 사용자 메시지 뒤 context로 넣는다.
 * 넘은 채로 이어지는 동안은 다시 넣지 않고(이미 대화에 있다), 위임값 아래로 내려가면(압축 등) 표시를 지워 다시 넘을 때 다시 넣는다.
 * 던지지 않는다.
 */
export async function delegateContext($: EngineInterface, e: PromptSubmitInput): Promise<readonly string[] | undefined> {
  try {
    // 슬래시 명령 제출에는 붙이지 않고 표시도 바꾸지 않는다. 다음 일반 제출에서 전달된다.
    if (e.command !== undefined) return undefined
    const warRoom = await findEnabledWarRoom($)
    if (warRoom === undefined) return undefined
    const { delegateAt } = readLimits(warRoom.configText)
    if (delegateAt === 0 || (await isAgentSession($))) return undefined
    const tokens = await readTokens($)
    if (tokens === undefined) return undefined
    const { value: sent = false } = await $.state.get(SENT)
    if (!reached(tokens, delegateAt)) {
      if (sent) await $.state.set(SENT, false)
      return undefined
    }
    if (sent) return undefined
    await $.state.set(SENT, true)
    return [...(e.context ?? []), delegateText()]
  } catch {
    return undefined
  }
}
