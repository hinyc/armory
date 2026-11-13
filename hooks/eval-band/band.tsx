// 평가 진행 띠 그리기: 평가 블록(롤마다 하나)을 위에, 아래 그림(질문 띠 등)을 그 밑에 쌓는다.
import type { EngineInterface, RenderElement, RenderInput } from 'claude-code'

import { runText, STATUS_MARK, type EvalEntry, type EvalRun } from './progress'

const NARROW_COLUMNS = 70

const runMark = (run: EvalRun): string =>
  run.verdict === 'pass' ? STATUS_MARK.pass : run.verdict === 'fail' ? STATUS_MARK.fail : STATUS_MARK.na

export function drawEvalBand(
  $: EngineInterface,
  e: RenderInput,
  list: readonly EvalEntry[],
  beneath: RenderElement | null,
): RenderElement {
  if (list.length === 0) return beneath as RenderElement
  const { Box, Text } = $.ui.resolve(e)
  const compact = e.props.bodyColumns < NARROW_COLUMNS
  const blocks = list.map(p => {
    const { previous, current } = p
    const label = current.state === 'planning' ? '계획' : `시도 ${current.attempt}`
    const focus = current.focus !== undefined && current.focus !== '' ? ` ${current.focus}` : ''
    return (
      <Box key={p.id ?? `${p.role}:${p.task}`} flexDirection="column">
        <Text wrap="truncate-end" bold>
          {`⚖ 평가 · ${p.role} · ${p.task}`}
        </Text>
        {previous !== undefined ? (
          <Text key="previous" wrap="truncate-end" dimColor>
            {`  이전 (시도 ${previous.attempt}) ${runMark(previous)}  ${runText(previous, compact)}`}
          </Text>
        ) : null}
        <Text wrap="truncate-end" color="warning">
          {`  지금 (${label}) ${STATUS_MARK.running}  ${
            current.state === 'planning' ? focus.trim() : runText(current, compact)
          }`}
        </Text>
      </Box>
    )
  })
  return (
    <Box flexDirection="column">
      {blocks}
      {beneath === null ? null : beneath}
    </Box>
  )
}
