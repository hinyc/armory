// 질문 띠 켜짐/꺼짐 전환: $.store에 저장해 세션이 바뀌어도 유지한다.
import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

const enabledAtom = atom({ plugin: 'armory', key: 'enabled' } as const, true)

const STORE_KEY = 'questionBand.enabled'
const SKILL_NAME = 'question-band'

/** 이 플러그인의 question-band 스킬인지 ("question-band", "armory:question-band"). */
export const isToggleSkill = (name: string): boolean =>
  name === SKILL_NAME || name.endsWith(`:${SKILL_NAME}`)

/** 세션 시작 시 저장된 값을 불러온다. 저장된 적 없으면 켜짐. */
export async function loadEnabled($: EngineInterface): Promise<void> {
  const stored = await $.store.get(STORE_KEY)
  const enabled = stored !== false
  await update($, enabledAtom, () => enabled)
}

/** 그리는 중에 읽으면 켜짐/꺼짐이 바뀔 때 다시 그려진다. */
export async function isEnabled($: EngineInterface): Promise<boolean> {
  return read($, enabledAtom)
}

/** 켜짐↔꺼짐을 바꾸고 바뀐 상태를 돌려준다. */
export async function toggleEnabled($: EngineInterface): Promise<boolean> {
  const enabled = !(await read($, enabledAtom))
  await $.store.set(STORE_KEY, enabled)
  await update($, enabledAtom, () => enabled)
  return enabled
}

/** 스킬 대신 모델에게 전달할 결과 안내. */
export function toggleReply(enabled: boolean): string {
  return [
    '# 질문 띠 전환 결과',
    '',
    `질문 띠: ${enabled ? '켜짐' : '꺼짐'} (다음 세션에도 유지)`,
    '',
    `사용자에게 "질문 띠: ${enabled ? '켜짐' : '꺼짐'}" 한 줄만 알리고, 다른 작업은 하지 마세요.`,
  ].join('\n')
}
