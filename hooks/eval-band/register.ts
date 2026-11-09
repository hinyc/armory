// 평가 진행 띠 mod: war-room/.eval/*.json 중 진행 중인 평가를 입력창 위(질문 띠 위)에 표시한다.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { EvalProgress } from './progress'
import { isVisible } from './progress'
import { drawEvalBand } from './band'
import { readProgress } from './read'

const evalBandsAtom = atom({ plugin: 'armory', key: 'evalBands' } as const, [] as readonly EvalProgress[])

const POLL_MS = 1000

// 모듈 재로드 시 초기화되며, 첫 그리기에서 다시 켠다.
let ticker: Timer | null = null
let isPolling = false

/** 파일을 다시 읽어 보일 것만 상태에 넣는다. 같으면 쓰지 않아 불필요한 다시 그리기를 피한다. */
async function refresh($: EngineInterface): Promise<void> {
  if (isPolling) return
  isPolling = true
  try {
    const now = await $.clock.now()
    const visible = (await readProgress($)).filter(p => isVisible(p, now))
    await update($, evalBandsAtom, current =>
      JSON.stringify(current) === JSON.stringify(visible) ? current : visible,
    )
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
      const list = await read($, evalBandsAtom)
      return list.length === 0 ? beneath : drawEvalBand($, e, list, beneath)
    } catch {
      return beneath
    }
  })
}
