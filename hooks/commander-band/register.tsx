// 감독 띠 mod: 이 세션이 감독 자리를 맡았으면 war-room/COMMAND.md 요약을 입력창 위에 표시한다 (2초 폴링).
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { CommanderBand } from '../../types'
import { drawCommanderBand } from './band'
import { readCommanderBand } from './read'

const commanderBandAtom = atom({ plugin: 'armory', key: 'commanderBand' } as const, null as CommanderBand | null)

const POLL_MS = 2000

// 모듈 재로드 시 초기화되며, 첫 그리기에서 다시 켠다.
let ticker: Timer | null = null
let isPolling = false

/** 파일을 다시 읽어 바뀔 때만 상태에 쓴다. 같으면 쓰지 않아 불필요한 다시 그리기를 피한다. */
async function refresh($: EngineInterface): Promise<void> {
  if (isPolling) return
  isPolling = true
  try {
    const next = await readCommanderBand($)
    await update($, commanderBandAtom, current => (JSON.stringify(current) === JSON.stringify(next) ? current : next))
  } catch {
    // 읽기·쓰기 실패는 띠를 그리지 않는 것으로 끝낸다.
  } finally {
    isPolling = false
  }
}

export const register: Register = on => {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const beneath = await next(e)
    try {
      // session.start는 플러그인당 훅 하나만 걸 수 있어(질문 띠가 씀) 첫 그리기에서 시계를 켠다.
      if (ticker === null) {
        ticker = $.clock.every(POLL_MS, () => void refresh($))
        void refresh($)
      }
      if (e.props.hasSurvey) return beneath
      const band = await read($, commanderBandAtom)
      return band === null ? beneath : drawCommanderBand($, e, band, beneath)
    } catch {
      return beneath
    }
  })
}
