// war-room 폴더 찾기와 켜짐 판단. 읽기 실패는 모두 "없음"으로 취급한다.
import type { EngineInterface } from 'claude-code'

const CONFIG_PATH = 'war-room/config.json'

export type WarRoom = { readonly dir: string }

/** 위 폴더로 한 칸. 루트면 undefined. */
export function parentOf(dir: string): string | undefined {
  const trimmed = dir.length > 1 ? dir.replace(/[\\/]+$/, '') : dir
  const cut = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  if (cut < 0) return undefined
  const parent = trimmed.slice(0, cut)
  if (parent === '' || /^[A-Za-z]:$/.test(parent)) {
    const root = trimmed.slice(0, cut + 1)
    return root === trimmed ? undefined : root
  }
  return parent
}

const join = (dir: string, rel: string): string =>
  `${dir.replace(/[\\/]+$/, '')}/${rel}`

/** config 내용으로 켜짐 여부 판단. JSON 오류는 켜짐(스킬이 사용자에게 알린다). */
export function isEnabledConfig(text: string): boolean {
  let config: unknown
  try {
    config = JSON.parse(text)
  } catch {
    return true
  }
  if (typeof config !== 'object' || config === null) return true
  const { enabled, roles } = config as { enabled?: unknown; roles?: unknown }
  if (enabled === false) return false
  const manager = typeof roles === 'object' && roles !== null ? (roles as { manager?: unknown }).manager : undefined
  return manager !== false
}

/** cwd에서 위로 올라가며 처음 만나는 war-room/config.json. 켜져 있으면 그 폴더, 아니면 undefined. */
export async function findEnabledWarRoom($: EngineInterface): Promise<WarRoom | undefined> {
  try {
    let dir: string | undefined = await $.session.cwd()
    while (dir !== undefined) {
      const text = await $.fs.read(join(dir, CONFIG_PATH)).catch(() => undefined)
      if (typeof text === 'string') {
        return isEnabledConfig(text) ? { dir: join(dir, 'war-room') } : undefined
      }
      dir = parentOf(dir)
    }
  } catch {
    // 찾기 실패는 꺼진 것으로 본다.
  }
  return undefined
}

/** 시스템 프롬프트에 넣을 지침. */
export const guardText = (warRoomDir: string): string =>
  [
    '# war-room',
    `이 프로젝트에는 war-room이 켜져 있다 (${warRoomDir}).`,
    '사용자 요청을 받으면 파일 읽기·계획·다른 스킬보다 먼저 armory:war-room 스킬을 불러 담당 롤을 찾고, 시작 전에 배정 한 줄(예: `→ frontend 롤에 맡깁니다 (...)`)을 알린다. 맞는 롤이 없으면 그렇다고 알리고 매니저가 직접 한다.',
    '예외: 코드 설명·상태 조회처럼 답만 하면 되는 질문.',
    '서브에이전트로 실행 중이면(롤·검증·조사·설계 에이전트 등 프롬프트가 "너는 …"으로 시작하는 역할 지시) 이 지침을 따르지 않는다. 메인 세션만 따른다.',
  ].join('\n')
