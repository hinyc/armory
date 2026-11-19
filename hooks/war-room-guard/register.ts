// war-room 가드 mod: 프로젝트에 war-room이 켜져 있으면 시스템 프롬프트에
// "먼저 담당 롤부터 찾는다" 지침 섹션을 넣는다. 요청마다 설정 파일을 새로 읽는다
// (몇 번의 작은 읽기라 캐시 없이 설정 변경이 바로 반영된다).
// 매니저 컨텍스트가 위임값을 넘으면 다음 제출에 위임 전환 지침을 context로 한 번 붙이고, 압축값 이상이면 턴 사이에 압축한다.
import type { Register } from 'claude-code'

import { compactIfNeeded } from './compact'
import { delegateContext } from './delegate'
import { findEnabledWarRoom, guardText } from './find'

export const register: Register = on => {
  on('prompt.compose', async ($, e, next) => {
    const result = await next(e)
    try {
      const warRoom = await findEnabledWarRoom($)
      if (warRoom === undefined) return result
      return { sections: [...result.sections, { id: 'armory:war-room', text: guardText(warRoom.dir), scope: 'session' as const }] }
    } catch {
      return result
    }
  })

  // 사람이 보낸 제출(입력창·원격)에만 붙인다. question-band가 매처 없는 prompt.submit을 이미 등록해서 매처가 필요하다.
  // 시스템 프롬프트 섹션은 세션 시작 때 정해져 도중에 안 바뀌므로 쓰지 않는다.
  on('prompt.submit', { origin: { kind: /^(composer|bridge)$/ } }, async ($, e, next) => {
    const context = await delegateContext($, e)
    return next(context === undefined ? e : { ...e, context })
  })

  // question-band가 매처 없는 turn.complete를 이미 등록해서(같은 이벤트 둘은 매처가 있어야 함) 정상 종료만 고른다.
  on('turn.complete', { reason: 'answer' }, async ($, e, next) => {
    const result = await next(e)
    await compactIfNeeded($, e)
    return result
  })
}
