// war-room/.eval/*.json 읽기. 어떤 실패도 "없음"으로 삼킨다.
import type { EngineInterface } from 'claude-code'

import { findWarRoom } from '../war-room-guard/find'
import { parseProgress, type EvalProgress } from './progress'

export async function readProgress($: EngineInterface): Promise<EvalProgress[]> {
  try {
    const warRoom = await findWarRoom($)
    if (warRoom === undefined) return []
    const dir = `${warRoom.dir}/.eval`
    const entries = await $.fs.list(dir).catch(() => [])
    const names = entries
      .filter(entry => entry.kind === 'file' && entry.name.endsWith('.json'))
      .map(entry => entry.name)
      .sort()
    const parsed = await Promise.all(
      names.map(async name => {
        const text = await $.fs.read(`${dir}/${name}`).catch(() => undefined)
        return typeof text === 'string' ? parseProgress(text) : undefined
      }),
    )
    return parsed.filter((p): p is EvalProgress => p !== undefined)
  } catch {
    return []
  }
}
