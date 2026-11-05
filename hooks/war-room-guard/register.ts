// war-room 가드 mod: 프로젝트에 war-room이 켜져 있으면 시스템 프롬프트에
// "먼저 담당 롤부터 찾는다" 지침 섹션을 넣는다. 요청마다 설정 파일을 새로 읽는다
// (몇 번의 작은 읽기라 캐시 없이 설정 변경이 바로 반영된다).
import type { Register } from 'claude-code'

import { findEnabledWarRoom, guardText } from './find'

export const register: Register = on => {
  on('prompt.compose', async ($, e, next) => {
    const result = await next(e)
    try {
      const warRoom = await findEnabledWarRoom($)
      if (warRoom === undefined) return result
      return {
        sections: [
          ...result.sections,
          { id: 'armory:war-room', text: guardText(warRoom.dir), scope: 'session' as const },
        ],
      }
    } catch {
      return result
    }
  })
}
