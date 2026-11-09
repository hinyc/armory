// 플러그인의 hooks 진입점: hooks.json은 모듈을 하나만 받으므로 여기서 모두 등록한다.
import type { Register } from 'claude-code'

import { register as registerEvalBand } from './eval-band/register'
import { register as registerQuestionBand } from './question-band/register'
import { register as registerWarRoomGuard } from './war-room-guard/register'

export const register: Register = on => {
  // 평가 띠가 질문 띠를 감싸야(바깥) 질문 띠가 평가 띠를 다른 mod 그림으로 보고 양보하지 않는다.
  registerEvalBand(on)
  registerQuestionBand(on)
  registerWarRoomGuard(on)
}
