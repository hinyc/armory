// 플러그인의 hooks 진입점: hooks.json은 모듈을 하나만 받으므로 여기서 모두 등록한다.
import type { Register } from 'claude-code'

import { register as registerQuestionBand } from './question-band/register'
import { register as registerWarRoomGuard } from './war-room-guard/register'

export const register: Register = on => {
  registerQuestionBand(on)
  registerWarRoomGuard(on)
}
