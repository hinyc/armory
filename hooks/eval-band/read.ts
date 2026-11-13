// war-room/.eval/*.json 읽기. 어떤 실패도 "없음"으로 삼킨다.
import type { EngineInterface } from 'claude-code'

import { findEnabledWarRoom, isEvaluatorOn } from '../war-room-guard/find'
import { parseProgress, type EvalEntry } from './progress'

export async function readProgress($: EngineInterface): Promise<EvalEntry[]> {
  try {
    // war-room이 꺼졌거나 평가 롤이 꺼져 있으면 띠를 그리지 않는다(guard와 같은 판단).
    const warRoom = await findEnabledWarRoom($)
    if (warRoom === undefined || !isEvaluatorOn(warRoom.configText)) return []
    const dir = `${warRoom.dir}/.eval`
    const entries = await $.fs.list(dir).catch(() => [])
    const names = entries
      .filter(entry => entry.kind === 'file' && entry.name.endsWith('.json'))
      .map(entry => entry.name)
      .sort()
    const parsed = await Promise.all(
      names.map(async name => {
        const text = await $.fs.read(`${dir}/${name}`).catch(() => undefined)
        const p = typeof text === 'string' ? parseProgress(text) : undefined
        return p === undefined ? undefined : { ...p, id: name }
      }),
    )
    return parsed.filter((p): p is EvalEntry => p !== undefined)
  } catch {
    return []
  }
}
